import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { api, makeShop, db } from "../setup/helpers";

beforeEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const textPayload = (pnid: string, from: string, id: string, body = "hi") =>
  JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { metadata: { phone_number_id: pnid }, contacts: [{ profile: { name: "Kishan" } }], messages: [{ from, id, type: "text", text: { body } }] }, field: "messages" }] }] });

const post = (raw: string, headers: Record<string, string> = {}) =>
  api().post("/webhook").set("Content-Type", "application/json").set(headers).send(raw);

async function waitOrder(where: object) {
  for (let i = 0; i < 60; i++) {
    const o = await db.order.findFirst({ where, include: { media: true } });
    if (o) return o;
    await new Promise((r) => setTimeout(r, 20));
  }
  return null;
}

describe("GET /webhook (verification)", () => {
  it("echoes the challenge when the verify token matches", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "vt");
    const res = await api().get("/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=12345");
    expect(res.status).toBe(200);
    expect(res.text).toBe("12345");
  });
  it("403 on a wrong verify token", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "vt");
    expect((await api().get("/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1")).status).toBe(403);
  });
});

describe("POST /webhook (intake)", () => {
  it("with no app secret, skips signature and creates an order routed by phone_number_id", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const shop = await makeShop({ whatsappPhoneNumberId: "PNID1" });
    const res = await post(textPayload("PNID1", "919811111111", "wamid.T1"));
    expect(res.status).toBe(200);
    const o = await waitOrder({ waMessageId: "wamid.T1" });
    expect(o?.shopId).toBe(shop.id);
    expect(o?.rawText).toBe("hi");
  });
  it("dedupes on the WhatsApp message id", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await makeShop({ whatsappPhoneNumberId: "PNID2" });
    await post(textPayload("PNID2", "919811111112", "wamid.DUP"));
    await waitOrder({ waMessageId: "wamid.DUP" });
    await post(textPayload("PNID2", "919811111112", "wamid.DUP"));
    await new Promise((r) => setTimeout(r, 100));
    expect(await db.order.count({ where: { waMessageId: "wamid.DUP" } })).toBe(1);
  });
  it("ignores a status callback (no messages)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await makeShop({ whatsappPhoneNumberId: "PNID3" });
    const raw = JSON.stringify({ object: "x", entry: [{ changes: [{ value: { metadata: { phone_number_id: "PNID3" }, statuses: [{ id: "s", status: "delivered" }] }, field: "messages" }] }] });
    expect((await post(raw)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.order.count()).toBe(0);
  });
  it("ignores messages when the phone_number_id maps to no shop (and >1 shop exists)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await makeShop(); await makeShop();
    await post(textPayload("UNMAPPED", "919811111113", "wamid.U1"));
    await new Promise((r) => setTimeout(r, 80));
    expect(await db.order.count()).toBe(0);
  });
  it("falls back to DEFAULT_SHOP_ID for an unmapped number", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = await makeShop(); await makeShop();
    vi.stubEnv("DEFAULT_SHOP_ID", a.id);
    await post(textPayload("WHATEVER", "919811111114", "wamid.D1"));
    const o = await waitOrder({ waMessageId: "wamid.D1" });
    expect(o?.shopId).toBe(a.id);
  });
  it("falls back to the only shop when exactly one exists", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const only = await makeShop();
    await post(textPayload("XYZ", "919811111115", "wamid.S1"));
    const o = await waitOrder({ waMessageId: "wamid.S1" });
    expect(o?.shopId).toBe(only.id);
  });
  it("downloads photo/audio media into OrderMedia", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => "" }) // ACK sendText
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ url: "https://dl/x", mime_type: "image/jpeg" }), text: async () => "" }) // media metadata
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode("IMG").buffer, text: async () => "" })); // media bytes
    await makeShop({ whatsappPhoneNumberId: "PNIDM" });
    const raw = JSON.stringify({ object: "x", entry: [{ changes: [{ value: { metadata: { phone_number_id: "PNIDM" }, messages: [{ from: "919811111116", id: "wamid.M1", type: "image", image: { id: "MID1", caption: "part" } }] }, field: "messages" }] }] });
    await post(raw);
    const o = await waitOrder({ waMessageId: "wamid.M1" });
    expect(o?.media?.[0]?.kind).toBe("photo");
  });

  const msgPayload = (pnid: string, msg: object) =>
    JSON.stringify({ object: "x", entry: [{ changes: [{ value: { metadata: { phone_number_id: pnid }, messages: [msg] }, field: "messages" }] }] });

  it("parses every message type into a display rawText", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const shop = await makeShop({ whatsappPhoneNumberId: "PTYPE" });
    const cases: Array<[object, string]> = [
      [{ from: "9111", id: "wa.audio", type: "audio", audio: { id: "A1" } }, "[voice note]"],
      [{ from: "9112", id: "wa.video", type: "video", video: { id: "V1" } }, "[video]"],
      [{ from: "9113", id: "wa.doc", type: "document", document: { id: "D1" } }, "[document]"],
      [{ from: "9114", id: "wa.img", type: "image", image: { id: "I1" } }, "[photo]"], // no caption
      [{ from: "9115", id: "wa.other", type: "reaction" }, "[reaction]"], // default
    ];
    for (const [msg, expected] of cases) {
      await post(msgPayload("PTYPE", msg));
      const o = await waitOrder({ waMessageId: (msg as { id: string }).id });
      expect(o?.rawText).toBe(expected);
      expect(o?.shopId).toBe(shop.id);
    }
  });
  it("accepts a message with no id (skips dedupe, stores null waMessageId)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await makeShop({ whatsappPhoneNumberId: "PNOID" });
    await post(msgPayload("PNOID", { from: "9120", type: "text", text: { body: "no id here" } }));
    const o = await waitOrder({ rawText: "no id here" });
    expect(o?.waMessageId).toBeNull();
  });
  it("handles messages missing their nested media/text sub-objects", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await makeShop({ whatsappPhoneNumberId: "PBARE" });
    const bare: Array<[object, string]> = [
      [{ from: "9130", id: "wa.btext", type: "text" }, ""], // no text.body
      [{ from: "9131", id: "wa.bimg", type: "image" }, "[photo]"], // no image object
      [{ from: "9132", id: "wa.baud", type: "audio" }, "[voice note]"], // no audio object
      [{ from: "9133", id: "wa.bvid", type: "video" }, "[video]"], // no video object
      [{ from: "9134", id: "wa.bdoc", type: "document" }, "[document]"], // no document object
    ];
    for (const [msg, expected] of bare) {
      await post(msgPayload("PBARE", msg));
      const o = await waitOrder({ waMessageId: (msg as { id: string }).id });
      expect(o?.rawText).toBe(expected);
      expect(o?.mediaUrl).toBeNull(); // no media id → no wa-media placeholder
    }
  });
  it("returns 200 for structurally-empty payloads (no entry / changes / value)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await post(JSON.stringify({}))).status).toBe(200); // no entry
    expect((await post(JSON.stringify({ entry: [{}] }))).status).toBe(200); // no changes
    expect((await post(JSON.stringify({ entry: [{ changes: [{}] }] }))).status).toBe(200); // no value
    await new Promise((r) => setTimeout(r, 40));
    expect(await db.order.count()).toBe(0);
  });

  it("swallows a per-message error (missing 'from') without crashing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const only = await makeShop(); // single-shop fallback resolves the shop
    const raw = JSON.stringify({ object: "x", entry: [{ changes: [{ value: { metadata: { phone_number_id: "P" }, messages: [{ id: "wamid.NOFROM", type: "text", text: { body: "hi" } }] }, field: "messages" }] }] });
    expect((await post(raw)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 80));
    expect(await db.order.count({ where: { shopId: only.id } })).toBe(0);
  });
  it("swallows a malformed payload (non-iterable changes) in the outer handler", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const raw = JSON.stringify({ object: "x", entry: [{ changes: 12345 }] });
    expect((await post(raw)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 40));
  });

  describe("with an app secret configured", () => {
    it("401 on a bad signature", async () => {
      vi.stubEnv("WHATSAPP_APP_SECRET", "sekret");
      await makeShop({ whatsappPhoneNumberId: "PNIDS" });
      const raw = textPayload("PNIDS", "919811111117", "wamid.BAD");
      expect((await post(raw, { "x-hub-signature-256": "sha256=deadbeef" })).status).toBe(401);
    });
    it("401 when the signature header is missing entirely", async () => {
      vi.stubEnv("WHATSAPP_APP_SECRET", "sekret");
      await makeShop({ whatsappPhoneNumberId: "PNIDS3" });
      const raw = textPayload("PNIDS3", "919811111119", "wamid.NOSIG");
      expect((await post(raw)).status).toBe(401); // no x-hub-signature-256 header
    });
    it("401 when there is no raw body to verify (non-JSON content type)", async () => {
      vi.stubEnv("WHATSAPP_APP_SECRET", "sekret");
      // text/plain → express.json doesn't run → no rawBody captured → signature check fails closed.
      const res = await api().post("/webhook").set("Content-Type", "text/plain").send("not json");
      expect(res.status).toBe(401);
    });
    it("200 on a valid signature", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubEnv("WHATSAPP_APP_SECRET", "sekret");
      const shop = await makeShop({ whatsappPhoneNumberId: "PNIDS2" });
      const raw = textPayload("PNIDS2", "919811111118", "wamid.GOOD");
      const sig = "sha256=" + createHmac("sha256", "sekret").update(raw).digest("hex");
      expect((await post(raw, { "x-hub-signature-256": sig })).status).toBe(200);
      const o = await waitOrder({ waMessageId: "wamid.GOOD" });
      expect(o?.shopId).toBe(shop.id);
    });
  });
});
