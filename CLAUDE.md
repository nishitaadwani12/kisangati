# KisanGati (किसानगति) — Project Handoff

> Handoff doc for any Claude session. Read this first. The business plan below is a
> **rough, unconfirmed draft** brainstormed with another AI — numbers, phases, and
> features are starting points to refine WITH the founder, not settled decisions.

## What this is

A tech-enabled rural spare-parts delivery service, digitizing an **existing** family
business: the founder's father runs a tractor spare-parts retail shop in **Jhansi, UP**.
The shop already has working inventory, wholesale supplier relationships, a small set of
phone-order clients, and **existing bus-conductor tie-ups** for delivery to villages.

Goal: build the **tech layer** so villagers/mechanics can order parts remotely (voice
note / photo, no travel), pay upfront via UPI, and receive parts at their village bus
stop the same day — without the shop staff doing manual billing/routing.

The founder owns the **tech + digital strategy**; the father owns **ground ops
(inventory, packaging, bus dispatch)**. They intend to work as **formal business
partners**, not on an inheritance/family basis. Formal legal incorporation comes
**later, after a working prototype + traction** (tech-first, not legal-first).

## Users

- **Farmers / villagers** — often low-literacy; zero-friction intake (Hindi voice notes,
  photos of the broken part / engine nameplate). Primary channel: **WhatsApp**.
- **Mistris (mechanics)** — power users who order repeatedly; get a **commission wallet
  (3–5% cashback)**. Primary channel: a dedicated **Android app**. They also act as
  referral/sales agents (must not be bypassed — they hold farmer trust and part margin).

Both channels feed **one unified backend/database**, with every record tagged by
`order_source` (WHATSAPP | APP) and `user_type` (FARMER | MISTRI) for auditing/analytics.

## Decisions locked in

- **Name: KisanGati** (not "TractorSewa") — deliberately generic so it can expand beyond
  tractors to other automobile/machinery parts later.
- **Dual channel**: WhatsApp (farmers, zero-friction) **and** native Android app
  (mistris, loyalty/wallet). Both required; single shared DB.
- **No COD** — upfront UPI only (PhonePe/GPay/Paytm/Razorpay). Shop packs only after
  payment confirms. Avoids fraud/non-pickup losses. (Father's current clients already
  pay via UPI QR before dispatch.)
