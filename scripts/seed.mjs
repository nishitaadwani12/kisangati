// Demo seed for the dashboard. Drives the REAL API (server must be running on :3000) so all
// business logic (pricing, delivery fee, OTP, cashback) matches production behaviour exactly.
//
//   1) npm run dev            # start the API first (separate terminal)
//   2) npm run seed           # populate demo data
//
// This is DEMO data for viewing the dashboard. Before real use, wipe it with:  npm run db:reset
// Demo customers are prefixed "DEMO —" so they're easy to spot.

const BASE = process.env.SEED_BASE || "http://localhost:3000/api";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data.error || ""}`);
  return data;
}

// Prices in paise. mistriPrice omitted on some SKUs to show the auto-discount fallback.
const SKUS = [
  { name: "Oil Filter", brand: "Mahindra", modelCompat: "575 DI", category: "LOW", retailPrice: 9000, wholesalePrice: 6000, stockQty: 30 },
  { name: "Air Filter", brand: "Swaraj", modelCompat: "744", category: "LOW", retailPrice: 22000, wholesalePrice: 15000, stockQty: 20 },
  { name: "Fan Belt (A-section)", brand: "Fenner", modelCompat: "universal", category: "LOW", retailPrice: 20000, mistriPrice: 17000, wholesalePrice: 13000, stockQty: 25 },
  { name: "Fuel Filter", brand: "Ford", modelCompat: "3600", category: "LOW", retailPrice: 33000, wholesalePrice: 22000, stockQty: 4 },
  { name: "Clutch Plate", brand: "Swaraj", modelCompat: "855", category: "MEDIUM", retailPrice: 80000, mistriPrice: 72000, wholesalePrice: 62000, stockQty: 6 },
  { name: "Water Pump Assembly", brand: "Sonalika", modelCompat: "745", category: "MEDIUM", retailPrice: 160000, wholesalePrice: 120000, stockQty: 3 },
  { name: "Brake Plate", brand: "Mahindra", modelCompat: "575", category: "MEDIUM", retailPrice: 40000, wholesalePrice: 28000, stockQty: 10 },
  { name: "Tie Rod End (forged)", brand: "Universal", modelCompat: "—", category: "MEDIUM", retailPrice: 11000, wholesalePrice: 7000, stockQty: 15 },
  { name: "Hydraulic Gear Pump", brand: "John Deere", modelCompat: "5310", category: "HIGH", retailPrice: 1500000, wholesalePrice: 1150000, stockQty: 1 },
  { name: "Diesel Injector", brand: "Mahindra", modelCompat: "Arjun", category: "HIGH", retailPrice: 750000, wholesalePrice: 560000, stockQty: 2 },
];

async function main() {
  console.log(`Seeding demo data → ${BASE}`);
  const sku = {};
  for (const s of SKUS) sku[s.name] = await post("/skus", s);
  console.log(`  ${SKUS.length} SKUs`);

  const rajaram = await post("/customers", { phone: "+919800100001", name: "DEMO — Rajaram", userType: "FARMER", acquisitionChannel: "WHATSAPP" });
  const sunita = await post("/customers", { phone: "+919800100002", name: "DEMO — Sunita Devi", userType: "FARMER", acquisitionChannel: "WALK_IN" });
  const ramesh = await post("/customers", { phone: "+919800100003", name: "DEMO — Ramesh Mistri", userType: "MISTRI", acquisitionChannel: "APP" });
  const imran = await post("/customers", { phone: "+919800100004", name: "DEMO — Imran Mistri", userType: "MISTRI", acquisitionChannel: "MISTRI_REFERRAL" });
  console.log("  4 customers");

  // Order 1 — RECEIVED (fresh WhatsApp order, farmer price)
  const o1 = await post("/orders", { userId: rajaram.id, orderSource: "WHATSAPP", rawText: "575 DI ka oil filter, 2 chahiye", tractorBrand: "Mahindra", model: "575 DI" });
  await post(`/orders/${o1.id}/items`, { items: [{ skuId: sku["Oil Filter"].id, qty: 2, unitPrice: 9000 }] });

  // Order 2 — QUOTED (mistri, discounted price)
  const o2 = await post("/orders", { userId: ramesh.id, orderSource: "APP", rawText: "Swaraj 855 clutch plate" });
  await post(`/orders/${o2.id}/items`, { items: [{ skuId: sku["Clutch Plate"].id, qty: 1, unitPrice: 72000 }] });
  await post(`/orders/${o2.id}/quote`);

  // Order 3 — DISPATCHED (farmer, on the bus)
  const o3 = await post("/orders", { userId: sunita.id, orderSource: "COUNTER", rawText: "brake plate" });
  await post(`/orders/${o3.id}/items`, { items: [{ skuId: sku["Brake Plate"].id, qty: 1, unitPrice: 40000 }] });
  await post(`/orders/${o3.id}/quote`);
  await post(`/orders/${o3.id}/payment/confirm`, { utr: "418900100003", confirmedBy: "Nishita" });
  await post(`/orders/${o3.id}/dispatch`, { busRoute: "Jhansi–Mauranipur", conductorName: "Suresh" });

  // Order 4 — DELIVERED (mistri, full lifecycle → cashback credited)
  const o4 = await post("/orders", { userId: imran.id, orderSource: "APP", rawText: "Sonalika 745 water pump" });
  await post(`/orders/${o4.id}/items`, { items: [{ skuId: sku["Water Pump Assembly"].id, qty: 1, unitPrice: 144000 }] });
  await post(`/orders/${o4.id}/quote`);
  await post(`/orders/${o4.id}/payment/confirm`, { utr: "418900100004", confirmedBy: "brother" });
  const disp = await post(`/orders/${o4.id}/dispatch`, { busRoute: "Jhansi–Babina", conductorName: "Mohan" });
  await post(`/orders/${o4.id}/deliver`, { otp: disp.otp });

  console.log("  4 orders (RECEIVED, QUOTED, DISPATCHED, DELIVERED)");
  console.log("Done. Open http://localhost:5173");
}

main().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
