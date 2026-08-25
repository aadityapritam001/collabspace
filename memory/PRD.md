# CollabSpace — Product Requirements (v1.0 MVP)

## Vision
A trusted two-sided marketplace where **businesses/brands** discover **influencers/content creators** for paid promotions, negotiate through in-app chat, unlock contacts only after a small platform fee, execute campaigns, and rate each other.

## User Roles
- **Influencer / Creator** — profile with category, region, socials, reach, portfolio, pricing tiers, unlock tier (₹10/₹49/₹99).
- **Business / Brand** — brand profile, industry, budget, discovery-first UX.
- **Admin** — moderation, verification, platform analytics.

## Core Flow
`Discover → View Profile → Send Request → Chat → Negotiate → Pay Contact-Unlock → Exchange Contact → Campaign → Complete → Review`

## Implemented in v1.0
1. **Auth**: Email/password (bcrypt + opaque session token stored in Mongo `user_sessions` + TTL) **and** Emergent Google Auth (`POST /api/auth/session` exchange).
2. **Profile management** with role-aware fields (creator: pricing/reach/handles; brand: industry/website).
3. **Discovery**: multi-facet search (`q`, category, region, platform, min_followers, max_budget, sort by rating/followers/price).
4. **Rankings/Leaderboard**: top rated creators.
5. **Collaboration Requests**: pending / accepted / rejected / finalized / paid states; enriched inbox with counterpart snapshots.
6. **Real-time Chat**: WebSocket at `/api/ws/chat/{conv}?token=<session_token>` with automatic REST fallback (`POST /api/messages`).
7. **Negotiation Cards**: system/offer messages rendered as distinct tactile modules.
8. **Contact-Unlock Payment (MOCK Razorpay)**: create-order → verify (any signature accepted in mock mode) → `contact_unlocked=true` → contact revealed via `/api/requests/{id}/contact`. Fee tier: basic ₹10, silver ₹49, gold ₹99.
9. **Campaigns**: gated on unlock; deliverables, price, deadline, status (`active|delivered|completed|cancelled`), notes.
10. **Reviews & Rating aggregation**: 1–5 stars + comment; recomputes `rating_avg` and `rating_count` on the reviewee.
11. **Admin panel**: analytics tiles (users, deals, revenue), user verification, deletion, role filters.

## Design
Personality: **"4 Tactile / Playful LIGHT"** (see `/app/design_guidelines.json`).
- Palette: Coral `#FF5A5F` primary, Mint `#00C49A` success, Yellow `#FFC300` accent, Light `#FCFCFA` surface.
- Sticky horizontal chip row, 2-col creator grid with gradient scrim on hero cards.
- Bottom-tabs (4 max): **Discover · Requests · Chat · Profile**.

## Tech
- **Backend**: FastAPI + Motor (MongoDB) + native WebSocket. Python 3, bcrypt, httpx (for Emergent OAuth exchange). All routes under `/api/*`.
- **Frontend**: Expo SDK 54 + expo-router (file-based). expo-image, expo-linear-gradient, expo-blur, expo-web-browser, expo-linking, expo-secure-store.
- **Storage**: MongoDB with indexes on `users.email`, `users.user_id`, `user_sessions.session_token` (unique + TTL).

## Environment
- Backend: `MONGO_URL`, `DB_NAME`, optional `APP_JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (unused while mock).
- Frontend: `EXPO_PUBLIC_BACKEND_URL` (proxy handles `/api` and `/api/ws/*`).

## Not in v1 (deferred)
- AI recommendations / campaign matching (explicitly out per user).
- Real Razorpay gateway (mock stubs ready to swap — just replace two code blocks in `server.py`).
- Push notifications (only on user request).
