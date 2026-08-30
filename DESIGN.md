# KisanGati — Technical Design (Locked v1)

> Canonical architecture + tech decisions for KisanGati. Read alongside `CLAUDE.md`
> (business context) and the prototype build plan. Decisions here are **locked** unless
> explicitly revised in a later commit. Business numbers in `CLAUDE.md` remain unvalidated
> drafts; this doc is about *how we build*, not *what the margins are*.

## 1. Product framing — one app, three roles, WhatsApp as a channel

KisanGati is a **native mobile app** (not a website) backed by a shared API. WhatsApp is a
**kickoff / low-friction channel** that feeds the same backend — the long-term goal is to
graduate every user onto the app, without ever forcibly retiring WhatsApp (some farmers
will always prefer it).

Three roles live inside **one Flutter app**:

| Role | Who | Experience |
|---|---|---|
| `FARMER` | Villagers, often low-literacy | Zero-friction: voice-note / photo ordering, big icons, Hindi voice UI. Mirrors the WhatsApp flow inside the app. |
| `MISTRI` | Mechanics, repeat power users | Full catalog by brand/model, cart, reorder, **wallet/cashback (3–5%)**, referrals. |
| `SHOP_ADMIN` | Father + shop staff | Tablet mode: unified inbox (WhatsApp + app + counter), SKU match, one-tap UPI link, thermal label, dispatch/deliver. **This is why there is no website.** |

**Walk-in onboarding (first-class flow):** at the counter, staff create the user and
introduce **both** surfaces together — install/QR the app *and* save the WhatsApp number —
tagged `acquisition_channel = WALK_IN`.

## 2. Architecture

```
  Farmers ───WhatsApp───┐
                        │
  Farmers/Mistris ─App──┤
                        ├──► Backend API (Node + TypeScript + Express) ──► PostgreSQL
  Shop staff ─App(admin)┘            │                                        │
                                     ├─► Redis (queue / cache / OTP + sessions)
                                     ├─► Meta WhatsApp Cloud API (inbound + outbound)
                                     ├─► Razorpay (UPI links + payment webhooks)
                                     ├─► Object storage (voice notes / part photos)
                                     └─► Firebase Cloud Messaging (push)
```

Single shared database. Every order and user is tagged for audit/analytics (see §5).

## 3. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **Flutter (Dart)** | One codebase, strong on low-end Android, good offline + Devanagari rendering, small APK. Libs: `dio`, `riverpod`, `drift`/`sqflite` (offline cache), `razorpay_flutter`, `firebase_messaging`. |
| Backend/API | **Node.js + TypeScript + Express** | REST + JSON. Already scaffolded (Step 0). |
| Database | **PostgreSQL** + **Prisma** (ORM + migrations) | SQLite is the day-1 shortcut; Prisma makes the switch trivial. |
| Queue/cache | **Redis** | Async jobs (media download, WhatsApp send retries, payment reconciliation), OTP + session cache. |
| WhatsApp | **Meta WhatsApp Cloud API** | Free sandbox for prototype; move to a BSP (e.g. AiSensy) only if templated marketing at scale is needed. |
| Payments | **Razorpay** (UPI) | No COD (locked). Shop packs only after payment confirms. |
| Media | Local disk (prototype) → **S3 / Cloudflare R2** (prod) | Voice `.ogg`, part/nameplate photos. |
| Push | **Firebase Cloud Messaging** | Order status → buyer; new order → shop. |
| Auth | Phone + OTP → **JWT** | Roles: `FARMER`, `MISTRI`, `SHOP_ADMIN`. |
| Hosting (later) | Small VM / container (Railway/Render/EC2) + managed Postgres | Nothing deployed until the WhatsApp loop works locally. |

## 4. Data model (core tables)

- **users** — `id, phone (unique), name, user_type (FARMER|MISTRI), acquisition_channel (WALK_IN|WHATSAPP|MISTRI_REFERRAL|APP), referred_by_mistri_id, wallet_balance, created_at`
- **orders** — `id, user_id, order_source (WHATSAPP|APP|COUNTER), raw_text, media_url, tractor_brand, model, status, subtotal, delivery_fee, total, created_at`
- **order_items** — `id, order_id, sku_id, qty, unit_price`
- **skus** — `id, name, brand, model_compat, category, retail_price, wholesale_price, weight_g, stock_qty`
- **payments** — `id, order_id, razorpay_link_id, amount, status, paid_at`
- **deliveries** — `id, order_id, bus_route, conductor_name, otp_hash, dispatched_at, claimed_at`
- **wallet_txns** — `id, mistri_id, order_id, type (CASHBACK|PAYOUT), amount, created_at`

Rules: **OTP stored hashed**, never plaintext. Prices/margins/real client phone numbers
live in the DB, **never in git**.

## 5. Channel & audit tagging

- `order_source`: `WHATSAPP | APP | COUNTER`
- `acquisition_channel`: `WALK_IN | WHATSAPP | MISTRI_REFERRAL | APP`
- `user_type`: `FARMER | MISTRI`

Lets us measure app adoption vs WhatsApp over time and protect mistri attribution.

## 6. Order lifecycle (state machine)

`RECEIVED → QUOTED → PAID → PACKED → DISPATCHED → DELIVERED` (+ `CANCELLED`)

1. **RECEIVED** — WhatsApp msg / app order / counter entry creates the row (voice/photo stored).
2. **QUOTED** — staff match part + set price; buyer gets price + UPI link.
3. **PAID** — Razorpay webhook confirms → order unlocks for packing.
4. **PACKED** — staff print thermal label (route + conductor + OTP).
5. **DISPATCHED** — handed to bus conductor; 4-digit OTP issued to buyer.
6. **DELIVERED** — buyer gives OTP at village stop → confirmed → mistri cashback credited.

## 7. Features by surface

**WhatsApp (farmers, kickoff channel):** text/voice/photo intake → Hindi auto-ack →
price + UPI link → OTP on dispatch → delivery confirmation. No UI to learn.

**App — FARMER mode:** voice-note / photo ordering, big icons, Hindi voice UI, order
tracking + push. Deliberately as simple as WhatsApp.

**App — MISTRI mode:** OTP login • catalog by brand/model • cart + reorder • UPI checkout •
wallet (cashback balance + UPI payout) • order tracking + push • refer-a-farmer (mistri
stays in the loop, never bypassed).

**App — SHOP_ADMIN mode:** unified inbox (WhatsApp + app + counter) • play voice / view
photo • match to SKU • set price → one-tap UPI link • stock view • one-tap thermal label
(route + conductor + OTP) • dispatch/deliver actions • **walk-in onboarding (app + WhatsApp
together)** • daily sales.

## 8. Build sequence (money loop before polish)

Prove the order → pay → dispatch loop with real money before building the polished app.

1. **Backend + DB** — the shared brain (Prisma schema, migrations).
2. **WhatsApp intake** — farmers, no app needed. Proves demand end-to-end.
3. **Admin (Flutter tablet role)** — father processes real orders; walk-in onboarding.
4. **Farmer + Mistri app modes** — built on a backend already proven with real orders.

Deferred until the loop works: full catalog matching automation, speech-to-text on Hindi
voice notes (store audio for a human first), multi-service split, any deployment.

## 9. Guardrails

- Prototype only, not deployed. Test WhatsApp number, no real payments, no production data.
- Never commit `.env` / tokens. Keep the father's real shop data (prices, client phones) out of git.
- Meta temporary token expires (~24h) — refresh during dev; permanent system-user token only past sandbox.
