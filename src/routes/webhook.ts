import { Router } from "express";
import { db } from "../db";
import { sendText, ACK_HINDI } from "../lib/whatsapp";

// PUBLIC endpoint — Meta calls this; it is NOT behind auth. Verified by a token on GET.
export const webhook = Router();

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

// Extract a display string + media id from a Meta message object.
function parseMessage(msg: any): { rawText: string; mediaUrl: string | null } {
  switch (msg.type) {
    case "text": return { rawText: msg.text?.body ?? "", mediaUrl: null };
    case "image": return { rawText: msg.image?.caption ? `[photo] ${msg.image.caption}` : "[photo]", mediaUrl: `wa-media:${msg.image?.id}` };
    case "audio": return { rawText: "[voice note]", mediaUrl: `wa-media:${msg.audio?.id}` };
    case "video": return { rawText: "[video]", mediaUrl: `wa-media:${msg.video?.id}` };
    case "document": return { rawText: "[document]", mediaUrl: `wa-media:${msg.document?.id}` };
    default: return { rawText: `[${msg.type}]`, mediaUrl: null };
  }
}

// POST /webhook — inbound messages. Always respond 200 quickly (Meta retries non-200s).
webhook.post("/", async (req, res) => {
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
            const { rawText, mediaUrl } = parseMessage(msg);

            // Upsert customer within this shop (phone unique per shop). Set name only if new.
            let user = await db.user.findUnique({ where: { shopId_phone: { shopId, phone: from } } });
            if (!user) {
              user = await db.user.create({ data: { shopId, phone: from, name: contactName ?? null, userType: "FARMER", acquisitionChannel: "WHATSAPP" } });
            }

            await db.order.create({
              data: { shopId, userId: user.id, orderSource: "WHATSAPP", rawText, mediaUrl, waMessageId: msg.id ?? null, status: "RECEIVED" },
            });

            if (phoneNumberId) await sendText(phoneNumberId, from, ACK_HINDI);
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
