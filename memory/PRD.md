# CollabSpace — Product Requirements (v1.1)

## Vision
A trusted two-sided marketplace where **businesses/brands** discover **influencers/content creators** for paid promotions, negotiate through in-app chat, unlock contacts only after a small platform fee, execute campaigns, and rate each other.

## User Roles
- **Influencer / Creator** — profile with category, region, socials, reach, portfolio, pricing tiers, unlock tier (₹10/₹49/₹99).
- **Business / Brand** — brand profile, industry, budget, discovery-first UX.
- **Admin** — moderation, verification review, platform analytics.

## Core Flow
`Discover → View Profile → Send Request → Chat → Negotiate → Pay Contact-Unlock → Exchange Contact → Campaign → Complete → Review`

## Implemented in v1.1 (Feb 2026)
### v1.0 (baseline)
- Email/password auth (bcrypt + opaque session token) **and** Emergent Google Auth.
- Discovery, requests, real-time WebSocket chat, negotiation cards.
- Contact-unlock payment, campaigns, reviews, admin panel.

### v1.1 additions
1. **Verification Badge**  
   - Creators submit Government ID (photo → Emergent Object Storage) + Instagram/YouTube profile links via `/verification`.  
   - Admin reviews under `/admin-verifications` — approve sets `user.verified=true`; reject records a reason surfaced to the creator.  
   - Verified badge (cyan checkmark) shows in Discover creator cards and profile.
2. **Real Razorpay Integration**  
   - `POST /api/payments/create-order` uses `razorpay.Order.create()` when `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` are set.  
   - `POST /api/payments/verify` verifies HMAC-SHA256 of `order_id|payment_id` with `RAZORPAY_KEY_SECRET`.  
   - Automatically falls back to MOCK mode when keys are missing (health endpoint returns `razorpay_live` flag).
3. **Saved Searches**  
   - Brands can save the current Discover filter combo (category + region + query) with a name.  
   - Saved chips appear right below the search bar for one-tap re-use.  
   - Managed via `/saved-searches` screen.
4. **Emergent Object Storage**  
   - Multipart upload endpoint `POST /api/upload` (8MB cap).  
   - Ownership-gated read via `GET /api/files/{path}` (Bearer or short-lived signed query token).  
   - Used by the Verification flow; ready for portfolio/attachments.
5. **Dark navy + purple/cyan theme**  
   - Matches the CollabSpace infinity logo the user provided.  
   - Consistent gradient CTAs, glow shadows, glass overlays.

## Tech
- **Backend**: FastAPI + Motor (MongoDB) + native WebSocket + razorpay-python + `requests` (for Emergent Object Storage).
- **Frontend**: Expo SDK 54 + expo-router + expo-image + expo-image-picker + expo-linear-gradient + expo-blur + expo-web-browser + expo-linking + expo-secure-store.
- **Storage**: MongoDB with TTL sessions; Emergent Object Storage for user-uploaded photos.

## Environment
- Backend `/app/backend/.env`: `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, optional `APP_JWT_SECRET`.
- Frontend `/app/frontend/.env`: `EXPO_PUBLIC_BACKEND_URL` (proxy handles `/api` and `/api/ws/*`).

## Deferred
- AI recommendations / campaign matching.
- Deal escrow, similar-creators strip (potential v1.2).
- Push notifications (only on request).
