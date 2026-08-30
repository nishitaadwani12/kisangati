// Demo seed. Creates two shops + login accounts directly (Prisma), then drives the REAL API as each
// shop owner so all business logic (pricing, delivery fee, OTP, cashback) and shop-scoping are exercised.
//
//   1) npm run dev            # start the API first (separate terminal)
//   2) npm run seed           # populate demo data
//
// DEMO data. Before real use, wipe it with:  npm run db:reset
// Login credentials are printed at the end.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BASE = process.env.SEED_BASE || "http://localhost:3000/api";
const db = new PrismaClient();

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`login ${email} → ${data.error}`);
  return data.token;
}

function post(token) {
  return async (path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path} → ${res.status} ${data.error || ""}`);
    return data;
  };
}

const PW = "kisan123"; // demo password for all accounts

async function seedShop(token, skus, custDefs, orderPlan) {
  const P = post(token);
  const sku = {};
  for (const s of skus) sku[s.name] = await P("/skus", s);
  const cust = {};
  for (const c of custDefs) cust[c.key] = await P("/customers", c.body);
  for (const o of orderPlan) await o(P, sku, cust);
  return { skus: skus.length, customers: custDefs.length, orders: orderPlan.length };
}

async function main() {
  console.log(`Seeding demo data → ${BASE}`);

  // Shops + login accounts (created directly; login itself needs them to exist first).
  const shop1 = await db.shop.create({ data: { name: "Adwani Tractor Spares", town: "Jhansi" } });
  const shop2 = await db.shop.create({ data: { name: "Relative Tractor Parts", town: "Jhansi" } });
  const hash = await bcrypt.hash(PW, 10);
  await db.adminUser.create({ data: { email: "nishita@kisangati.in", name: "Nishita (network)", passwordHash: hash, role: "SUPER_ADMIN", shopId: null } });
  await db.adminUser.create({ data: { email: "shop1@kisangati.in", name: "Shop 1 Owner", passwordHash: hash, role: "OWNER", shopId: shop1.id } });
  await db.adminUser.create({ data: { email: "shop2@kisangati.in", name: "Shop 2 Owner", passwordHash: hash, role: "OWNER", shopId: shop2.id } });

  // ---- Shop 1 (the family shop) ----
  const t1 = await login("shop1@kisangati.in", PW);
  await seedShop(t1,
    [
      { name: "Oil Filter", brand: "Mahindra", modelCompat: "575 DI", category: "LOW", retailPrice: 9000, wholesalePrice: 6000, stockQty: 30 },
      { name: "Fan Belt (A-section)", brand: "Fenner", modelCompat: "universal", category: "LOW", retailPrice: 20000, mistriPrice: 17000, wholesalePrice: 13000, stockQty: 25 },
      { name: "Clutch Plate", brand: "Swaraj", modelCompat: "855", category: "MEDIUM", retailPrice: 80000, mistriPrice: 72000, wholesalePrice: 62000, stockQty: 6 },
      { name: "Water Pump Assembly", brand: "Sonalika", modelCompat: "745", category: "MEDIUM", retailPrice: 160000, wholesalePrice: 120000, stockQty: 3 },
      { name: "Brake Plate", brand: "Mahindra", modelCompat: "575", category: "MEDIUM", retailPrice: 40000, wholesalePrice: 28000, stockQty: 10 },
      { name: "Hydraulic Gear Pump", brand: "John Deere", modelCompat: "5310", category: "HIGH", retailPrice: 1500000, wholesalePrice: 1150000, stockQty: 1 },
    ],
    [
      { key: "rajaram", body: { phone: "+919800100001", name: "DEMO — Rajaram", userType: "FARMER", acquisitionChannel: "WHATSAPP" } },
      { key: "sunita", body: { phone: "+919800100002", name: "DEMO — Sunita Devi", userType: "FARMER", acquisitionChannel: "WALK_IN" } },
      { key: "ramesh", body: { phone: "+919800100003", name: "DEMO — Ramesh Mistri", userType: "MISTRI", acquisitionChannel: "APP" } },
      { key: "imran", body: { phone: "+919800100004", name: "DEMO — Imran Mistri", userType: "MISTRI", acquisitionChannel: "MISTRI_REFERRAL" } },
    ],
    [
      async (P, sku, c) => { // RECEIVED
        const o = await P("/orders", { userId: c.rajaram.id, orderSource: "WHATSAPP", rawText: "575 DI ka oil filter, 2 chahiye", tractorBrand: "Mahindra", model: "575 DI" });
        await P(`/orders/${o.id}/items`, { items: [{ skuId: sku["Oil Filter"].id, qty: 2, unitPrice: 9000 }] });
      },
      async (P, sku, c) => { // QUOTED (mistri price)
        const o = await P("/orders", { userId: c.ramesh.id, orderSource: "APP", rawText: "Swaraj 855 clutch plate" });
        await P(`/orders/${o.id}/items`, { items: [{ skuId: sku["Clutch Plate"].id, qty: 1, unitPrice: 72000 }] });
        await P(`/orders/${o.id}/quote`);
      },
      async (P, sku, c) => { // DISPATCHED
        const o = await P("/orders", { userId: c.sunita.id, orderSource: "COUNTER", rawText: "brake plate" });
        await P(`/orders/${o.id}/items`, { items: [{ skuId: sku["Brake Plate"].id, qty: 1, unitPrice: 40000 }] });
        await P(`/orders/${o.id}/quote`);
        await P(`/orders/${o.id}/payment/confirm`, { utr: "418900100003", confirmedBy: "Shop1" });
        await P(`/orders/${o.id}/dispatch`, { busRoute: "Jhansi–Mauranipur", conductorName: "Suresh" });
      },
      async (P, sku, c) => { // DELIVERED (mistri cashback)
        const o = await P("/orders", { userId: c.imran.id, orderSource: "APP", rawText: "Sonalika 745 water pump" });
        await P(`/orders/${o.id}/items`, { items: [{ skuId: sku["Water Pump Assembly"].id, qty: 1, unitPrice: 144000 }] });
        await P(`/orders/${o.id}/quote`);
        await P(`/orders/${o.id}/payment/confirm`, { utr: "418900100004", confirmedBy: "Shop1" });
        const d = await P(`/orders/${o.id}/dispatch`, { busRoute: "Jhansi–Babina", conductorName: "Mohan" });
        await P(`/orders/${o.id}/deliver`, { otp: d.otp });
      },
    ]
  );

  // ---- Shop 2 (relative's shop) — smaller, so isolation is obvious ----
  const t2 = await login("shop2@kisangati.in", PW);
  await seedShop(t2,
    [
      { name: "Air Filter", brand: "Swaraj", modelCompat: "744", category: "LOW", retailPrice: 24000, wholesalePrice: 16000, stockQty: 12 },
      { name: "Tie Rod End", brand: "Universal", modelCompat: "—", category: "MEDIUM", retailPrice: 11000, wholesalePrice: 7000, stockQty: 8 },
      { name: "Diesel Injector", brand: "Mahindra", modelCompat: "Arjun", category: "HIGH", retailPrice: 750000, wholesalePrice: 560000, stockQty: 2 },
    ],
    [
      { key: "gopal", body: { phone: "+919800200001", name: "DEMO — Gopal", userType: "FARMER", acquisitionChannel: "WALK_IN" } },
      { key: "salim", body: { phone: "+919800200002", name: "DEMO — Salim Mistri", userType: "MISTRI", acquisitionChannel: "APP" } },
    ],
    [
      async (P, sku, c) => { // QUOTED
        const o = await P("/orders", { userId: c.gopal.id, orderSource: "WHATSAPP", rawText: "air filter 744" });
        await P(`/orders/${o.id}/items`, { items: [{ skuId: sku["Air Filter"].id, qty: 1, unitPrice: 24000 }] });
        await P(`/orders/${o.id}/quote`);
      },
    ]
  );

  console.log("Done. Shops, accounts, catalog and orders seeded across 2 shops.\n");
  console.log("Login at http://localhost:5173 (password for all: " + PW + "):");
  console.log("  • nishita@kisangati.in  — SUPER_ADMIN (sees all shops)");
  console.log("  • shop1@kisangati.in    — Adwani Tractor Spares (Jhansi)");
  console.log("  • shop2@kisangati.in    — Relative Tractor Parts (Jhansi)");
  await db.$disconnect();
}

main().catch(async (e) => { console.error("Seed failed:", e.message); await db.$disconnect(); process.exit(1); });
