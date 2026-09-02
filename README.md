# KisanGati

A national platform connecting farmers, spare-parts shops, and mechanics — order by WhatsApp, pay by UPI,
receive at the village bus stop. See [`DESIGN.md`](DESIGN.md) for architecture, [`specs/`](specs/) for
component specs, and [`docs/`](docs/) for the business plan.

## Prototype layout
- **Backend API** — Node + TypeScript + Express + Prisma (SQLite day-1). Root of repo, in `src/`.
- **Admin dashboard** — React + Vite, in `web/`.
- **Customer app** — Flutter (farmer + mistri), in `app/`.

## Going to production (checklist)
The code is deploy-ready; these are the remaining setup steps:
1. **Postgres** — change `prisma/schema.prisma` datasource `provider` to `postgresql`, set `DATABASE_URL` to the managed DB, and run `prisma migrate deploy`. (Deferred from dev, which uses SQLite.)
2. **Secrets/config** — set a strong `JWT_SECRET`, `CORS_ORIGINS` (dashboard + app origins), and an OTP provider (`OTP_PROVIDER_URL`/`OTP_PROVIDER_AUTH`) so customer login codes are actually sent.
3. **HTTPS** — serve the API over TLS; the Android app then talks HTTPS (cleartext is dev-only, limited to `10.0.2.2`/`localhost` via the network-security config).
4. **App build** — `flutter build apk --release --dart-define=API_BASE=https://<your-api>` (base URL is build-time configurable).
5. **WhatsApp** — complete the Meta setup (see `specs/whatsapp-intake.md`).

## Run locally

First-time setup:
```bash
cp .env.example .env          # fill values as needed
npm install                   # backend deps (auto-runs prisma generate)
npm --prefix web install      # dashboard deps
npx prisma migrate dev        # creates the SQLite DB
```

Then start everything with **one command** (from the repo root):
```bash
npm run dev:all               # runs API (:3000) + dashboard (:5173) together
```

Both auto-reload on save — the API restarts on `src/` changes, the dashboard hot-reloads in the browser.
You do **not** re-run this after code edits. (Prefer separate terminals? `npm run dev` here and
`npm run dev` in `web/`.)

> Exception: after changing `prisma/schema.prisma`, run `npx prisma migrate dev` (or `npx prisma generate`)
> and restart, since the generated client lives outside `src/` and isn't watched.

Open http://localhost:5173.

### Sample data (for viewing the dashboard)
With the API running, populate demo data (10 SKUs, 4 customers, 4 orders across all statuses):

```bash
npm run seed        # drives the real API, so pricing/OTP/cashback logic matches production
```

Demo customers are prefixed `DEMO —` so they're easy to spot. The seed also creates **two shops** and
login accounts so you can see multi-shop isolation (password for all: `kisan123`):

| Email | Role | Sees |
|---|---|---|
| `nishita.kisangati@gmail.com` | SUPER_ADMIN | all shops (with a shop switcher) |
| `satramtractors@gmail.com` | OWNER | Satram Tractors only |
| `relativetractors@gmail.com` | OWNER | Relative Tractor Parts only |

**Before real use, wipe all demo data:**

```bash
npm run db:reset    # clears the database (start clean before entering real orders)
```

## Order flow (what the dashboard drives)
`RECEIVED → QUOTED (send UPI QR) → PAID (manual confirm + UTR) → DISPATCHED (bus + OTP) → DELIVERED (OTP)`.
Mistri cashback is credited on delivery for app-placed mistri orders only.

## Testing
Backend tests live in `tst/` (mirrors `src/`) and run on **vitest** + **supertest** against a throwaway
SQLite DB (`file:./test.db`, reset per test).

```bash
npm test            # run the suite
npm run test:cov    # run with coverage (gate: 100% statements/branches/functions/lines)
```

**Policy — tests ship with each feature.** Every new route, lib function, or branch is added together
with its test in the same change, so coverage never regresses and we never accumulate a testing backlog.
`test:cov` enforces the 100% gate; genuinely-unreachable defensive branches are marked with a justified
`/* c8 ignore */` comment rather than left uncovered.

## Theming
Both surfaces share a 4-palette theme system with a **live switcher** (choice persists locally):
**Kisan Modern** (default — emerald + harvest amber), **Harvest Earth** (terracotta), **Trust Indigo**
(fintech), **Slate Dark**. Dashboard colors are CSS custom properties (`web/src/theme.tsx` +
`styles.css`, switch via the palette dots in the sidebar / on login); the app mirrors them in
`app/lib/theme.dart` (switch via the palette icon in the app bar / dots on login). Add a palette by
adding one entry in each of those two files.

## Notes
- Money is stored in **paise** (integers) everywhere; the UI displays rupees.
- Secrets live in `.env` (gitignored). Never commit tokens or real shop data.
- Commercial params (delivery fee, threshold, cashback %) are env-configurable — see `.env.example`.
