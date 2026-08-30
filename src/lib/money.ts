// All money is stored and computed in paise (integers) to avoid floating-point rounding.
// 1 rupee = 100 paise.
//
// These commercial parameters are configurable via env (defaults below) so they can be tuned
// without code changes. A DB-backed settings table can replace this later so non-technical staff
// can edit them live. Env values are read in rupees for readability and converted to paise.

function rupeesEnvToPaise(name: string, defaultRupees: number): number {
  const v = Number(process.env[name]);
  return Math.round((Number.isFinite(v) && v >= 0 ? v : defaultRupees) * 100);
}

// Delivery-fee rule (prototype): flat fee on orders under a threshold, free above.
export const DELIVERY_FEE_PAISE = rupeesEnvToPaise("DELIVERY_FEE_RUPEES", 40); // ₹40
export const FREE_DELIVERY_THRESHOLD_PAISE = rupeesEnvToPaise("FREE_DELIVERY_THRESHOLD_RUPEES", 1000); // ₹1,000

export function deliveryFeeFor(subtotalPaise: number): number {
  return subtotalPaise > 0 && subtotalPaise < FREE_DELIVERY_THRESHOLD_PAISE ? DELIVERY_FEE_PAISE : 0;
}

// Mistri cashback rate — credited only on app-placed mistri orders (see commission rule).
function cashbackRate(): number {
  const pct = Number(process.env.CASHBACK_PERCENT);
  return Number.isFinite(pct) && pct >= 0 ? pct / 100 : 0.04; // default 4%
}
export const CASHBACK_RATE = cashbackRate();

export function cashbackFor(subtotalPaise: number): number {
  return Math.round(subtotalPaise * CASHBACK_RATE);
}
