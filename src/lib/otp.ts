import { createHash, randomInt } from "crypto";

// 4-digit delivery OTP. We store only the hash; the plaintext is shown once to staff at dispatch
// so they can hand it to the conductor / farmer. Never persist the plaintext.
export function generateOtp(): string {
  return String(randomInt(1000, 10000)); // 1000–9999
}

export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp.trim()).digest("hex");
}

export function verifyOtp(otp: string, hash: string): boolean {
  return hashOtp(otp) === hash;
}
