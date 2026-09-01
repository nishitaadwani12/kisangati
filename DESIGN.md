# KisanGati — Technical Design (Locked v1.4)

> Canonical architecture + tech decisions for KisanGati. Read alongside `CLAUDE.md`
> (business context), `specs/` (per-component specs), and the prototype build plan. Decisions
> here are **locked** unless explicitly revised in a later commit. Business numbers in
> `CLAUDE.md` remain unvalidated drafts; this doc is about *how we build*, not *what the
> margins are*. Sections carry a **[BUILT]** / **[PLANNED]** marker where relevant.

## 0. Build status (what exists today)

**Built and tested:**
- Backend API (Node + TS + Express) + **Prisma on SQLite** (day-1 DB).
- **Multi-tenant auth:** `Shop` + `AdminUser`, email+password (bcrypt) → **JWT**; roles
  `SUPER_ADMIN` / `OWNER` / `STAFF`; every `/api` route shop-scoped (cross-shop → 404).
  Controlled onboarding via a super-admin **Add-shop** flow (no public self-sign-up).
- **Order lifecycle** end-to-end: `RECEIVED → QUOTED → PAID → DISPATCHED → DELIVERED`, with
  manual **UPI QR** + **UTR-required** payment confirm, dispatch (bus route + conductor),
  staff-confirmed delivery (**no OTP** — see §6), and mistri cashback.
- **Two-tier pricing** (farmer vs mistri) with guardrails; **organic catalog** (autocomplete +
  duplicate-proof match-key — no onboarding/stock chore).
- **WhatsApp intake:** public webhook (token-verified) → routes to a shop by `phone_number_id`,
  creates a `RECEIVED` order from text/voice/photo, dedupes retries, sends a Hindi auto-reply,
  and **downloads the voice/photo file** (stored under `/media`, playable/viewable in the dashboard).
- **React/Vite admin dashboard**: login, orders inbox + detail workflow, catalog, customers,
  home stats, super-admin **Shops** page + shop switcher, **HI|EN** language toggle.
- Money stored in **paise** (integers) throughout. Demo seed across two shops.

**Not built yet (planned):** the `ml-service` (part-ID + STT), the Flutter customer app, Redis,
Razorpay auto-confirm, object storage (media is on local disk for now), in-chat UPI QR delivery,
deployment. Multi-tenant data
isolation is **already built** (ahead of the original "long-term" plan) because a relative's
shop will be onboarded as a real second tenant for end-to-end testing.

## 1. Product framing — customer app + internal web dashboard, WhatsApp as a channel

KisanGati has two purpose-built surfaces plus WhatsApp:

- **Customer app (Flutter, Android):** for `FARMER` and `MISTRI`. WhatsApp is a **kickoff /
  low-friction channel** feeding the same backend — the long-term goal is to graduate users
  onto the app, without ever forcibly retiring WhatsApp (some farmers always prefer it).
- **Internal admin dashboard (React web):** operated **by us only** — order processing,
  SKU match, payments, dispatch, analytics. A web panel is right here because it's
  internal/back-office (not customer-facing), and iterates far faster than an APK.

