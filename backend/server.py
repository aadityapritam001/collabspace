"""
CollabSpace Backend — Influencer Marketing Marketplace
=======================================================
Two-sided marketplace connecting Influencers/Content Creators with Businesses/Brands.

Core capabilities exposed by this file:
  • Authentication: Email/Password (JWT-style session tokens) + Emergent managed Google OAuth
  • Role-based access: influencer | business | admin
  • Discovery: filter influencers by category, region, budget, followers, platform, rating
  • Collaboration lifecycle: request -> chat -> negotiate -> unlock contact (paid) -> campaign -> review
  • Real-time chat via WebSocket (with REST fallback for history)
  • MOCK Razorpay contact-unlock payment (real gateway ready to plug in via env vars)
  • Admin endpoints for moderation, analytics and platform config

All routes are prefixed with `/api` to align with the ingress rule that maps
`/api/*` traffic to this FastAPI service on port 8001.
"""

from __future__ import annotations

import os
import uuid
import json
import hmac
import hashlib
import logging
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

import bcrypt
import httpx
import requests
from dotenv import load_dotenv
from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, Header, Request,
    WebSocket, WebSocketDisconnect, status, Query, UploadFile, File, Form,
)
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from starlette.middleware.cors import CORSMiddleware


# ---------------------------------------------------------------------------
# Boot / configuration
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# In production, override these via env. Locally-generated defaults are fine
# because sessions are opaque server-issued tokens looked up in Mongo.
JWT_SECRET = os.environ.get("APP_JWT_SECRET", secrets.token_hex(32))

# ---- Razorpay live-mode config (falls back to mock when keys are missing) ----
RAZORPAY_KEY_ID = (os.environ.get("RAZORPAY_KEY_ID") or "").strip()
RAZORPAY_KEY_SECRET = (os.environ.get("RAZORPAY_KEY_SECRET") or "").strip()
RAZORPAY_LIVE = bool(RAZORPAY_KEY_ID) and bool(RAZORPAY_KEY_SECRET)
if RAZORPAY_LIVE:
    try:
        import razorpay  # type: ignore
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception as _e:  # pragma: no cover — keeps startup robust
        RAZORPAY_LIVE = False
        razorpay_client = None
else:
    razorpay_client = None

# ---- Emergent Object Storage config ----
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = (os.environ.get("EMERGENT_LLM_KEY") or "").strip()
APP_NAME = "collabspace"
_storage_key: Optional[str] = None  # module-level cache


def init_storage() -> Optional[str]:
    """Idempotent init — returns a reusable storage_key. Returns None if disabled."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json().get("storage_key")
    except Exception as e:
        logger_early = logging.getLogger("collabspace")
        logger_early.warning("Object storage init failed: %s", e)
        _storage_key = None
    return _storage_key


def _reset_storage_key():
    global _storage_key
    _storage_key = None


def put_object(path: str, data: bytes, content_type: str) -> Dict[str, Any]:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 503:
        _reset_storage_key()
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    if resp.status_code == 402:
        raise HTTPException(status_code=402, detail="Storage credits exhausted")
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 503:
        _reset_storage_key()
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code >= 400:
        raise HTTPException(status_code=404, detail="File not found")
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("collabspace")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="CollabSpace API", version="1.0.0")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------
def now_utc() -> datetime:
    """Timezone-aware UTC now — always use this instead of datetime.utcnow()."""
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    """Generate a compact prefixed id for MongoDB documents."""
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def strip_mongo(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Remove Mongo internals (_id, password_hash) safely before returning."""
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


# ---------------------------------------------------------------------------
# Pydantic models — request/response contracts
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = Field(pattern="^(influencer|business)$")


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class ProfileIn(BaseModel):
    """Unified profile update — fields not relevant to the user's role are ignored."""
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    region: Optional[str] = None
    # influencer-only
    category: Optional[str] = None
    platforms: Optional[List[str]] = None  # instagram, youtube, tiktok, x
    social_handles: Optional[Dict[str, str]] = None  # {"instagram": "@handle"}
    followers: Optional[int] = None
    engagement_rate: Optional[float] = None
    pricing: Optional[Dict[str, int]] = None  # {"post":5000,"reel":10000,"story":2000}
    portfolio_urls: Optional[List[str]] = None
    unlock_tier: Optional[str] = None  # basic|silver|gold -> 10/49/99
    # business-only
    brand_name: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None


class RequestIn(BaseModel):
    to_user_id: str
    message: str
    budget: Optional[int] = None
    deliverables: Optional[str] = None


class RequestStatusIn(BaseModel):
    status: str = Field(pattern="^(accepted|rejected)$")


class MessageIn(BaseModel):
    conversation_id: str
    text: str
    # optional structured payload for "negotiation cards"
    kind: str = Field(default="text", pattern="^(text|offer|system)$")
    offer: Optional[Dict[str, Any]] = None


class CampaignIn(BaseModel):
    request_id: str
    title: str
    deliverables: str
    price: int
    deadline: Optional[str] = None  # ISO date


