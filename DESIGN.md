# KisanGati — Technical Design (Locked v1.3)

> Canonical architecture + tech decisions for KisanGati. Read alongside `CLAUDE.md`
> (business context) and the prototype build plan. Decisions here are **locked** unless
> explicitly revised in a later commit. Business numbers in `CLAUDE.md` remain unvalidated
> drafts; this doc is about *how we build*, not *what the margins are*.

## 1. Product framing — customer app + internal web dashboard, WhatsApp as a channel

KisanGati has two purpose-built surfaces plus WhatsApp:

- **Customer app (Flutter, Android):** for `FARMER` and `MISTRI`. WhatsApp is a **kickoff /
  low-friction channel** feeding the same backend — the long-term goal is to graduate users
  onto the app, without ever forcibly retiring WhatsApp (some farmers always prefer it).
- **Internal admin dashboard (React web):** operated **by us only** — order processing,
  SKU match, payments, dispatch, analytics. A web panel is right here because it's
  internal/back-office (not customer-facing), and iterates far faster than an APK.

| Role | Surface | Experience |
|---|---|---|
| `FARMER` | Customer app + WhatsApp | Zero-friction: voice-note / photo ordering, big icons, Hindi voice UI. |
| `MISTRI` | Customer app | Full catalog by brand/model, cart, reorder, **wallet/cashback (3–5%)**, referrals. |
| `SHOP_ADMIN` | Web dashboard | Unified inbox (WhatsApp + app + counter), SKU match, UPI QR + manual payment confirm, thermal label, dispatch/deliver, walk-in onboarding, daily analytics. |

**Walk-in onboarding (first-class flow):** at the counter, staff create the user and
introduce **both** surfaces together — install/QR the app *and* save the WhatsApp number —
tagged `acquisition_channel = WALK_IN`.

### Long-term vision (not MVP)
1. **Multi-tenant marketplace:** open the platform so *other* spare-parts businesses can
   onboard and sell — the internal dashboard becomes a per-seller portal. Design keeps a
   `seller_id`/tenant seam in mind so this isn't a rewrite later.
