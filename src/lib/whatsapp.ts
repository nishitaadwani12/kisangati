// Meta WhatsApp Cloud API helpers. Outbound sends use the shop's phone_number_id + access token.
// If no token is configured (local dev), sends are skipped with a log so the flow still works.

import { promises as fs } from "fs";
import path from "path";

const GRAPH = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

// Local folder where downloaded WhatsApp media is stored (gitignored). Served at /media.
export const MEDIA_DIR = path.join(process.cwd(), "media");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
  "video/mp4": "mp4", "application/pdf": "pdf",
};

// Download a WhatsApp media object (2 steps: id → short-lived URL → bytes) to disk.
// Returns the public path (e.g. /media/<id>.ogg) or null if unavailable (no token / failure).
export async function downloadMedia(mediaId: string): Promise<{ publicUrl: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token || !mediaId) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) { console.error("[whatsapp] media meta failed", metaRes.status); return null; }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) { console.error("[whatsapp] media download failed", binRes.status); return null; }
    const buf = Buffer.from(await binRes.arrayBuffer());

    const ext = MIME_EXT[meta.mime_type ?? ""] ?? "bin";
    const file = `${mediaId}.${ext}`;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, file), buf);
    return { publicUrl: `/media/${file}` };
  } catch (e) {
    console.error("[whatsapp] media download error", (e as Error).message);
    return null;
  }
}

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