class CampaignStatusIn(BaseModel):
    status: str = Field(pattern="^(active|delivered|completed|cancelled)$")
    attachments: Optional[List[str]] = None
    notes: Optional[str] = None


class ReviewIn(BaseModel):
    campaign_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class PaymentInitIn(BaseModel):
    request_id: str


class PaymentVerifyIn(BaseModel):
    request_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str  # mocked — accepted as-is


# ---------------------------------------------------------------------------
# Auth dependency — extracts current user from Bearer session_token
# ---------------------------------------------------------------------------
async def get_current_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """Look up the current user via the opaque session_token stored server-side.

    Mobile clients always send `Authorization: Bearer <session_token>`.
    Tokens are minted either by /auth/session (Google) or /auth/login|register (email).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = session.get("expires_at")
    # MongoDB may return naive datetimes — normalize before compare.
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_role(*allowed: str):
    async def _dep(user: Dict[str, Any] = Depends(get_current_user)):
        if user.get("role") not in allowed:
            raise HTTPException(status_code=403, detail="Forbidden for role")
        return user
    return _dep


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------
async def mint_session(user_id: str) -> str:
    """Create a new opaque session token valid for 7 days."""
    token = secrets.token_urlsafe(48)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=7),
    })
    return token


# ---------------------------------------------------------------------------
# Seed & indexes
# ---------------------------------------------------------------------------
DEFAULT_CATEGORIES = [
    "Fashion", "Beauty", "Fitness", "Food", "Travel",
    "Tech", "Gaming", "Lifestyle", "Finance", "Education",
    "Comedy", "Parenting", "Music", "Photography", "Business",
]
DEFAULT_REGIONS = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai",
    "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Goa",
    "Pan India", "International",
]

# Tier -> Contact-unlock fee in INR (rupees)
UNLOCK_TIER_FEES = {"basic": 10, "silver": 49, "gold": 99}


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    # TTL — MongoDB will auto-purge expired sessions.
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.collab_requests.create_index([("from_user_id", 1), ("to_user_id", 1)])
    await db.conversations.create_index("participants")
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.campaigns.create_index("request_id")
    await db.reviews.create_index("campaign_id")
    await db.verifications.create_index("user_id", unique=True)
    await db.verifications.create_index("status")
    await db.saved_searches.create_index("user_id")
    await db.files.create_index("storage_path", unique=True)


async def seed_defaults():
    # Categories & Regions
    for c in DEFAULT_CATEGORIES:
        await db.categories.update_one({"name": c}, {"$setOnInsert": {"name": c}}, upsert=True)
    for r in DEFAULT_REGIONS:
        await db.regions.update_one({"name": r}, {"$setOnInsert": {"name": r}}, upsert=True)

    # Demo users so the UX is populated from first launch.
    demo_users = [
        # role, email, password, name, extra
        ("admin", "admin@collabspace.app", "Admin@123", "Platform Admin", {}),
        ("business", "brand@collabspace.app", "Brand@123", "Aurora Cosmetics", {
            "brand_name": "Aurora Cosmetics", "industry": "Beauty", "region": "Mumbai",
            "avatar_url": "https://images.unsplash.com/photo-1608541737042-87a12275d313?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxOaWtlJTIwbG9nbyUyMHBuZ3xlbnwwfHx8fDE3ODc2NTA4Mjh8MA&ixlib=rb-4.1.0&q=85",
        }),
        ("influencer", "creator@collabspace.app", "Creator@123", "Riya Kapoor", {
            "category": "Fashion", "region": "Mumbai", "platforms": ["instagram", "youtube"],
            "social_handles": {"instagram": "@riya.kapoor", "youtube": "riyakapoor"},
            "followers": 245000, "engagement_rate": 4.8,
            "pricing": {"post": 15000, "reel": 25000, "story": 5000},
            "unlock_tier": "gold", "rating_avg": 4.7, "rating_count": 22,
            "avatar_url": "https://images.unsplash.com/photo-1632149877166-f75d49000351?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwY3JlYXRvciUyMGxpZmVzdHlsZXxlbnwwfHx8fDE3ODc2NTA4Mjh8MA&ixlib=rb-4.1.0&q=85",
            "bio": "Fashion storyteller. Mumbai-based. Editorial x lifestyle.",
            "verified": True,
        }),
        ("influencer", "fit@collabspace.app", "Creator@123", "Arjun Mehta", {
            "category": "Fitness", "region": "Bengaluru", "platforms": ["instagram", "tiktok"],
            "social_handles": {"instagram": "@arjun.fit"},
            "followers": 128000, "engagement_rate": 6.2,
            "pricing": {"post": 8000, "reel": 15000, "story": 3000},
            "unlock_tier": "silver", "rating_avg": 4.5, "rating_count": 14,
            "avatar_url": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxmaXRuZXNzJTIwaW5mbHVlbmNlciUyMHdvcmtpbmclMjBvdXR8ZW58MHx8fHwxNzg3NjUwODI4fDA&ixlib=rb-4.1.0&q=85",
            "bio": "Certified coach. Real transformation stories.",
            "verified": True,
        }),
        ("influencer", "tech@collabspace.app", "Creator@123", "Nikhil Rao", {
            "category": "Tech", "region": "Bengaluru", "platforms": ["youtube", "instagram"],
            "social_handles": {"youtube": "nikhiltech"},
            "followers": 512000, "engagement_rate": 3.9,
            "pricing": {"post": 20000, "reel": 40000, "story": 8000},
            "unlock_tier": "gold", "rating_avg": 4.9, "rating_count": 47,
            "avatar_url": "https://images.pexels.com/photos/12712506/pexels-photo-12712506.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
            "bio": "Deep-dive gadget reviews. Honest. No fluff.",
            "verified": True,
        }),
        ("influencer", "food@collabspace.app", "Creator@123", "Sara Iyer", {
            "category": "Food", "region": "Delhi", "platforms": ["instagram"],
            "social_handles": {"instagram": "@sara.eats"},
            "followers": 84000, "engagement_rate": 7.5,
            "pricing": {"post": 6000, "reel": 12000, "story": 2500},
            "unlock_tier": "basic", "rating_avg": 4.3, "rating_count": 9,
            "avatar_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?crop=entropy&cs=srgb&fm=jpg&w=800",
            "bio": "Street food to fine dining across India.",
        }),
    ]
    for role, email, pw, name, extra in demo_users:
        existing = await db.users.find_one({"email": email})
        if existing:
            continue
        uid = new_id("user")
        doc = {
            "user_id": uid,
            "email": email,
            "name": name,
            "role": role,
            "password_hash": hash_password(pw),
            "provider": "password",
            "created_at": now_utc(),
            "verified": extra.pop("verified", False),
            "rating_avg": extra.pop("rating_avg", 0),
            "rating_count": extra.pop("rating_count", 0),
            **extra,
        }
        await db.users.insert_one(doc)


@app.on_event("startup")
async def _startup():
    await ensure_indexes()
    await seed_defaults()
    # Best-effort — object storage is optional for local dev.
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.warning("Storage init deferred: %s", e)
    logger.info(
        "CollabSpace API ready — razorpay_live=%s storage_ready=%s",
        RAZORPAY_LIVE, bool(EMERGENT_KEY),
    )


@app.on_event("shutdown")
async def _shutdown():
    client.close()


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterIn):
    """Email/password sign up. Returns { session_token, user }."""
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    uid = new_id("user")
    doc = {
        "user_id": uid,
        "email": body.email,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "provider": "password",
        "created_at": now_utc(),
        "verified": False,
        "rating_avg": 0,
        "rating_count": 0,
    }
    await db.users.insert_one(doc)
    token = await mint_session(uid)
    return {"session_token": token, "user": strip_mongo(doc)}


@api.post("/auth/login")
async def login(body: LoginIn):
    """Email/password sign in."""
    user = await db.users.find_one({"email": body.email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = await mint_session(user["user_id"])
    return {"session_token": token, "user": strip_mongo(user)}


@api.post("/auth/session")
async def google_session(body: GoogleSessionIn):
    """Exchange Emergent Google Auth session_id for our own session_token.

    The frontend receives session_id in the redirect URL and posts it here.
    We call demobackend.emergentagent.com ONCE, upsert the user, and mint
    our own opaque session_token.
    """
    async with httpx.AsyncClient(timeout=15.0) as http:
        try:
            resp = await http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
        except Exception as e:
            logger.exception("emergent session exchange failed: %s", e)
            raise HTTPException(status_code=401, detail="Auth exchange failed")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session_id")
    data = resp.json()
    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    if not email:
        raise HTTPException(status_code=401, detail="No email from provider")

    existing = await db.users.find_one({"email": email})
    if existing:
        uid = existing["user_id"]
    else:
        uid = new_id("user")
        await db.users.insert_one({
            "user_id": uid,
            "email": email,
            "name": name,
            "avatar_url": picture,
            # NEW google users start with no role — frontend routes them
            # to role-selection before the main tabs mount.
            "role": "pending",
            "provider": "google",
            "created_at": now_utc(),
            "verified": False,
            "rating_avg": 0,
            "rating_count": 0,
        })
    token = await mint_session(uid)
    user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    return {"session_token": token, "user": user}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.lower().startswith("bearer "):
        await db.user_sessions.delete_one({"session_token": authorization.split(" ", 1)[1].strip()})
    return {"ok": True}


@api.post("/auth/select-role")
async def select_role(body: dict, user=Depends(get_current_user)):
    role = body.get("role")
    if role not in ("influencer", "business"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": role}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------
@api.put("/users/profile")
async def update_profile(body: ProfileIn, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": fresh}


@api.get("/users/{user_id}")
async def get_user(user_id: str, _=Depends(get_current_user)):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0, "phone": 0, "email": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": u}


# ---------------------------------------------------------------------------
# Discovery / listings
# ---------------------------------------------------------------------------
@api.get("/categories")
async def list_categories():
    docs = await db.categories.find({}, {"_id": 0}).to_list(200)
    return {"categories": [d["name"] for d in docs]}


@api.get("/regions")
async def list_regions():
    docs = await db.regions.find({}, {"_id": 0}).to_list(200)
    return {"regions": [d["name"] for d in docs]}


@api.get("/influencers")
async def list_influencers(
    q: Optional[str] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
    platform: Optional[str] = None,
    min_followers: Optional[int] = None,
    max_budget: Optional[int] = None,
    sort: str = Query("rating", pattern="^(rating|followers|price)$"),
    _=Depends(get_current_user),
):
    """Multi-facet influencer search used by the Discover feed."""
    filt: Dict[str, Any] = {"role": "influencer"}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
        ]
    if category:
        filt["category"] = category
    if region:
        filt["region"] = region
    if platform:
        filt["platforms"] = platform
    if min_followers:
        filt["followers"] = {"$gte": min_followers}
    if max_budget:
        filt["pricing.post"] = {"$lte": max_budget}

    sort_key = {"rating": "rating_avg", "followers": "followers", "price": "pricing.post"}[sort]
    docs = (
        await db.users.find(filt, {"_id": 0, "password_hash": 0, "phone": 0, "email": 0})
        .sort(sort_key, -1 if sort != "price" else 1)
        .to_list(200)
    )
    return {"influencers": docs}


@api.get("/leaderboard")
async def leaderboard(_=Depends(get_current_user)):
    """Top-rated influencers — used by rankings screen."""
    docs = (
        await db.users.find({"role": "influencer"}, {"_id": 0, "password_hash": 0, "phone": 0, "email": 0})
        .sort([("rating_avg", -1), ("followers", -1)]).to_list(50)
    )
    return {"leaders": docs}


# ---------------------------------------------------------------------------
# Collaboration requests + conversations
# ---------------------------------------------------------------------------
async def get_or_create_conversation(a: str, b: str) -> str:
    """Return the conversation_id that carries messages between two users."""
    pair = sorted([a, b])
    conv = await db.conversations.find_one({"participants": pair}, {"_id": 0})
    if conv:
        return conv["conversation_id"]
    cid = new_id("conv")
    await db.conversations.insert_one({
        "conversation_id": cid,
        "participants": pair,
        "created_at": now_utc(),
        "last_message_at": now_utc(),
        "last_message": None,
    })
    return cid


@api.post("/requests")
async def send_request(body: RequestIn, user=Depends(get_current_user)):
    """Send a collaboration request and open a conversation for chat."""
    if body.to_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot request yourself")
    target = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")
    conv_id = await get_or_create_conversation(user["user_id"], body.to_user_id)
    req_id = new_id("req")
    doc = {
        "request_id": req_id,
        "from_user_id": user["user_id"],
        "to_user_id": body.to_user_id,
        "conversation_id": conv_id,
        "message": body.message,
        "budget": body.budget,
        "deliverables": body.deliverables,
        "status": "pending",  # pending|accepted|rejected|finalized|paid|completed
        "contact_unlocked": False,
        "created_at": now_utc(),
    }
    await db.collab_requests.insert_one(doc)
    # Post an intro message in the conversation for context.
    await db.messages.insert_one({
        "message_id": new_id("msg"),
        "conversation_id": conv_id,
        "sender_id": user["user_id"],
        "text": body.message,
        "kind": "system",
        "offer": {"budget": body.budget, "deliverables": body.deliverables},
        "created_at": now_utc(),
    })
    return {"request": strip_mongo(doc)}


@api.get("/requests")
async def list_requests(box: str = Query("all", pattern="^(all|incoming|outgoing)$"),
                        user=Depends(get_current_user)):
    if box == "incoming":
        filt = {"to_user_id": user["user_id"]}
    elif box == "outgoing":
        filt = {"from_user_id": user["user_id"]}
    else:
        filt = {"$or": [{"to_user_id": user["user_id"]}, {"from_user_id": user["user_id"]}]}
    reqs = await db.collab_requests.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich with counterpart user snapshots so UI can render lists in one shot.
    ids = list({r["from_user_id"] for r in reqs} | {r["to_user_id"] for r in reqs})
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
    umap = {u["user_id"]: u for u in users}
    for r in reqs:
        r["from_user"] = umap.get(r["from_user_id"])
        r["to_user"] = umap.get(r["to_user_id"])
    return {"requests": reqs}


@api.patch("/requests/{request_id}")
async def update_request(request_id: str, body: RequestStatusIn, user=Depends(get_current_user)):
    r = await db.collab_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if r["to_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only recipient can update")
    await db.collab_requests.update_one({"request_id": request_id}, {"$set": {"status": body.status}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Chat — WebSocket + REST fallback
# ---------------------------------------------------------------------------
class ConnectionManager:
    """Very small in-memory pub/sub keyed by conversation_id.

    For a single-instance backend this is sufficient. In a multi-node
    deployment, swap the internal dict for a Redis pub/sub bridge.
    """
    def __init__(self):
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, conv_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(conv_id, []).append(ws)

    def disconnect(self, conv_id: str, ws: WebSocket):
        if conv_id in self.rooms and ws in self.rooms[conv_id]:
            self.rooms[conv_id].remove(ws)

    async def broadcast(self, conv_id: str, payload: dict):
        dead: List[WebSocket] = []
        for ws in self.rooms.get(conv_id, []):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(conv_id, d)


manager = ConnectionManager()


async def _persist_message(conv_id: str, sender_id: str, text: str,
                           kind: str = "text", offer: Optional[dict] = None) -> dict:
    msg = {
        "message_id": new_id("msg"),
        "conversation_id": conv_id,
        "sender_id": sender_id,
        "text": text,
        "kind": kind,
        "offer": offer,
        "created_at": now_utc(),
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one(
        {"conversation_id": conv_id},
        {"$set": {"last_message_at": now_utc(), "last_message": text}},
    )
    return strip_mongo(msg)


@api.get("/conversations")
async def my_conversations(user=Depends(get_current_user)):
    convs = await db.conversations.find(
        {"participants": user["user_id"]}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(200)
    ids = list({p for c in convs for p in c["participants"]} - {user["user_id"]})
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(200)
    umap = {u["user_id"]: u for u in users}
    for c in convs:
        other = next((p for p in c["participants"] if p != user["user_id"]), None)
        c["peer"] = umap.get(other)
    return {"conversations": convs}


@api.get("/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, user=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": conv_id}, {"_id": 0})
    if not conv or user["user_id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Fetch latest request between the two so UI can render negotiation state.
    other = next((p for p in conv["participants"] if p != user["user_id"]), None)
    req = await db.collab_requests.find_one(
        {"$or": [
            {"from_user_id": user["user_id"], "to_user_id": other},
            {"from_user_id": other, "to_user_id": user["user_id"]},
        ]},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return {"messages": msgs, "peer_id": other, "request": req}


@api.post("/messages")
async def send_message_rest(body: MessageIn, user=Depends(get_current_user)):
    """REST fallback for sending a message when the WebSocket isn't available."""
    conv = await db.conversations.find_one({"conversation_id": body.conversation_id}, {"_id": 0})
    if not conv or user["user_id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Not a participant")
    msg = await _persist_message(body.conversation_id, user["user_id"], body.text, body.kind, body.offer)
    await manager.broadcast(body.conversation_id, {"type": "message", "message": _json_safe(msg)})
    return {"message": msg}