2. **Mistri services marketplace:** farmers book **repair services from nearby mistris**
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

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Customer app | **Flutter (Dart)** | Farmers + mistris. One codebase, strong on low-end Android, good offline + Devanagari rendering, small APK. Libs: `dio`, `riverpod`, `drift`/`sqflite` (offline cache), `razorpay_flutter`, `firebase_messaging`. |
| Admin dashboard | **React + Vite (web)** | Internal, operated by us. Fast to iterate; back-office only, so it doesn't dilute the app-first story. Long-term becomes the multi-tenant seller portal. |
| Backend/API | **Node.js + TypeScript + Express** | REST + JSON. Already scaffolded (Step 0). |
| Database | **PostgreSQL** + **Prisma** (ORM + migrations) | SQLite is the day-1 shortcut; Prisma makes the switch trivial. |
| Queue/cache | **Redis** | Async jobs (media download, WhatsApp send retries, payment reconciliation), OTP + session cache. |
| WhatsApp | **Meta WhatsApp Cloud API** | Free sandbox for prototype; move to a BSP (e.g. AiSensy) only if templated marketing at scale is needed. |
| Payments | **Manual UPI QR (prototype)** → Razorpay-ready | No COD (locked). Shop packs only after payment confirms. MVP: send a static UPI QR / `upi://` deep link **in the WhatsApp chat**, staff confirm receipt manually (matches father's current flow — zero gateway/KYC). `payments` table is modeled so **Razorpay dynamic QR + webhook auto-confirm** drops in later as a config change, not a rewrite. WhatsApp is the *delivery channel* for the QR, not the processor. |
| Media | Local disk (prototype) → **S3 / Cloudflare R2** (prod) | Voice `.ogg`, part/nameplate photos. |
| Push | **Firebase Cloud Messaging** | Order status → buyer; new order → shop. |
| Auth | Phone + OTP → **JWT** | Roles: `FARMER`, `MISTRI`, `SHOP_ADMIN`. |
| **ML service** | **Python + FastAPI** (separate microservice) | Serves part-identification + speech-to-text. Called by the Node backend over HTTP. Kept separate so Python ML tooling stays out of the Node app. See §9. |
| **Speech-to-text** | Hosted API first (Google STT or self-hosted Whisper) → dialect fine-tune later | Hindi / Bundelkhandi voice notes. Day 1: just store audio for a human. |
| **Vision model** | Phase 1: off-the-shelf multimodal LLM + catalog RAG → Phase 2: fine-tuned PyTorch classifier (EfficientNet/ViT) | Serves candidate SKUs with confidence. See §9 for phased plan and honest limits. |
| Hosting (later) | Small VM / container (Railway/Render/EC2) + managed Postgres | Nothing deployed until the WhatsApp loop works locally. |

## 4. Data model (core tables)

- **users** — `id, phone (unique), name, user_type (FARMER|MISTRI), acquisition_channel (WALK_IN|WHATSAPP|MISTRI_REFERRAL|APP), referred_by_mistri_id, wallet_balance, created_at`
- **orders** — `id, user_id, order_source (WHATSAPP|APP|COUNTER), raw_text, media_url, tractor_brand, model, status, subtotal, delivery_fee, total, created_at`
- **order_items** — `id, order_id, sku_id, qty, unit_price`
- **skus** — `id, name, brand, model_compat, category, retail_price, wholesale_price, weight_g, stock_qty`
- **payments** — `id, order_id, method (MANUAL_UPI_QR|RAZORPAY), provider_ref (nullable — razorpay link/QR id), amount, status (PENDING|CONFIRMED), confirmed_by (staff id, for manual), confirmed_at, paid_at` — MVP writes `MANUAL_UPI_QR` + staff confirmation; Razorpay path later just fills `provider_ref` and flips status via webhook.
- **deliveries** — `id, order_id, bus_route, conductor_name, otp_hash, dispatched_at, claimed_at`
- **wallet_txns** — `id, mistri_id, order_id, type (CASHBACK|PAYOUT), amount, created_at` — **commission rule (locked): a mistri earns cashback ONLY on orders they place through the app.** Referred farmers ordering directly do not generate mistri commission. Clean, no perpetual-attribution bookkeeping.
- **part_predictions** — `id, order_id, model_version, predicted_sku_id, brand, part_category, predicted_specs (jsonb: teeth/splines/diameter…), confidence, input_media_url, transcript, created_at` (what the AI guessed for an order)
- **training_examples** — `id, media_url, transcript, resolved_sku_id, resolved_specs (jsonb), labeled_by (staff id), source_order_id, split (train|val|test), created_at` (the labeled dataset, built automatically — see §9)

Rules: **OTP stored hashed**, never plaintext. Prices/margins/real client phone numbers
live in the DB, **never in git**. Farmer photos/voice notes used for training require a
**clear consent notice** at onboarding.

## 5. Channel & audit tagging

- `order_source`: `WHATSAPP | APP | COUNTER`
- `acquisition_channel`: `WALK_IN | WHATSAPP | MISTRI_REFERRAL | APP`
- `user_type`: `FARMER | MISTRI`

Lets us measure app adoption vs WhatsApp over time and protect mistri attribution.

## 6. Order lifecycle (state machine)

`RECEIVED → QUOTED → PAID → PACKED → DISPATCHED → DELIVERED` (+ `CANCELLED`)

1. **RECEIVED** — WhatsApp msg / app order / counter entry creates the row (voice/photo stored).
2. **QUOTED** — staff match part + set price; buyer gets an order summary + **Confirm** button (WhatsApp interactive message) and a **UPI QR / `upi://` link in the chat**.
3. **PAID** — buyer pays via any UPI app; **staff manually confirm receipt** in the admin inbox (prototype) → order unlocks for packing. *(Later: Razorpay webhook auto-confirms.)*
4. **PACKED** — staff print thermal label (route + conductor + OTP).
5. **DISPATCHED** — handed to bus conductor; 4-digit OTP issued to buyer.
6. **DELIVERED** — buyer gives OTP at village stop → confirmed → mistri cashback credited **only if the order was placed by a mistri through the app** (see §4 commission rule).

## 7. Features by surface

**WhatsApp (farmers, kickoff channel):** text/voice/photo intake → Hindi auto-ack → order
summary + **Confirm** button (interactive message) → **UPI QR / `upi://` link in the chat**
→ OTP on dispatch → delivery confirmation. No UI to learn. WhatsApp carries the QR; it is
not the payment processor.

**App — FARMER mode:** voice-note / photo ordering, big icons, Hindi voice UI, order
tracking + push. Deliberately as simple as WhatsApp.

**App — MISTRI mode:** OTP login • catalog by brand/model • cart + reorder • UPI checkout •
wallet (cashback balance + UPI payout) • order tracking + push • refer-a-farmer (mistri
stays in the loop, never bypassed). **Cashback accrues only on app-placed orders.**

**Web dashboard — SHOP_ADMIN (internal, us only):** unified inbox (WhatsApp + app + counter)
• play voice / view photo • **AI part suggestion (candidate SKUs + confidence)** • match to
SKU • set price → send order summary + **UPI QR** to chat • **mark payment received (manual
confirm)** • stock view • one-tap thermal label (route + conductor + OTP) • dispatch/deliver
actions • **walk-in onboarding (app + WhatsApp together)** • daily sales + analytics.

**Mistri services marketplace (Phase 3 vision, not MVP):** farmers browse/book **repair
services from nearby mistris** (location + availability + ratings); mistri earns a
commission on the labor job, KisanGati takes a platform fee. Turns KisanGati into a
rural-repair platform, not just a parts shop, and further entrenches mistri loyalty. Its own
tables (`service_requests`, `service_bookings`, `mistri_profiles`) come later — flagged here
so today's schema leaves room (e.g. mistri geo + availability fields).

## 8. Build sequence (money loop before polish)

Prove the order → pay → dispatch loop with real money before building the polished app.

1. **Backend + DB** — the shared brain (Prisma schema, migrations).
2. **WhatsApp intake** — farmers, no app needed. Proves demand end-to-end.
3. **Web admin dashboard (React/Vite)** — we process real orders; walk-in onboarding.
4. **`ml-service` Phase 1 (in parallel)** — stand up the Python service now with a
   multimodal-LLM + catalog-RAG part suggester to assist staff (founder decision: start the
   model early). Real accuracy still depends on the real-photo dataset captured from step 2 on.
5. **Farmer + Mistri app modes** — built on a backend already proven with real orders.

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
- Meta temporary token expires (~24h) — refresh during dev; permanent system-user token only past sandbox.
