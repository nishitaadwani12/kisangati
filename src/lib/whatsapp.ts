// Meta WhatsApp Cloud API helpers. Outbound sends use the shop's phone_number_id + access token.
// If no token is configured (local dev), sends are skipped with a log so the flow still works.

const GRAPH = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

export async function sendText(phoneNumberId: string, to: string, body: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !phoneNumberId) {
    console.warn(`[whatsapp] send skipped (no token/phoneNumberId) → would reply to ${to}: "${body}"`);
    return false;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    if (!res.ok) {
      console.error("[whatsapp] send failed", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[whatsapp] send error", (e as Error).message);
    return false;
  }
}

// Hindi auto-acknowledgement sent the moment an order is logged.
export const ACK_HINDI = "आपका ऑर्डर मिल गया ✅ हम जल्दी कीमत भेजेंगे। — किसानगति";
