// All money is stored and computed in paise (integers) to avoid floating-point rounding.
// 1 rupee = 100 paise.

// Delivery-fee rule (prototype, from the business plan): flat ₹40 on orders under ₹1,000, free above.
// Tunable via env later; kept simple here.
export const DELIVERY_FEE_PAISE = 40 * 100; // ₹40
export const FREE_DELIVERY_THRESHOLD_PAISE = 1000 * 100; // ₹1,000

export function deliveryFeeFor(subtotalPaise: number): number {
  return subtotalPaise > 0 && subtotalPaise < FREE_DELIVERY_THRESHOLD_PAISE ? DELIVERY_FEE_PAISE : 0;
}

// Mistri cashback rate — credited only on app-placed mistri orders (see commission rule).
export const CASHBACK_RATE = 0.04; // 4%

export function cashbackFor(subtotalPaise: number): number {
  return Math.round(subtotalPaise * CASHBACK_RATE);
}
