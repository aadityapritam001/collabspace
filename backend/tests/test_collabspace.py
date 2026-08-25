"""CollabSpace comprehensive backend tests."""
import os
import time
import json
import uuid
import asyncio
import pytest
import requests
from websockets.sync.client import connect as ws_connect

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://creator-commerce-53.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

ADMIN = ("admin@collabspace.app", "Admin@123")
BRAND = ("brand@collabspace.app", "Brand@123")
CREATOR = ("creator@collabspace.app", "Creator@123")


@pytest.fixture(scope="module")
def session():
    return requests.Session()


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def brand_token(session):
    return _login(session, *BRAND)["session_token"]


@pytest.fixture(scope="module")
def creator_token(session):
    return _login(session, *CREATOR)["session_token"]


@pytest.fixture(scope="module")
def admin_token(session):
    return _login(session, *ADMIN)["session_token"]


def H(tok): return {"Authorization": f"Bearer {tok}"}


# --- health ---
def test_health(session):
    r = session.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("service") == "collabspace"


# --- auth ---
def test_login_all_seeded(session):
    for e, p in [ADMIN, BRAND, CREATOR]:
        d = _login(session, e, p)
        assert "session_token" in d and d["user"]["email"] == e


def test_register_and_login(session):
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": "Test@1234", "name": "TEST User", "role": "business"
    }, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "session_token" in body
    assert body["user"]["role"] == "business"
    # duplicate
    r2 = session.post(f"{API}/auth/register", json={
        "email": email, "password": "Test@1234", "name": "X", "role": "business"
    }, timeout=15)
    assert r2.status_code == 409


def test_auth_me_and_invalid(session, brand_token):
    r = session.get(f"{API}/auth/me", headers=H(brand_token), timeout=10)
    assert r.status_code == 200
    assert r.json()["user"]["email"] == BRAND[0]
    bad = session.get(f"{API}/auth/me", headers=H("nonexistent_token_xyz"), timeout=10)
    assert bad.status_code == 401


# --- discovery ---
def test_categories_regions(session, brand_token):
    c = session.get(f"{API}/categories", timeout=10).json()["categories"]
    r = session.get(f"{API}/regions", timeout=10).json()["regions"]
    assert len(c) >= 10 and len(r) >= 10
    assert "Fashion" in c and "Mumbai" in r


def test_list_influencers_filters(session, brand_token):
    r = session.get(f"{API}/influencers", headers=H(brand_token), timeout=10)
    assert r.status_code == 200
    infs = r.json()["influencers"]
    assert len(infs) >= 4
    r2 = session.get(f"{API}/influencers?category=Fashion", headers=H(brand_token)).json()["influencers"]
    assert all(i["category"] == "Fashion" for i in r2)
    r3 = session.get(f"{API}/influencers?region=Bengaluru", headers=H(brand_token)).json()["influencers"]
    assert all(i["region"] == "Bengaluru" for i in r3)
    r4 = session.get(f"{API}/influencers?platform=youtube", headers=H(brand_token)).json()["influencers"]
    assert all("youtube" in i.get("platforms", []) for i in r4)


# --- requests / conversations ---
@pytest.fixture(scope="module")
def creator_user(session, brand_token):
    infs = session.get(f"{API}/influencers?category=Fashion", headers=H(brand_token)).json()["influencers"]
    return next(i for i in infs if i["email_visible"] == False) if False else infs[0]


@pytest.fixture(scope="module")
def brand_user_id(session, brand_token):
    return session.get(f"{API}/auth/me", headers=H(brand_token)).json()["user"]["user_id"]


@pytest.fixture(scope="module")
def request_ctx(session, brand_token, creator_user):
    r = session.post(f"{API}/requests", headers=H(brand_token), json={
        "to_user_id": creator_user["user_id"],
        "message": "TEST_ Collab pitch",
        "budget": 20000,
        "deliverables": "1 reel + 2 stories",
    }, timeout=15)
    assert r.status_code == 200, r.text
    req = r.json()["request"]
    assert req["from_user_id"] and req["to_user_id"] == creator_user["user_id"]
    assert req["conversation_id"]
    return req


def test_request_self_400(session, brand_token, brand_user_id):
    r = session.post(f"{API}/requests", headers=H(brand_token), json={
        "to_user_id": brand_user_id, "message": "self"
    })
    assert r.status_code == 400


def test_requests_boxes(session, brand_token, creator_token, request_ctx):
    outb = session.get(f"{API}/requests?box=outgoing", headers=H(brand_token)).json()["requests"]
    inc = session.get(f"{API}/requests?box=incoming", headers=H(creator_token)).json()["requests"]
    assert any(r["request_id"] == request_ctx["request_id"] for r in outb)
    assert any(r["request_id"] == request_ctx["request_id"] for r in inc)


def test_patch_request_forbidden_then_accept(session, brand_token, creator_token, request_ctx):
    # brand is sender, cannot patch
    bad = session.patch(f"{API}/requests/{request_ctx['request_id']}",
                        headers=H(brand_token), json={"status": "accepted"})
    assert bad.status_code == 403
    ok = session.patch(f"{API}/requests/{request_ctx['request_id']}",
                       headers=H(creator_token), json={"status": "accepted"})
    assert ok.status_code == 200


