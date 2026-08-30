# KisanGati

A national platform connecting farmers, spare-parts shops, and mechanics — order by WhatsApp, pay by UPI,
receive at the village bus stop. See [`DESIGN.md`](DESIGN.md) for architecture, [`specs/`](specs/) for
component specs, and [`docs/`](docs/) for the business plan.

## Prototype layout
- **Backend API** — Node + TypeScript + Express + Prisma (SQLite day-1). Root of repo, in `src/`.
- **Admin dashboard** — React + Vite, in `web/`.

## Run locally
Two terminals:

```bash
# 1) Backend API (http://localhost:3000)
cp .env.example .env          # first time only; fill values as needed
npm install
npx prisma migrate dev        # first time only — creates the SQLite DB
npm run dev

# 2) Admin dashboard (http://localhost:5173, proxies /api to the backend)
cd web
npm install
npm run dev
```

Open http://localhost:5173.

### Sample data (for viewing the dashboard)
With the API running, populate demo data (10 SKUs, 4 customers, 4 orders across all statuses):

```bash
npm run seed        # drives the real API, so pricing/OTP/cashback logic matches production
```

Demo customers are prefixed `DEMO —` so they're easy to spot. **Before real use, wipe all demo data:**

```bash
npm run db:reset    # clears the database (start clean before entering real orders)
```

## Order flow (what the dashboard drives)
`RECEIVED → QUOTED (send UPI QR) → PAID (manual confirm + UTR) → DISPATCHED (bus + OTP) → DELIVERED (OTP)`.
Mistri cashback is credited on delivery for app-placed mistri orders only.

## Notes
- Money is stored in **paise** (integers) everywhere; the UI displays rupees.
- Secrets live in `.env` (gitignored). Never commit tokens or real shop data.
- Commercial params (delivery fee, threshold, cashback %) are env-configurable — see `.env.example`.
