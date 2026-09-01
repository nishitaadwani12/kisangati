# Spec — Admin Web Dashboard

**Component:** internal web dashboard (React + Vite).
**Who uses it:** shop staff (father & brother) as the first admins; later, a per-seller portal for other
onboarded shops.
**Purpose:** process every incoming order end-to-end — see it, match the part, take payment, dispatch on the
bus — plus manage catalog and see daily numbers. This is the operational core of the money loop.

> MVP dashboard in one line: **see every order → play voice / view photo (with AI suggestion) → match part +
> price → send UPI QR → confirm payment → print bus label → mark dispatched/delivered**, plus a simple
> catalog and a daily sales number.

## Screens (MVP)
1. **Orders inbox** — list of all orders, newest first, filterable by status; status badges.
2. **Order detail** — the workspace for one order (media, matching, pricing, payment, dispatch).
3. **Catalog** — SKU list + add/edit + stock.
4. **Customers** — list + walk-in onboarding.
5. **Dashboard/home** — today's sales, order counts by status.

## Features

### 1. Order inbox & processing
- **[MVP]** Unified inbox across sources (WhatsApp / app / counter), newest first.
- **[MVP]** Status badges + filter: `RECEIVED → QUOTED → PAID → PACKED → DISPATCHED → DELIVERED`, `CANCELLED`.
- **[MVP]** Order detail: play **voice note**, view **photo**, sender phone, raw message text.
- **[MVP]** **Match to SKU(s)** — search catalog, add one or more line items (qty, unit price).
- **[MVP]** **Set price** → send order summary + **UPI QR** to the customer's WhatsApp (one click).
- **[MVP]** Advance status; **cancel** with a reason (only before dispatch). A cancelled *paid* order flags
  a **refund due**; staff record the refund UTR to mark it **completed**. Refund state lives on the payment.

### 2. Payments
- **[MVP]** **Mark payment received** (manual confirm) → unlocks packing; records who/when.
- **[MVP]** Confirming **requires the UTR / UPI reference number** — staff read it off their own
  "money received" notification, which forces verifying the amount actually landed (a screenshot is
  NOT trusted as proof). UTR is stored on the payment for auditing.
- **[MVP]** Payment status per order (pending / confirmed), with UTR + confirmer visible.
- **[Later]** Auto-confirm via Razorpay webhook (no manual step) — the stored UTR makes this switch seamless.

### 3. Catalog (optional — builds organically, no onboarding burden)
- **[MVP]** No upfront catalog entry or stock counting required. On the order screen, staff **type the part
  name** and pick from **autocomplete suggestions** of previously-saved parts; only if nothing matches do they
  create it once (name + price). The catalog thus **populates itself from real orders**.
- **[MVP]** **Duplicate-proof:** a normalized match-key (case/space/punctuation-insensitive) means `abc-123`
  and `abc 123` resolve to the same saved part — clean price memory and clean AI training data.
- **[MVP]** Catalog page for viewing/editing saved parts; two-tier prices (farmer/mistri).
- **[Optional/Later]** Stock counts + low-stock flag (kept, not required); wholesaler reorder tracking.

### 4. Dispatch & delivery
- **[MVP]** Record **bus route + conductor**; mark **dispatched**.
- **[MVP]** Staff **notify the customer** which bus the parcel is on (manual call/WhatsApp now; auto-WhatsApp later).
- **[MVP]** Mark **delivered** once the customer confirms receipt → triggers mistri cashback if applicable.
- **No OTP** — dropped: there's no village-side checkpoint to verify a code and payment is already collected
  upfront, so it would only add friction for low-literacy farmers.

### 5. Customers & onboarding
- **[MVP]** Customer list: phone, name, type (farmer/mistri), acquisition channel, order history.
- **[MVP]** **Walk-in onboarding** — create customer at counter; introduce app + WhatsApp.
- **[MVP]** **Mistri wallet:** view balance + transaction history (cashback + payouts), and **pay out** the
  full balance (records a PAYOUT txn with UTR, zeroes the balance atomically).

### 6. AI assist (part identification)
- **[Parallel-MVP]** **Suggested parts** panel on each order — ranked candidate SKUs + confidence; staff always confirm.
- **[MVP]** Every staff resolution silently writes a `training_examples` row (builds the future model).

### 7. Analytics
- **[MVP]** Today/this-week: sales total, order count, status breakdown.
- **[Later]** Channel adoption over time, top parts, repeat-customer rate.

### 8. Platform & access
- **[Built]** Login (email + password, hashed with bcrypt) → JWT sessions; all `/api` routes require auth.
- **[Built]** Roles: `OWNER`/`STAFF` (scoped to one shop) and `SUPER_ADMIN` (network-wide, with a shop switcher).
- **[Built]** Multi-shop isolation: orders, catalog, and customers are scoped by `shopId`; a shop cannot read
  another shop's data (cross-shop access → 404). Customer phone is unique per shop.
- **[Built]** Controlled onboarding: the super-admin **Shops** page creates a shop + its owner login (no public
  self-sign-up — shops are vetted).
- **[Later]** Shop self-sign-up flow, per-shop billing, granular staff permissions.

## Data touched (see Prisma schema)
`users`, `orders`, `order_items`, `skus`, `payments`, `deliveries`, `wallet_txns`, `part_predictions`,
`training_examples`.

## API endpoints the dashboard needs (backend, Node/Express)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/orders` | List orders (filter by status). |
| GET | `/api/orders/:id` | Order detail incl. media + line items. |
| POST | `/api/orders/:id/items` | Add/update matched SKU line items + price. |
| POST | `/api/orders/:id/quote` | Send order summary + UPI QR to WhatsApp; set status QUOTED. |
| POST | `/api/orders/:id/payment/confirm` | Mark payment received (manual). |
| POST | `/api/orders/:id/dispatch` | Record route/conductor; status DISPATCHED. |
| POST | `/api/orders/:id/deliver` | Mark delivered (staff-confirmed); credit mistri cashback. |
| POST | `/api/orders/:id/cancel` | Cancel (pre-dispatch) with reason; flag refund DUE if paid. |
| POST | `/api/orders/:id/refund` | Record manual refund (UTR); mark refund COMPLETED. |
| GET/POST/PATCH | `/api/skus` | Catalog CRUD + stock. |
| GET/POST | `/api/customers` | Customer list + walk-in create. |
| GET | `/api/customers/:id/wallet` | Mistri balance + transaction history. |
| POST | `/api/customers/:id/payout` | Pay out full wallet balance (UTR); zero the balance. |
| GET | `/api/stats/today` | Home dashboard numbers. |

## Out of scope (for now)
Farmer/mistri mobile app, Razorpay auto-confirm, multi-tenant seller separation, custom-trained AI model,
mistri services marketplace.
