// Build a UPI payment deep link (upi://pay?...). For the prototype we send this / its QR in the
// WhatsApp chat and confirm receipt manually. Payee VPA + name come from env.
export function buildUpiLink(amountPaise: number, note: string): string {
  const pa = process.env.UPI_VPA || "shop@upi";
  const pn = process.env.UPI_PAYEE_NAME || "KisanGati";
  const am = (amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({ pa, pn, am, cu: "INR", tn: note });
  return `upi://pay?${params.toString()}`;
}