def test_conversations_and_messages(session, brand_token, request_ctx):
    convs = session.get(f"{API}/conversations", headers=H(brand_token)).json()["conversations"]
    conv = next(c for c in convs if c["conversation_id"] == request_ctx["conversation_id"])
    assert conv.get("peer")
    msgs = session.get(f"{API}/conversations/{request_ctx['conversation_id']}/messages",
                       headers=H(brand_token)).json()
    assert "messages" in msgs and msgs["peer_id"] and msgs["request"]
    assert len(msgs["messages"]) >= 1  # system intro
    # REST send
    r = session.post(f"{API}/messages", headers=H(brand_token), json={
        "conversation_id": request_ctx["conversation_id"], "text": "TEST_ hello", "kind": "text"
    })
    assert r.status_code == 200
    assert r.json()["message"]["text"] == "TEST_ hello"


def test_websocket_chat(brand_token, request_ctx):
    url = f"{WS_BASE}/api/ws/chat/{request_ctx['conversation_id']}?token={brand_token}"
    with ws_connect(url, open_timeout=10) as ws:
        ws.send(json.dumps({"text": "TEST_ ws hello"}))
        raw = ws.recv(timeout=5)
        data = json.loads(raw)
        assert data["type"] == "message"
        assert data["message"]["text"] == "TEST_ ws hello"


# --- payments (mock) + contact unlock ---
def test_contact_locked_then_unlock_flow(session, brand_token, creator_token, request_ctx):
    locked = session.get(f"{API}/requests/{request_ctx['request_id']}/contact",
                         headers=H(brand_token))
    assert locked.status_code == 402
    order = session.post(f"{API}/payments/create-order", headers=H(brand_token),
                        json={"request_id": request_ctx["request_id"]}).json()
    assert order["order"]["id"].startswith("order_MOCK")
    assert order["amount_inr"] in (10, 49, 99)
    v = session.post(f"{API}/payments/verify", headers=H(brand_token), json={
        "request_id": request_ctx["request_id"],
        "razorpay_order_id": order["order"]["id"],
        "razorpay_payment_id": "pay_MOCK_" + uuid.uuid4().hex[:10],
        "razorpay_signature": "sig_MOCK",
    })
    assert v.status_code == 200 and v.json()["ok"]
    c = session.get(f"{API}/requests/{request_ctx['request_id']}/contact",
                    headers=H(brand_token))
    assert c.status_code == 200
    assert c.json()["contact"]["name"]


# --- campaign requires unlock ---
def test_campaign_requires_unlock_then_lifecycle(session, brand_token, creator_token, request_ctx):
    # Create a NEW request that we DON'T unlock to test rejection
    creators = session.get(f"{API}/influencers?category=Tech", headers=H(brand_token)).json()["influencers"]
    tech = creators[0]
    fresh = session.post(f"{API}/requests", headers=H(brand_token), json={
        "to_user_id": tech["user_id"], "message": "TEST_ tech pitch", "budget": 30000,
    }).json()["request"]
    bad = session.post(f"{API}/campaigns", headers=H(brand_token), json={
        "request_id": fresh["request_id"], "title": "X", "deliverables": "Y", "price": 1000,
    })
    assert bad.status_code == 400
    # Use unlocked request from prior test
    ok = session.post(f"{API}/campaigns", headers=H(brand_token), json={
        "request_id": request_ctx["request_id"],
        "title": "TEST_ Campaign", "deliverables": "1 reel", "price": 20000,
    })
    assert ok.status_code == 200
    cmp_id = ok.json()["campaign"]["campaign_id"]
    # list
    lst = session.get(f"{API}/campaigns", headers=H(brand_token)).json()["campaigns"]
    assert any(c["campaign_id"] == cmp_id for c in lst)
    # patch status
    p = session.patch(f"{API}/campaigns/{cmp_id}", headers=H(brand_token),
                     json={"status": "delivered"})
    assert p.status_code == 200
    # review by creator
    rev = session.post(f"{API}/reviews", headers=H(creator_token), json={
        "campaign_id": cmp_id, "rating": 5, "comment": "TEST_ great"
    })
    assert rev.status_code == 200
    # brand rating updated
    brand_id = session.get(f"{API}/auth/me", headers=H(brand_token)).json()["user"]["user_id"]
    u = session.get(f"{API}/users/{brand_id}", headers=H(brand_token)).json()["user"]
    assert u["rating_count"] >= 1 and u["rating_avg"] >= 1


# --- admin ---
def test_admin_endpoints(session, admin_token, brand_token):
    a = session.get(f"{API}/admin/analytics", headers=H(admin_token))
    assert a.status_code == 200
    body = a.json()
    for k in ["users", "influencers", "businesses", "requests", "payments", "revenue_inr"]:
        assert k in body
    forbidden = session.get(f"{API}/admin/analytics", headers=H(brand_token))
    assert forbidden.status_code == 403
    users = session.get(f"{API}/admin/users?role=influencer", headers=H(admin_token)).json()["users"]
    assert len(users) >= 4
    target = users[-1]["user_id"]
    v = session.patch(f"{API}/admin/users/{target}/verify", headers=H(admin_token),
                     json={"verified": True})
    assert v.status_code == 200


# --- cleanup: remove TEST_ registered user(s) via admin ---
def test_zz_cleanup(session, admin_token):
    users = session.get(f"{API}/admin/users", headers=H(admin_token)).json()["users"]
    for u in users:
        if u.get("email", "").startswith("TEST_"):
            session.delete(f"{API}/admin/users/{u['user_id']}", headers=H(admin_token))
