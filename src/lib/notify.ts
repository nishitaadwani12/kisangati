// OTP delivery. Tries channels in order: WhatsApp (reusing the Cloud API sender) → SMS provider → dev log.
// Prod must have WhatsApp (shop number + WHATSAPP_ACCESS_TOKEN) or an SMS provider configured.

import { sendText } from "./whatsapp";

export function otpProviderConfigured(): boolean {
  return !!process.env.OTP_PROVIDER_URL || !!process.env.WHATSAPP_ACCESS_TOKEN;
}

export async function deliverOtp(phone: string, code: string, opts?: { whatsappPhoneNumberId?: string | null }): Promise<void> {
  const message = `KisanGati OTP: ${code} (valid 5 min)`;

  // 1) WhatsApp — preferred, if the shop has a WA number and an access token is configured.
  const pnid = opts?.whatsappPhoneNumberId;
  if (pnid && process.env.WHATSAPP_ACCESS_TOKEN) {
    if (await sendText(pnid, phone, message)) return;
    console.warn("[otp] WhatsApp send failed; falling back");
  }

  // 2) SMS provider — a POST endpoint that accepts { phone, message }.
  const url = process.env.OTP_PROVIDER_URL;
  if (url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.OTP_PROVIDER_AUTH ? { Authorization: process.env.OTP_PROVIDER_AUTH } : {}) },
        body: JSON.stringify({ phone, message }),
      });
      if (res.ok) return;
      console.error("[otp] SMS provider send failed", res.status, await res.text().catch(() => ""));
    } catch (e) {
      console.error("[otp] SMS provider error", (e as Error).message);
    }
  }

  // 3) Dev fallback — no channel configured.
  console.log(`[otp] (dev, no delivery) ${phone} → ${code}`);
}
