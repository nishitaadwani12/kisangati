import { createHash, randomInt } from "crypto";

// In-memory OTP store for the customer app (prototype). Lost on restart — fine for dev.
// Move to Redis with real SMS/WhatsApp delivery before production.
type Entry = { codeHash: string; expires: number };
const store = new Map<string, Entry>();
const OTP_TTL_MS = 5 * 60 * 1000;

const key = (shopId: string, phone: string) => `${shopId}:${phone}`;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export function issueOtp(shopId: string, phone: string): string {
  const code = String(randomInt(100000, 1000000)); // 6-digit
  store.set(key(shopId, phone), { codeHash: hash(code), expires: Date.now() + OTP_TTL_MS });
  return code;
}

export function checkOtp(shopId: string, phone: string, code: string): boolean {
  const e = store.get(key(shopId, phone));
  if (!e || Date.now() > e.expires) return false;
  const ok = e.codeHash === hash(code);
  if (ok) store.delete(key(shopId, phone)); // one-time use
  return ok;
}
