# KisanGati

A national platform connecting farmers, spare-parts shops, and mechanics — order by WhatsApp, pay by UPI,
receive at the village bus stop. See [`DESIGN.md`](DESIGN.md) for architecture, [`specs/`](specs/) for
component specs, and [`docs/`](docs/) for the business plan.

## Prototype layout
- **Backend API** — Node + TypeScript + Express + Prisma (SQLite day-1). Root of repo, in `src/`.
- **Admin dashboard** — React + Vite, in `web/`.

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
| `nishita@kisangati.in` | SUPER_ADMIN | all shops (with a shop switcher) |
| `shop1@kisangati.in` | OWNER | Adwani Tractor Spares only |
| `shop2@kisangati.in` | OWNER | Relative Tractor Parts only |

**Before real use, wipe all demo data:**

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