- **Bus logistics** already exists (father's tie-ups) — reuse it, don't rebuild. Delivery
  to village **bus stop**, claimed with a **4-digit OTP** given to the conductor.
- **Tech-first sequencing**: prototype → ground validation with real orders → THEN legal
  incorporation. Do NOT spend on lawyers/registration on day one.

## Open questions (discuss with founder — do not assume)

- Real order volume/week and which bus routes the father actually uses today.
- Real SKU list, wholesale vs retail prices, weights for the top ~50 fast-moving parts.
- Whether to start building the **WhatsApp intake bot**, the **shop admin dashboard**, or
  the **Mistri app** first.
- Revenue model numbers below are illustrative and were questioned by the founder as
  oversimplified — treat as unvalidated.

## Rough tech direction (unconfirmed)

- Backend/API: Node.js or Python (FastAPI). DB: PostgreSQL. Queue: Redis.
- WhatsApp Business API via a BSP (WATI / Gupshup / AiSensy) or Meta Cloud API.
- Intake: speech-to-text tuned for Hindi/Bundelkhandi dialect; OCR on part/nameplate photos.
- Admin dashboard: React web panel — unified inbox (voice/photo/app orders), inventory
  match, one-click UPI link, auto-printed thermal shipping label (route + conductor + OTP).
- Mistri app: Flutter/React Native Android — OTP login, catalog by brand/model, wallet,
  UPI payout.
- A "multi-bot" idea was floated (intake / catalog-match / dispatch / payment / wallet as
  separate services) — aspirational, likely overkill for an MVP. Start simple.

## Illustrative revenue model (NOT validated)

3 tiers by ticket size: Small (~₹400, filters/belts, ~50% vol), Medium (~₹2,200,
clutch/brake, ~35%), High (~₹7,500, pumps/gears, ~15%). ~20% gross part margin. Flat
~₹40 customer delivery fee on orders under ₹1,000; free above. Blended AOV ~₹2,095,
net ~₹300/order (~14.5%). Founder flagged the flat-average approach as unrealistic —
revisit with the father's actual price/volume data.

## Suggested first concrete step

Seed a small DB with ~30–50 real SKUs from the father's shop, stand up a minimal
WhatsApp intake → admin dashboard → UPI link → OTP label loop, and dry-run 5 real bus
dispatches under the existing shop name. Prove the loop before building the full app.

## Repo status

Fresh `git init` (branch `main`), no remote yet. Founder will provide a personal (non-Amazon)
git username + remote before any push. Keep this project fully separate from work code.

---

# PROTOTYPE BUILD PLAN (local-first, WhatsApp intake first)

Goal: a **working local prototype** to demo to the founder's father/brother and earn
trust. **Nothing is deployed** until the WhatsApp loop works locally end to end. Build the
money loop, not the full platform. Defer the Mistri app and the 5-bot architecture.

## Chosen prototype stack (changeable)

- **Backend/API:** Node.js + **TypeScript** + Express. (Python/FastAPI is an equally fine
  alternative — decide once, don't mix.)
- **DB:** PostgreSQL via Docker. **SQLite is an acceptable day-1 shortcut** if Docker is
  friction; using an ORM (Prisma) keeps the switch trivial.
- **ORM/migrations:** Prisma.
- **WhatsApp:** **Meta WhatsApp Cloud API** — free sandbox test number, no paid BSP
  (WATI/Gupshup) needed for the prototype. Webhooks are plain HTTPS, so no vendor lock-in.
- **Local webhook tunnel:** ngrok (or cloudflared) to expose the local server to Meta's
  webhook callbacks during testing.
- **Admin UI:** deferred — start API-only. Add a minimal React (Vite) dashboard once the
  intake loop works. Until then, inspect orders via DB / a `GET /orders` endpoint.
- **Config:** all secrets in `.env` (gitignored). Never commit tokens.

## The one loop we're proving first

    Farmer WhatsApp msg (text/voice/photo)
      → Meta Cloud API webhook → our /webhook
      → parse & log an Order row (status RECEIVED)
      → (prototype) auto-reply "order received, we'll confirm price"
    [later] staff confirms part+price → send UPI link → on paid → generate OTP + label

Prototype done-definition: a real WhatsApp message to the test number creates a persisted
`orders` row and gets an automated reply. That alone is the demo-able proof.

## Step-by-step (do in order; each step is independently testable)

**Step 0 — Repo scaffold**
- `npm init`, TypeScript config, Express server with a `GET /health` returning 200.
- `.gitignore` (node_modules, .env, build). `.env.example` with placeholder keys.
- Verify: `curl localhost:3000/health` → ok.

**Step 1 — Data layer**
- Prisma + a minimal schema: `users` (phone, name, user_type, acquisition_channel) and
  `orders` (id, user phone, order_source, raw_text, media_url, tractor_brand, model,
  status, created_at). Mirror the audit columns from the schema section above.
- Run first migration. Verify: can insert/query a dummy order.

**Step 2 — Meta WhatsApp Cloud API setup (accounts, not code)**
- Create a Meta developer app + WhatsApp product; get the **test phone number**,
  **temporary access token**, **phone number ID**, and set a **webhook verify token**.
- Add the tester's own WhatsApp number to the allowed recipients list.
- Put all of these in `.env`. (These are account/console steps the founder does in the
  browser — Claude cannot click through Meta's console; guide the founder through it.)

**Step 3 — Webhook verification endpoint**
- `GET /webhook`: echo `hub.challenge` when `hub.verify_token` matches the env token
  (Meta's verification handshake).
- Point ngrok at the local port, register the ngrok URL in the Meta console.
- Verify: Meta console shows the webhook verified (green).

**Step 4 — Inbound message handler**
- `POST /webhook`: parse Meta's message payload. Handle **text**, **audio** (voice note),
  and **image** message types. Extract sender phone + message body / media id.
- Upsert the sender into `users`; create an `orders` row (status RECEIVED) with the raw
  text and, for media, the WhatsApp **media id** (download-to-disk can come later).
- Verify: send a WhatsApp text to the test number → a row appears in the DB.

**Step 5 — Automated reply**
- Call the Cloud API **send-message** endpoint to reply (e.g. Hindi: "आपका ऑर्डर मिल गया,
  हम जल्दी कीमत भेजेंगे").
- Verify: the tester receives the auto-reply in WhatsApp. **← prototype milestone / demo.**

**Step 6 — Media retrieval (voice + photo)**
- For audio/image messages, call the media endpoint to download the file (voice notes
  arrive as `.ogg`) and store it locally, attaching the path to the order.
- Verify: a sent voice note / photo is saved to disk and linked to its order row.

**Step 7 — Minimal read surface**
- `GET /orders` (JSON list) so the founder can see incoming orders without a DB client.
- Optional: a bare React page later. Keep it minimal.

## Deferred until the loop above works (do NOT start early)

- UPI payment link generation + payment webhook + OTP/label printing.
- Speech-to-text on Hindi/Bundelkhandi voice notes (start by just storing the audio for a
  human to listen to — matches how the father works today).
- Catalog/SKU matching, the Mistri Android app, the multi-bot split, any deployment.

## Guardrails

- **Prototype only, not deployed.** No production data, no real payments, test number only.
- Never commit `.env` / tokens. Meta's temporary token expires (~24h) — refresh during dev;
  wire a permanent system-user token only when moving past the sandbox.
- Keep the father's real shop data (prices, client phone numbers) out of git.
