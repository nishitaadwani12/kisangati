// OTP delivery. The single place to plug a real SMS/WhatsApp provider.
// Dev: no provider configured → the code is logged (and returned as devCode by the caller).
// Prod: set OTP_PROVIDER_URL (a POST endpoint that takes {phone, message}) or replace the body
// below with your provider's SDK/HTTP call (MSG91, Twilio, WhatsApp, …).

export function otpProviderConfigured(): boolean {
  return !!process.env.OTP_PROVIDER_URL;
}

export async function deliverOtp(phone: string, code: string): Promise<void> {
  const message = `KisanGati OTP: ${code} (valid 5 min)`;
  const url = process.env.OTP_PROVIDER_URL;
  if (!url) {
    console.log(`[otp] (dev, no provider) ${phone} → ${code}`);
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.OTP_PROVIDER_AUTH ? { Authorization: process.env.OTP_PROVIDER_AUTH } : {}) },
      body: JSON.stringify({ phone, message }),
    });
    if (!res.ok) console.error("[otp] provider send failed", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("[otp] provider send error", (e as Error).message);
  }
}
