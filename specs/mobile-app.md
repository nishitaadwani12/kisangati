# Spec — Customer Mobile App (Flutter) + Customer API

**Component:** the Flutter customer app (farmers + mistris) and the backend customer API it talks to.
**Status:** **[BUILT — partial]** runs on Android emulator + web (Chrome). Voice/photo ordering is next.

## Customer API (backend, `/app/*`)
Distinct from the admin API — customer JWTs (`customer: true`) are rejected by the admin routes and vice
versa. All `/app` routes (except auth) require a customer token and are scoped to the token's `shopId`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/app/auth/shops` | Public — list shops so the customer picks theirs at login. |
| POST | `/app/auth/request-otp` | `{shopId, phone}` → issues an OTP. Dev returns `devCode` (no SMS yet). |
| POST | `/app/auth/verify-otp` | `{shopId, phone, code, name?}` → customer JWT; find-or-create the customer (self-signup = FARMER; mistris are marked by staff). |
| GET | `/app/me` | Profile (name, phone, userType, walletBalance, shopName). |
| GET | `/app/catalog?q=` | Shop catalog, each item priced for THIS customer's role (farmer vs mistri). |
| POST | `/app/orders` | Place order: `items[]` → priced + `QUOTED` (+ UPI link); `rawText`/`mediaUrl` → `RECEIVED`. |
| GET | `/app/orders` / `/app/orders/:id` | My orders / detail (scoped to the customer). |
| GET | `/app/wallet` | Mistri balance + transaction history. |
| POST | `/app/media` | Multipart upload (field `file`) → `/media/<file>` URL (for voice/photo orders). |

OTP store is in-memory (dev); move to Redis + real SMS/WhatsApp delivery before prod.

## Flutter app (`app/`)
- **Stack:** Flutter (Dart), `http`, `shared_preferences` (token). Material 3, green brand.
- **Base URL:** `localhost:3000` on web, `10.0.2.2:3000` on the Android emulator (see `lib/api.dart`).
- **Screens:** Login (shop → phone → OTP) → Home tabs: **My Orders**, **New Order** (text now), and for
  mistris **Catalog** (one-tap order) + **Wallet**.

### Built
Login, My Orders, text New Order, mistri Catalog + one-tap order, Wallet; token auth + isolation.

### Next / planned
- **Voice + photo ordering** (farmer core): record audio / pick photo → `POST /app/media` → attach `mediaUrl`
  to `POST /app/orders`.
- App **Hindi / HI-EN toggle**, bigger low-literacy-friendly UI, cart + reorder for mistris, push
  notifications, offline cache, UPI checkout deep-link.

## Run locally
```
npm run dev            # backend :3000 (repo root)
npm run seed           # demo data (once)
cd app && flutter run -d chrome            # web preview
cd app && flutter run -d emulator-5554     # Android emulator
```