def _json_safe(obj: Any) -> Any:
    """Recursively convert datetimes to ISO strings for JSON transport."""
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


@app.websocket("/api/ws/chat/{conversation_id}")
async def ws_chat(ws: WebSocket, conversation_id: str, token: str):
    """Real-time chat socket. Auth via ?token=<session_token> query param.

    Frontend uses this because RN's WebSocket doesn't support custom headers.
    """
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        await ws.close(code=4401)
        return
    conv = await db.conversations.find_one({"conversation_id": conversation_id}, {"_id": 0})
    if not conv or session["user_id"] not in conv["participants"]:
        await ws.close(code=4403)
        return

    await manager.connect(conversation_id, ws)
    try:
        while True:
            data = await ws.receive_json()
            text = (data.get("text") or "").strip()
            if not text:
                continue
            kind = data.get("kind") or "text"
            offer = data.get("offer")
            msg = await _persist_message(conversation_id, session["user_id"], text, kind, offer)
            await manager.broadcast(conversation_id, {"type": "message", "message": _json_safe(msg)})
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, ws)
    except Exception as e:
        logger.exception("ws error: %s", e)
        manager.disconnect(conversation_id, ws)


# ---------------------------------------------------------------------------
# Contact-unlock payment (Razorpay — LIVE when keys present, MOCK otherwise)
# ---------------------------------------------------------------------------
@api.post("/payments/create-order")
async def create_order(body: PaymentInitIn, user=Depends(get_current_user)):
    """Create a Razorpay order for the contact-unlock fee.

    Uses the real Razorpay Orders API when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
    are present in env; falls back to a mock order (order_MOCK…) otherwise.
    """
    req = await db.collab_requests.find_one({"request_id": body.request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if user["user_id"] not in (req["from_user_id"], req["to_user_id"]):
        raise HTTPException(status_code=403, detail="Not your request")

    # Look up counterpart & determine fee from their unlock_tier
    counterpart_id = req["to_user_id"] if req["from_user_id"] == user["user_id"] else req["from_user_id"]
    counterpart = await db.users.find_one({"user_id": counterpart_id}, {"_id": 0})
    tier = (counterpart or {}).get("unlock_tier", "basic")
    amount_inr = UNLOCK_TIER_FEES.get(tier, 10)
    amount_paise = amount_inr * 100

    if RAZORPAY_LIVE and razorpay_client is not None:
        # ---- LIVE Razorpay ----
        def _create():
            return razorpay_client.order.create(dict(
                amount=amount_paise, currency="INR",
                receipt=body.request_id, payment_capture=1,
                notes={"request_id": body.request_id, "user_id": user["user_id"]},
            ))
        try:
            rp_order = await run_in_threadpool(_create)
        except Exception as e:
            logger.exception("razorpay order.create failed: %s", e)
            raise HTTPException(status_code=502, detail="Payment gateway error")
        order = {
            "id": rp_order["id"], "amount": rp_order["amount"],
            "currency": rp_order["currency"], "status": rp_order["status"],
            "receipt": rp_order.get("receipt"),
        }
        mock = False
    else:
        # ---- MOCK ----
        order = {
            "id": f"order_MOCK{uuid.uuid4().hex[:14]}",
            "amount": amount_paise, "currency": "INR",
            "status": "created", "receipt": body.request_id,
        }
        mock = True

    await db.payments.insert_one({
        "order_id": order["id"],
        "request_id": body.request_id,
        "user_id": user["user_id"],
        "amount_inr": amount_inr,
        "status": "created",
        "created_at": now_utc(),
        "mock": mock,
    })
    return {
        "order": order,
        "amount_inr": amount_inr,
        "key_id": RAZORPAY_KEY_ID or "rzp_test_MOCK_KEY",
        "mock": mock,
    }


@api.post("/payments/verify")
async def verify_payment(body: PaymentVerifyIn, user=Depends(get_current_user)):
    """Verify Razorpay HMAC signature (live) or accept any signature (mock)."""
    payment = await db.payments.find_one({"order_id": body.razorpay_order_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Order not found")
    if payment["request_id"] != body.request_id:
        raise HTTPException(status_code=400, detail="Order/request mismatch")

    is_mock = payment.get("mock") or body.razorpay_order_id.startswith("order_MOCK")
    if not is_mock:
        # LIVE — HMAC_SHA256(order_id|payment_id, key_secret) must equal signature.
        payload = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
        expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, body.razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid signature")

    await db.payments.update_one(
        {"order_id": body.razorpay_order_id},
        {"$set": {"status": "paid", "payment_id": body.razorpay_payment_id, "paid_at": now_utc()}},
    )
    # Reveal contact — flip flag on the collab request so both sides can now see contact.
    await db.collab_requests.update_one(
        {"request_id": body.request_id},
        {"$set": {"contact_unlocked": True, "status": "finalized"}},
    )
    req = await db.collab_requests.find_one({"request_id": body.request_id}, {"_id": 0})
    if req:
        await _persist_message(
            req["conversation_id"], user["user_id"],
            "Contact details unlocked. You can now share campaign specifics.",
            kind="system",
            offer={"unlocked": True},
        )
        await manager.broadcast(req["conversation_id"], {"type": "unlock", "request_id": body.request_id})
    return {"ok": True}


@api.get("/requests/{request_id}/contact")
async def get_contact(request_id: str, user=Depends(get_current_user)):
    """Return the counterpart's private contact info — gated on payment."""
    r = await db.collab_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if user["user_id"] not in (r["from_user_id"], r["to_user_id"]):
        raise HTTPException(status_code=403, detail="Not your request")
    if not r.get("contact_unlocked"):
        raise HTTPException(status_code=402, detail="Contact locked — unlock via payment")
    other_id = r["to_user_id"] if r["from_user_id"] == user["user_id"] else r["from_user_id"]
    other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password_hash": 0})
    return {"contact": {
        "email": other.get("email"),
        "phone": other.get("phone"),
        "social_handles": other.get("social_handles"),
        "name": other.get("name"),
    }}


# ---------------------------------------------------------------------------
# Campaigns + Reviews
# ---------------------------------------------------------------------------
@api.post("/campaigns")
async def create_campaign(body: CampaignIn, user=Depends(get_current_user)):
    r = await db.collab_requests.find_one({"request_id": body.request_id}, {"_id": 0})
    if not r or user["user_id"] not in (r["from_user_id"], r["to_user_id"]):
        raise HTTPException(status_code=403, detail="Not allowed")
    if not r.get("contact_unlocked"):
        raise HTTPException(status_code=400, detail="Unlock contact before creating a campaign")
    cid = new_id("cmp")
    doc = {
        "campaign_id": cid,
        "request_id": body.request_id,
        "business_id": r["from_user_id"],  # convention: requester creates the campaign brief
        "influencer_id": r["to_user_id"],
        "title": body.title,
        "deliverables": body.deliverables,
        "price": body.price,
        "deadline": body.deadline,
        "status": "active",
        "attachments": [],
        "notes": None,
        "created_at": now_utc(),
    }
    await db.campaigns.insert_one(doc)
    return {"campaign": strip_mongo(doc)}


@api.get("/campaigns")
async def list_campaigns(user=Depends(get_current_user)):
    docs = await db.campaigns.find({
        "$or": [{"business_id": user["user_id"]}, {"influencer_id": user["user_id"]}]
    }, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"campaigns": docs}


@api.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignStatusIn, user=Depends(get_current_user)):
    c = await db.campaigns.find_one({"campaign_id": campaign_id}, {"_id": 0})
    if not c or user["user_id"] not in (c["business_id"], c["influencer_id"]):
        raise HTTPException(status_code=403, detail="Not allowed")
    updates: Dict[str, Any] = {"status": body.status}
    if body.attachments is not None:
        updates["attachments"] = body.attachments
    if body.notes is not None:
        updates["notes"] = body.notes
    await db.campaigns.update_one({"campaign_id": campaign_id}, {"$set": updates})
    return {"ok": True}


@api.post("/reviews")
async def submit_review(body: ReviewIn, user=Depends(get_current_user)):
    c = await db.campaigns.find_one({"campaign_id": body.campaign_id}, {"_id": 0})
    if not c or user["user_id"] not in (c["business_id"], c["influencer_id"]):
        raise HTTPException(status_code=403, detail="Not allowed")
    reviewee = c["influencer_id"] if user["user_id"] == c["business_id"] else c["business_id"]
    await db.reviews.insert_one({
        "review_id": new_id("rev"),
        "campaign_id": body.campaign_id,
        "reviewer_id": user["user_id"],
        "reviewee_id": reviewee,
        "rating": body.rating,
        "comment": body.comment,
        "created_at": now_utc(),
    })
    # Recompute reviewee's rating aggregate.
    pipeline = [
        {"$match": {"reviewee_id": reviewee}},
        {"$group": {"_id": "$reviewee_id", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
    ]
    agg = await db.reviews.aggregate(pipeline).to_list(1)
    if agg:
        await db.users.update_one(
            {"user_id": reviewee},
            {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["n"]}},
        )
    return {"ok": True}


@api.get("/reviews/{user_id}")
async def get_reviews(user_id: str, _=Depends(get_current_user)):
    docs = await db.reviews.find({"reviewee_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"reviews": docs}


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
async def admin_dep(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@api.get("/admin/analytics")
async def admin_analytics(_=Depends(admin_dep)):
    users_count = await db.users.count_documents({})
    influencers = await db.users.count_documents({"role": "influencer"})
    businesses = await db.users.count_documents({"role": "business"})
    requests_count = await db.collab_requests.count_documents({})
    finalized = await db.collab_requests.count_documents({"contact_unlocked": True})
    payments = await db.payments.count_documents({"status": "paid"})
    campaigns = await db.campaigns.count_documents({})
    revenue_agg = await db.payments.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "sum": {"$sum": "$amount_inr"}}}
    ]).to_list(1)
    revenue = revenue_agg[0]["sum"] if revenue_agg else 0
    return {
        "users": users_count,
        "influencers": influencers,
        "businesses": businesses,
        "requests": requests_count,
        "finalized_deals": finalized,
        "payments": payments,
        "campaigns": campaigns,
        "revenue_inr": revenue,
    }


@api.get("/admin/users")
async def admin_users(role: Optional[str] = None, _=Depends(admin_dep)):
    filt = {"role": role} if role else {}
    docs = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return {"users": docs}


@api.patch("/admin/users/{user_id}/verify")
async def admin_verify(user_id: str, body: dict, _=Depends(admin_dep)):
    await db.users.update_one({"user_id": user_id}, {"$set": {"verified": bool(body.get("verified", True))}})
    return {"ok": True}


@api.delete("/admin/users/{user_id}")
async def admin_delete(user_id: str, _=Depends(admin_dep)):
    await db.users.delete_one({"user_id": user_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Uploads (Emergent Object Storage) + file serving
# ---------------------------------------------------------------------------
def _short_lived_file_token(user_id: str) -> str:
    """A tiny signed token so <img> tags on web can auth via query string."""
    payload = f"{user_id}|{int(datetime.now(tz=timezone.utc).timestamp())}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}|{sig}"


def _verify_file_token(token: str) -> Optional[str]:
    try:
        uid, ts, sig = token.split("|")
        payload = f"{uid}|{ts}"
        expected = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
        if not hmac.compare_digest(expected, sig):
            return None
        if datetime.now(tz=timezone.utc).timestamp() - int(ts) > 60 * 60:  # 1 hour
            return None
        return uid
    except Exception:
        return None


@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Multipart upload → object storage. Returns storage path stored on the record."""
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:  # 8MB cap
        raise HTTPException(status_code=413, detail="File too large (max 8MB)")
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower()[:6] or "bin"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    ct = file.content_type or "application/octet-stream"
    try:
        result = await run_in_threadpool(put_object, path, data, ct)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("upload failed: %s", e)
        raise HTTPException(status_code=500, detail="Upload failed")
    await db.files.insert_one({
        "storage_path": result["path"], "owner_id": user["user_id"],
        "content_type": ct, "size": result.get("size", len(data)),
        "created_at": now_utc(),
    })
    return {
        "path": result["path"],
        "url": f"/api/files/{result['path']}",
        "file_token": _short_lived_file_token(user["user_id"]),
    }


@api.get("/files/{path:path}")
async def serve_file(path: str, authorization: Optional[str] = Header(default=None),
                     token: Optional[str] = None):
    """Serve stored objects, gated by Bearer OR short-lived token query param.

    Ownership check: the requester must be the owner or an admin.
    """
    requester_id: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        sess = await db.user_sessions.find_one({"session_token": authorization.split(" ", 1)[1].strip()}, {"_id": 0})
        if sess:
            requester_id = sess["user_id"]
    if not requester_id and token:
        requester_id = _verify_file_token(token)
    if not requester_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    record = await db.files.find_one({"storage_path": path}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    requester = await db.users.find_one({"user_id": requester_id}, {"_id": 0})
    if record["owner_id"] != requester_id and (requester or {}).get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        content, ct = await run_in_threadpool(get_object, path)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_object failed: %s", e)
        raise HTTPException(status_code=500, detail="Read failed")
    return Response(content=content, media_type=ct)


# ---------------------------------------------------------------------------
# Verification — creators submit Government ID + social profile links,
# admins review and either approve (sets user.verified=true) or reject.
# ---------------------------------------------------------------------------
class VerificationIn(BaseModel):
    id_document_path: str            # storage path returned by /api/upload
    id_document_type: str = Field(default="government_id")
    social_links: Dict[str, str]     # {"instagram": "https://...", "youtube": "..."}
    full_name: str
    notes: Optional[str] = None


class VerificationReviewIn(BaseModel):
    status: str = Field(pattern="^(approved|rejected)$")
    reason: Optional[str] = None


@api.post("/verifications")
async def submit_verification(body: VerificationIn, user=Depends(get_current_user)):
    """Creators submit proof. Overwrites any prior pending/rejected submission."""
    if user.get("role") != "influencer":
        raise HTTPException(status_code=403, detail="Only creators can request verification")
    # Ensure the ID doc belongs to the caller (prevents cross-user references).
    record = await db.files.find_one({"storage_path": body.id_document_path}, {"_id": 0})
    if not record or record["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid document reference")

    existing = await db.verifications.find_one({"user_id": user["user_id"]}, {"_id": 0})
    doc = {
        "verification_id": new_id("ver"),
        "user_id": user["user_id"],
        "full_name": body.full_name,
        "id_document_path": body.id_document_path,
        "id_document_type": body.id_document_type,
        "social_links": body.social_links,
        "notes": body.notes,
        "status": "pending",
        "review_reason": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": now_utc(),
    }
    if existing:
        await db.verifications.update_one(
            {"user_id": user["user_id"]},
            {"$set": {k: v for k, v in doc.items() if k not in ("verification_id",)}},
        )
        return {"verification": {**existing, **doc, "verification_id": existing.get("verification_id", doc["verification_id"])}}
    await db.verifications.insert_one(doc)
    return {"verification": strip_mongo(doc)}


@api.get("/verifications/me")
async def my_verification(user=Depends(get_current_user)):
    v = await db.verifications.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"verification": v}


@api.get("/admin/verifications")
async def list_verifications(status_filter: str = Query("all", pattern="^(all|pending|approved|rejected)$"),
                             _=Depends(admin_dep)):
    filt: Dict[str, Any] = {}
    if status_filter != "all":
        filt["status"] = status_filter
    docs = await db.verifications.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Enrich with user snapshots
    ids = list({d["user_id"] for d in docs})
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(500)
    umap = {u["user_id"]: u for u in users}
    for d in docs:
        d["user"] = umap.get(d["user_id"])
    return {"verifications": docs}


@api.patch("/admin/verifications/{verification_id}")
async def review_verification(verification_id: str, body: VerificationReviewIn, admin=Depends(admin_dep)):
    v = await db.verifications.find_one({"verification_id": verification_id}, {"_id": 0})
    if not v:
        raise HTTPException(status_code=404, detail="Not found")
    await db.verifications.update_one(
        {"verification_id": verification_id},
        {"$set": {
            "status": body.status,
            "review_reason": body.reason,
            "reviewed_by": admin["user_id"],
            "reviewed_at": now_utc(),
        }},
    )
    # If approved, mark the user as verified — surfaces the badge in Discover.
    if body.status == "approved":
        await db.users.update_one({"user_id": v["user_id"]}, {"$set": {"verified": True}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Saved Searches — one-tap filter presets for brands.
# ---------------------------------------------------------------------------
class SavedSearchIn(BaseModel):
    name: str
    filters: Dict[str, Any]   # {"category": "Fashion", "region": "Mumbai", "max_budget": 50000, "platform": "instagram"}


@api.post("/saved-searches")
async def create_saved_search(body: SavedSearchIn, user=Depends(get_current_user)):
    doc = {
        "search_id": new_id("srch"),
        "user_id": user["user_id"],
        "name": body.name,
        "filters": body.filters,
        "created_at": now_utc(),
    }
    await db.saved_searches.insert_one(doc)
    return {"saved_search": strip_mongo(doc)}


@api.get("/saved-searches")
async def list_saved_searches(user=Depends(get_current_user)):
    docs = await db.saved_searches.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"saved_searches": docs}


@api.delete("/saved-searches/{search_id}")
async def delete_saved_search(search_id: str, user=Depends(get_current_user)):
    res = await db.saved_searches.delete_one({"search_id": search_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def health():
    return {
        "ok": True,
        "service": "collabspace",
        "time": now_utc().isoformat(),
        "razorpay_live": RAZORPAY_LIVE,
        "storage_ready": bool(EMERGENT_KEY),
    }


app.include_router(api)

# Mobile apps don't send Origin; open CORS is fine.
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
