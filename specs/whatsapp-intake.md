# Spec — WhatsApp Intake

**Component:** Meta WhatsApp Cloud API webhook → auto-creates orders (incl. media download). **[BUILT]**
**Why:** the farmer-facing half of the money loop — a farmer messages the shop's WhatsApp number and an
order appears in the dashboard, with an automatic Hindi acknowledgement.

## Endpoints (public — Meta calls them; NOT behind JWT auth)
- **GET `/webhook`** — Meta's verification handshake: echoes `hub.challenge` when `hub.verify_token`
  matches `WHATSAPP_VERIFY_TOKEN`, else 403.
- **POST `/webhook`** — inbound messages. Responds **200 immediately** (Meta retries non-200s), then processes.

## Flow
1. Parse `entry[].changes[].value`. Skip payloads with no `messages` (e.g. delivery status callbacks).
2. **Route to a shop** by `value.metadata.phone_number_id` → `Shop.whatsappPhoneNumberId`. Fallbacks:
   `DEFAULT_SHOP_ID`, or the only shop if exactly one exists; otherwise log + ignore.
3. **Dedupe** on WhatsApp message id (`Order.waMessageId` unique) — Meta retries.
4. **Upsert customer** within the shop (`users` phone unique per shop); name from `contacts[].profile.name`
   if new; `user_type=FARMER`, `acquisition_channel=WHATSAPP`.
5. **Create order** (`status=RECEIVED`, `order_source=WHATSAPP`): text → `raw_text`; image/audio/etc. →
   a marker in `raw_text` (`[photo]`, `[voice note]`) + the media id in `media_url` as `wa-media:<id>`.
6. **Auto-reply** the Hindi ack via the Cloud API (`sendText`). Skipped with a log if no access token (dev).
7. **Download media** (voice/photo): fetch the file (2 steps: media id → short-lived URL → bytes), store
   under `media/<id>.<ext>` (gitignored), and update `order.media_url` to `/media/<file>` — served by the
   API and rendered/playable in the dashboard. If download fails (no token), the order keeps the
   `wa-media:<id>` fallback and nothing breaks.

## Config (.env)
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`
(default `v21.0`), optional `DEFAULT_SHOP_ID`. Per-shop routing uses `Shop.whatsappPhoneNumberId`.

## Multi-tenant note
Each shop has its own WhatsApp number → its own `phone_number_id`, so inbound messages land in the right
shop automatically. The seed sets Satram Tractors' number to `TEST_PNID_SHOP1` for local testing.

## Deferred (not built)
- Interactive Confirm button + in-chat UPI QR delivery (needs a live number + templates).
- `X-Hub-Signature-256` payload signature verification (add before production).
- Outbound status/OTP/delivery notifications to the farmer.

## Local testing
`npm run dev`, then POST a crafted Meta payload to `/webhook` (see the E2E test in the WhatsApp-intake
commit). Real testing needs a Meta app + a tunnel (ngrok) registering the public `/webhook` URL — those are
browser/console steps the founder does (CLAUDE.md Step 2).
