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
- **[MVP]** Advance status; **cancel** with a reason.

### 2. Payments
- **[MVP]** **Mark payment received** (manual confirm) → unlocks packing; records who/when.
- **[MVP]** Payment status per order (pending / confirmed).
- **[Later]** Auto-confirm via Razorpay webhook (no manual step).

### 3. Inventory & catalog
- **[MVP]** SKU list: brand, model fit, retail price, wholesale cost, weight, **stock count**.
- **[MVP]** Add / edit SKU; adjust stock.
- **[MVP]** Low-stock flag.
- **[Later]** Wholesaler reorder tracking.

### 4. Dispatch & delivery
- **[MVP]** Generate **thermal shipping label**: bus route + conductor + 4-digit **OTP**.
- **[MVP]** Assign route/conductor; mark **dispatched**.
- **[MVP]** Confirm **delivered** (OTP claimed) → triggers mistri cashback if applicable.

### 5. Customers & onboarding
- **[MVP]** Customer list: phone, name, type (farmer/mistri), acquisition channel, order history.
- **[MVP]** **Walk-in onboarding** — create customer at counter; introduce app + WhatsApp.
- **[Later]** Mistri wallet view (cashback balance, payouts).

### 6. AI assist (part identification)
- **[Parallel-MVP]** **Suggested parts** panel on each order — ranked candidate SKUs + confidence; staff always confirm.
- **[MVP]** Every staff resolution silently writes a `training_examples` row (builds the future model).

### 7. Analytics
- **[MVP]** Today/this-week: sales total, order count, status breakdown.
- **[Later]** Channel adoption over time, top parts, repeat-customer rate.

### 8. Platform & access
- **[Later]** Roles/permissions (owner vs staff).
- **[Later]** Multi-shop: each seller sees only its own data; network-wide admin view for the founder.

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
| POST | `/api/orders/:id/dispatch` | Assign route/conductor, generate OTP + label; status DISPATCHED. |
| POST | `/api/orders/:id/deliver` | Confirm OTP delivered; credit mistri cashback. |
| GET/POST/PATCH | `/api/skus` | Catalog CRUD + stock. |
| GET/POST | `/api/customers` | Customer list + walk-in create. |
| GET | `/api/stats/today` | Home dashboard numbers. |

## Out of scope (for now)
Farmer/mistri mobile app, Razorpay auto-confirm, multi-tenant seller separation, custom-trained AI model,
mistri services marketplace.