There are **two kinds of identity** (don't conflate them):
- **Customer records** (`FARMER` / `MISTRI`) — people who order; no dashboard login. Farmers
  use WhatsApp/app, mistris the app. (Their app auth = phone+OTP, planned.)
- **Dashboard login accounts** (`AdminUser`, roles `SUPER_ADMIN` / `OWNER` / `STAFF`) — staff
  who operate the web dashboard, email+password → JWT. **[BUILT]** (§ auth below).

| Who | Surface | Experience |
|---|---|---|
| `FARMER` (customer) | Customer app + WhatsApp | Zero-friction: voice-note / photo ordering, big icons, Hindi voice UI. |
| `MISTRI` (customer) | Customer app | Full catalog by brand/model, cart, reorder, **wallet/cashback (3–5%)**, referrals. |
| `OWNER` / `STAFF` (login) | Web dashboard | Their shop only: inbox, part match, UPI QR + manual confirm, dispatch (route + conductor), mark delivered, walk-in onboarding, analytics. |
| `SUPER_ADMIN` (login) | Web dashboard | Network-wide view across all shops + shop switcher; onboards new shops. |

**Walk-in onboarding (first-class flow):** at the counter, staff create the user and
introduce **both** surfaces together — install/QR the app *and* save the WhatsApp number —
tagged `acquisition_channel = WALK_IN`.

### Long-term vision
1. **Multi-tenant marketplace [tenant model BUILT; storefront PLANNED]:** the `Shop` +
   `shopId` isolation and super-admin shop onboarding are **already implemented** — each shop
   is a tenant seeing only its own data; the founder gets a network-wide view. Still deferred:
   public shop self-sign-up, per-shop billing, granular staff permissions.
2. **Mistri services marketplace [PLANNED]:** farmers book **repair services from nearby mistris**
   (not just parts); mistri earns commission on labor jobs too. Deepens mistri loyalty and
   makes KisanGati a rural-repair platform, not only a parts shop. See §7.

## 2. Architecture

```
  Farmers ───WhatsApp───┐
                        │
  Farmers/Mistris ─App──┤
                        ├──► Backend API (Node + TypeScript + Express) ──► PostgreSQL
  Shop staff ─Web admin─┘            │                                        │
                                     ├─► Redis (queue / cache / OTP + sessions)
                                     ├─► Meta WhatsApp Cloud API (inbound + outbound)
                                     ├─► Razorpay (UPI links + payment webhooks)
                                     ├─► Object storage (voice notes / part photos)
                                     ├─► Firebase Cloud Messaging (push)
                                     └─► ML service (Python/FastAPI) ──► part-ID model + STT
                                              ▲
                                              └── labeled data flows back from every
                                                  human-resolved order (see §9)
```

Single shared database. Every order and user is tagged for audit/analytics (see §5).

> **Current build vs target:** the diagram is the *target*. Today only the Backend API +
> database (on **SQLite**, not Postgres yet) and the React dashboard exist. Redis, WhatsApp
> Cloud API, Razorpay, object storage, FCM, and the ML service are **planned** (see §0).

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Customer app | **Flutter (Dart)** | Farmers + mistris. One codebase, strong on low-end Android, good offline + Devanagari rendering, small APK. Libs: `dio`, `riverpod`, `drift`/`sqflite` (offline cache), `razorpay_flutter`, `firebase_messaging`. |
| Admin dashboard | **React + Vite (web)** | Internal, operated by us. Fast to iterate; back-office only, so it doesn't dilute the app-first story. Long-term becomes the multi-tenant seller portal. |
| Backend/API | **Node.js + TypeScript + Express** | REST + JSON. **[BUILT]** All money handled in **paise** (integers) — no floats. |
| Database | **Prisma**; **SQLite now** → PostgreSQL later | **[BUILT on SQLite]** Enum-like columns are strings and JSON columns are strings for SQLite portability; Prisma makes the Postgres switch trivial. |
| Queue/cache | **Redis** | **[PLANNED]** Async jobs (media download, WhatsApp send retries, payment reconciliation), OTP + session cache. Not wired yet. |
| WhatsApp | **Meta WhatsApp Cloud API** | **[BUILT — intake + auto-reply]** Public webhook, token-verified GET, per-shop routing by `phone_number_id`, dedupe on message id, Hindi auto-ack. Media *download* deferred. Move to a BSP (e.g. AiSensy) only if templated marketing at scale is needed. |
| Payments | **Manual UPI QR** → Razorpay-ready | **[BUILT]** Send a UPI QR / `upi://` link, staff **confirm manually with a required UTR** (forces verifying the transfer landed — a screenshot is not proof). No COD. `payments` table stores `method`, `utr`, `confirmed_by` so **Razorpay dynamic QR + webhook auto-confirm** drops in later as a config change. |
| Auth | **Email + password (bcrypt) → JWT** | **[BUILT]** Dashboard login accounts (`AdminUser`); roles `SUPER_ADMIN` / `OWNER` / `STAFF`; all `/api` routes shop-scoped. Customer app auth (phone+OTP) is separate and **[PLANNED]**. |
| Dashboard i18n | In-app **HI \| EN** toggle | **[BUILT]** Persisted per browser; full Hindi for nav, labels, statuses. |
| Media | Local disk (prototype) → **S3 / Cloudflare R2** (prod) | **[PLANNED]** Voice `.ogg`, part/nameplate photos. |
| Push | **Firebase Cloud Messaging** | **[PLANNED]** Order status → buyer; new order → shop. |
| **ML service** | **Python + FastAPI** (separate microservice) | **[PLANNED]** Serves part-identification + speech-to-text. Called by the Node backend over HTTP. Kept separate so Python ML tooling stays out of the Node app. See §9. |
| **Speech-to-text** | Hosted API first (Google STT or self-hosted Whisper) → dialect fine-tune later | **[PLANNED]** Hindi / Bundelkhandi voice notes. Day 1: just store audio for a human. |
| **Vision model** | Phase 1: off-the-shelf multimodal LLM + catalog RAG → Phase 2: fine-tuned PyTorch classifier (EfficientNet/ViT) | **[PLANNED]** Serves candidate SKUs with confidence. See §9 for phased plan and honest limits. |
| Hosting (later) | Small VM / container (Railway/Render/EC2) + managed Postgres | Nothing deployed until the WhatsApp loop works locally. |

## 4. Data model (core tables)

All monetary columns are **paise** (integers). Tables marked **[BUILT]** exist in the Prisma
schema today; **[PLANNED]** are designed but not yet created.

- **shops** **[BUILT]** — `id, name, town, created_at` (the tenant; everything below is scoped to a shop)
- **admin_users** **[BUILT]** — `id, email (unique), name, password_hash, role (SUPER_ADMIN|OWNER|STAFF), shop_id (null for SUPER_ADMIN), created_at` — dashboard login accounts (distinct from customer `users`)
- **users** (customers) **[BUILT]** — `id, shop_id, phone, name, user_type (FARMER|MISTRI), acquisition_channel (WALK_IN|WHATSAPP|MISTRI_REFERRAL|APP), referred_by_mistri_id, wallet_balance, created_at` — **phone is unique per shop** (`@@unique(shop_id, phone)`), not globally, so two shops can share a farmer.
- **orders** **[BUILT]** — `id, shop_id, user_id, order_source (WHATSAPP|APP|COUNTER), raw_text, media_url, tractor_brand, model, status, subtotal, delivery_fee, total, created_at, updated_at`
- **order_items** **[BUILT]** — `id, order_id, sku_id, qty, unit_price` (price snapshotted per line, so history is stable)
- **skus** **[BUILT]** — `id, shop_id, match_key, name, brand, model_compat, category, retail_price (farmer), mistri_price (nullable — else auto-discount), wholesale_price, weight_g, stock_qty, created_at`. **`match_key`** is a normalized (case/space/punctuation-insensitive) key with `@@unique(shop_id, match_key)` for **duplicate-proof find-or-create** (see §7 organic catalog). **Two-tier pricing:** farmer=`retail_price`, mistri=`mistri_price` (guardrail: wholesale ≤ mistri ≤ retail).
- **payments** **[BUILT]** — `id, order_id, method (MANUAL_UPI_QR|RAZORPAY), provider_ref (nullable — razorpay id), utr (UPI reference, required at manual confirm — audit), amount, status (PENDING|CONFIRMED), confirmed_by, confirmed_at, paid_at`.
- **deliveries** **[BUILT]** — `id, order_id, bus_route, conductor_name, dispatched_at, claimed_at` (`otp_hash` column retained but **deprecated/unused** — OTP-at-stop was dropped)
- **wallet_txns** **[BUILT]** — `id, mistri_id, order_id, type (CASHBACK|PAYOUT), amount, created_at` — **commission rule (locked): a mistri earns cashback ONLY on orders they place through the app.** Referred farmers ordering directly do not generate mistri commission.
- **part_predictions** **[BUILT — table exists, unused until AI]** — `id, order_id, model_version, predicted_sku_id, brand, part_category, predicted_specs (JSON string), confidence, input_media_url, transcript, created_at`
- **training_examples** **[BUILT — table exists, unused until AI]** — `id, media_url, transcript, resolved_sku_id, resolved_specs (JSON string), labeled_by, source_order_id, split (train|val|test), created_at`

Rules: prices/margins/real client phone numbers live in the DB, **never in git**. Farmer photos/voice notes used for training require a
**clear consent notice** at onboarding. Commercial params (delivery fee, free-delivery
threshold, cashback %, mistri discount %) are **env-configurable**, not hardcoded.

## 5. Channel & audit tagging

- `order_source`: `WHATSAPP | APP | COUNTER`
- `acquisition_channel`: `WALK_IN | WHATSAPP | MISTRI_REFERRAL | APP`
- `user_type`: `FARMER | MISTRI`

Lets us measure app adoption vs WhatsApp over time and protect mistri attribution.

## 6. Order lifecycle (state machine)

`RECEIVED → QUOTED → PAID → PACKED → DISPATCHED → DELIVERED` (+ `CANCELLED`)

1. **RECEIVED** — WhatsApp msg / app order / counter entry creates the row (voice/photo stored).
2. **QUOTED** — staff match part + set price; buyer gets an order summary + **Confirm** button (WhatsApp interactive message) and a **UPI QR / `upi://` link in the chat**.
3. **PAID** — buyer pays via any UPI app; **staff manually confirm receipt** in the admin inbox, **entering the UTR / UPI reference** (required — forces verifying the amount actually landed; a screenshot is not proof) → order unlocks for packing. *(Later: Razorpay webhook auto-confirms.)*
4. **PACKED** — staff pack the part (implicit; folded into dispatch for the prototype).
5. **DISPATCHED** — staff record the **bus route + conductor** and **notify the customer** which bus the parcel is on (manual call/WhatsApp now; auto-WhatsApp later).
6. **DELIVERED** — staff **mark delivered** once the customer confirms receipt (call/WhatsApp) → mistri cashback credited **only if the order was placed by a mistri through the app** (see §4). **No OTP:** there's no village-side checkpoint to verify one and payment is already collected upfront, so a code would only add friction for low-literacy farmers.

## 7. Features by surface

**WhatsApp (farmers, kickoff channel):** text/voice/photo intake → Hindi auto-ack **[BUILT]** →
order summary + **Confirm** button + **UPI QR / `upi://` link in the chat** → "your parcel is on
bus X" on dispatch → delivery confirmation **[PLANNED — needs a live number/templates]**. No UI to learn. WhatsApp
carries the QR; it is not the payment processor.

**App — FARMER mode:** voice-note / photo ordering, big icons, Hindi voice UI, order
tracking + push. Deliberately as simple as WhatsApp.

**App — MISTRI mode:** OTP login • catalog by brand/model • cart + reorder • UPI checkout •
wallet (cashback balance + UPI payout) • order tracking + push • refer-a-farmer (mistri
stays in the loop, never bypassed). **Cashback accrues only on app-placed orders.**

**Web dashboard — login roles (internal) [BUILT]:** email+password login • **HI|EN toggle** •
unified orders inbox (filter by status) + order detail workflow • match part via **organic
catalog** (type-ahead over saved parts; create once if new; duplicate-proof) at the correct
**two-tier price by customer type** • set price → generate **UPI QR** • **mark paid with UTR**
• dispatch (record bus route + conductor, notify customer) • mark delivered • walk-in customer onboarding
• home stats. `OWNER`/`STAFF` see only their shop; **`SUPER_ADMIN`** adds shops and switches
between them for a network-wide view. *(AI part-suggestion panel is [PLANNED], slots into the
order detail.)*

**Organic catalog (no onboarding burden) [BUILT]:** the shop never pre-enters or counts
inventory. Parts are typed once at order time; a **normalized match-key** with find-or-create
means `abc-123` and `abc 123` resolve to one saved part. The catalog builds itself from real
sales — which is also the clean price memory and (future) AI training data. Stock counts are
optional, not required.

**Mistri services marketplace (Phase 3 vision, not MVP):** farmers browse/book **repair
services from nearby mistris** (location + availability + ratings); mistri earns a
commission on the labor job, KisanGati takes a platform fee. Turns KisanGati into a
rural-repair platform, not just a parts shop, and further entrenches mistri loyalty. Its own
tables (`service_requests`, `service_bookings`, `mistri_profiles`) come later — flagged here
so today's schema leaves room (e.g. mistri geo + availability fields).

## 8. Build sequence (money loop before polish)

Prove the order → pay → dispatch loop with real money before building the polished app.

1. **Backend + DB** — the shared brain (Prisma schema, migrations). **[DONE]**
2. **Web admin dashboard (React/Vite)** — process real orders; catalog; walk-in onboarding. **[DONE]**
3. **Multi-tenant auth** — Shop/AdminUser, JWT, roles, shop isolation, super-admin onboarding.
   **[DONE]** (pulled forward — a relative's shop is a real second tenant for testing).
4. **WhatsApp intake** — farmers, no app needed. Webhook → order + Hindi auto-reply. **[DONE]**
   (media download + in-chat UPI QR delivery are the remaining pieces.)
5. **`ml-service` Phase 1 (in parallel)** — Python service with a multimodal-LLM + catalog-RAG
   part suggester to assist staff. Real accuracy still depends on the real-photo dataset. **[PLANNED]**
6. **Farmer + Mistri app modes** — built on a backend already proven with real orders. **[PLANNED]**

Deferred until the loop works: full custom-trained model (Phase 2), the mistri services
marketplace, the multi-tenant seller platform, any production deployment.

**Data capture is NOT deferred.** From the very first order, every photo + voice note +
the SKU a human resolves it to is written to `training_examples` (§9). The MVP is the
data-collection engine for the future model — that is its second job.

## 9. Part Identification AI (vision + voice) — the long-term moat

**Goal:** a farmer sends a photo of a broken part (+ optional Hindi voice note); the system
identifies **brand + part category + key specs** (e.g. teeth count, spline count, diameter),
maps it to a SKU, and lets the shop fetch and ship it directly — even when the farmer
doesn't know the part's name.

### Honest scope
- **Brand + part category from a photo** → achievable with a fine-tuned image classifier.
- **Fine-grained specs (teeth count, splines, diameter)** → **the hard part.** A casual phone
  photo has no scale reference, variable lighting/angle, and grease/wear. Realistic tactics:
  ask for a **reference object in frame** (a coin), request a **second angle**, or keep
  **human-in-the-loop on specs** until data + accuracy justify automation. We will not
  promise reliable automated teeth-counting on day one.
- A **custom trained model is Phase 2+**, gated on having enough labeled data.

### Online images — useful, but not a shortcut to accuracy (important)
Founder plan: bootstrap training with thousands/millions of online catalog images. This
**helps**, but with a hard limit worth stating plainly:
- **Online catalog images ≠ farmer photos.** Web images are clean studio shots of *new*
  parts; farmer photos are greasy, worn, cracked, badly lit, at odd angles, often still
  bolted to the machine. A model trained only on web images tests great and then **fails on
  real farmer photos** — classic *domain shift*, the #1 way vision projects disappoint.
- **What web images are good for:** pretraining / bootstrapping the **brand + part-category
  classifier**, and building the **visual catalog for RAG matching**. Start now on these.
- **What they can't do:** teach the broken-part-in-hand distribution, or read fine specs
  (teeth count) without scale. That still needs the real farmer-photo → SKU labels captured
  from live orders. Also watch image **licensing** when scraping.
- **Decision:** start the model now (per founder) using web images + LLM + catalog RAG as a
  staff-assist tool, AND capture every real photo→SKU label in parallel. Don't declare the
  problem solved on web images alone.

### Phased plan
- **Phase 0 — Human-in-the-loop (MVP, now).** Store photo + voice. Staff identify the part
  and resolve to a SKU. Every resolution auto-creates a `training_examples` row. *This is
  how the dataset gets built* — no separate labeling project needed.
- **Phase 1 — Assisted (off-the-shelf).** A multimodal LLM (vision) + **RAG over the SKU
  catalog** proposes ranked candidate SKUs with confidence; Hindi voice → STT → structured
  query merged with the image signal. Staff confirm/correct in the admin inbox; corrections
  feed the dataset. Low-confidence predictions are routed to staff (active learning).
- **Phase 2 — Custom model.** Once enough labeled images per class accumulate, fine-tune a
  PyTorch vision model served by the Python `ml-service`: (a) a **classifier** head for
  brand + part category; (b) a separate **fine-grained/attribute** approach for specs
  (object detection / keypoint or measurement-with-reference) tackled only where data
  supports it. Versioned models (`model_version` on every prediction), offline eval on the
  held-out `test` split before any model is promoted.

### Data flow
`order photo + voice → part_predictions (what AI guessed) → staff resolves → resolved SKU +
specs written to training_examples (the label) → periodic retrain → promote if eval beats
current model_version`. The human correction *is* the ground-truth label.

### Serving
`ml-service` (Python/FastAPI) exposes `POST /identify` (image + optional transcript →
ranked SKU candidates + specs + confidence) and `POST /transcribe` (audio → text). The Node
backend calls it async via the Redis queue; results attach to the order for staff review.

## 10. Guardrails

- Prototype only, not deployed. Test WhatsApp number, no real payments, no production data.
- Never commit `.env` / tokens. Keep the father's real shop data (prices, client phones) out of git.
- **Set a strong `JWT_SECRET` in `.env` before any deployment** — the code falls back to an
  insecure dev default and warns if it's unset.
- Meta temporary token expires (~24h) — refresh during dev; permanent system-user token only past sandbox.
- The demo seed creates DEMO-tagged data across two shops; run `npm run db:reset` to wipe before real use.
