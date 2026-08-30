// Money helpers — the API speaks paise; the UI speaks rupees.
export const paiseToRupees = (paise: number) => paise / 100;

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Rupees typed in a form → integer paise for the API.
export const rupeesToPaise = (r: string | number) => Math.round(Number(r) * 100);

export const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// Two-tier pricing: mirror the backend's default so the UI suggests the right unit price by role.
// Keep MISTRI_DISCOUNT in sync with the server's MISTRI_DISCOUNT_PERCENT default.
const MISTRI_DISCOUNT = 0.1;
export function suggestedPricePaise(
  sku: { retailPrice: number; mistriPrice: number | null },
  userType: string
): number {
  if (userType === "MISTRI") return sku.mistriPrice ?? Math.round(sku.retailPrice * (1 - MISTRI_DISCOUNT));
  return sku.retailPrice;
}
