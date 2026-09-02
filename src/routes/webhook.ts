import { Router, Request } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "../db";
import { sendText, ACK_HINDI, downloadMedia } from "../lib/whatsapp";
import { mediaKind } from "../lib/media";

// PUBLIC endpoint — Meta calls this; it is NOT behind auth. Verified by a token on GET.
export const webhook = Router();

// Verify Meta's X-Hub-Signature-256 HMAC over the raw body. If WHATSAPP_APP_SECRET is unset (local
// dev / simulated payloads), skip with a warning so testing still works.
function verifySignature(req: Request): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) { console.warn("[whatsapp] WHATSAPP_APP_SECRET unset — skipping signature check (set it before production)."); return true; }
  const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
  const header = req.get("x-hub-signature-256") || "";
  if (!raw || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET /webhook — Meta's verification handshake.
webhook.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Which shop owns the WhatsApp number that received this message?
async function resolveShopId(phoneNumberId?: string): Promise<string | null> {
  if (phoneNumberId) {
    const s = await db.shop.findUnique({ where: { whatsappPhoneNumberId: phoneNumberId } });
    if (s) return s.id;
  }
  if (process.env.DEFAULT_SHOP_ID) return process.env.DEFAULT_SHOP_ID;
  // Convenience for single-shop setups: if only one shop exists, use it.
  if ((await db.shop.count()) === 1) return (await db.shop.findFirst())!.id;
  return null;
}

// Extract a display string + raw media id (if any) from a Meta message object.
function parseMessage(msg: any): { rawText: string; mediaId: string | null } {
  switch (msg.type) {
    case "text": return { rawText: msg.text?.body ?? "", mediaId: null };
    case "image": return { rawText: msg.image?.caption ? `[photo] ${msg.image.caption}` : "[photo]", mediaId: msg.image?.id ?? null };
    case "audio": return { rawText: "[voice note]", mediaId: msg.audio?.id ?? null };
    case "video": return { rawText: "[video]", mediaId: msg.video?.id ?? null };
    case "document": return { rawText: "[document]", mediaId: msg.document?.id ?? null };
    default: return { rawText: `[${msg.type}]`, mediaId: null };
  }
}

// POST /webhook — inbound messages. Always respond 200 quickly (Meta retries non-200s).
webhook.post("/", async (req, res) => {
  if (!verifySignature(req)) return res.sendStatus(401);
  res.sendStatus(200); // ack first; process below
  try {
    const entries = req.body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const messages = value.messages ?? []; // status callbacks have no `messages`
        if (messages.length === 0) continue;
        const phoneNumberId: string | undefined = value.metadata?.phone_number_id;
        const contactName: string | undefined = value.contacts?.[0]?.profile?.name;
        const shopId = await resolveShopId(phoneNumberId);
        if (!shopId) { console.warn(`[whatsapp] no shop for phone_number_id=${phoneNumberId}; ignoring ${messages.length} msg(s)`); continue; }

        for (const msg of messages) {
          try {
            // Dedupe Meta retries on message id.
            if (msg.id && (await db.order.findUnique({ where: { waMessageId: msg.id } }))) continue;

            const from: string = msg.from;
            const { rawText, mediaId } = parseMessage(msg);

            // Upsert customer within this shop (phone unique per shop). Set name only if new.
            let user = await db.user.findUnique({ where: { shopId_phone: { shopId, phone: from } } });
            if (!user) {
              user = await db.user.create({ data: { shopId, phone: from, name: contactName ?? null, userType: "FARMER", acquisitionChannel: "WHATSAPP" } });
            }

            // Create the order first (captured even if media download fails); keep the media id as fallback.
            const order = await db.order.create({
              data: { shopId, userId: user.id, orderSource: "WHATSAPP", rawText, mediaUrl: mediaId ? `wa-media:${mediaId}` : null, waMessageId: msg.id ?? null, status: "RECEIVED" },
            });

            // Reply immediately, then fetch the actual media file and attach a playable/viewable path.
            if (phoneNumberId) await sendText(phoneNumberId, from, ACK_HINDI);
            if (mediaId) {
              const dl = await downloadMedia(mediaId);
              if (dl) {
                await db.order.update({ where: { id: order.id }, data: { mediaUrl: dl.publicUrl } });
                await db.orderMedia.create({ data: { orderId: order.id, url: dl.publicUrl, kind: mediaKind(dl.publicUrl) } });
              }
            }
          } catch (e) {
            console.error("[whatsapp] message handling error", (e as Error).message);
          }
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp] webhook error", (e as Error).message);
  }
});
