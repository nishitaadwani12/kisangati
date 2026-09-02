import { describe, it, expect, beforeEach } from "vitest";
import { api, makeShop, makeCustomer, makeSku, db } from "../setup/helpers";

let shopId: string, farmerTok: string, mistriTok: string, farmerId: string, skuId: string;

beforeEach(async () => {
  const shop = await makeShop();
  shopId = shop.id;
  const farmer = await makeCustomer(shopId, "FARMER");
  farmerTok = farmer.token; farmerId = farmer.user.id;
  mistriTok = (await makeCustomer(shopId, "MISTRI")).token;
  skuId = (await makeSku(shopId, { name: "Clutch", retailPrice: 100000, mistriPrice: 90000 })).id;
});
const bearer = (tk: string) => ({ Authorization: `Bearer ${tk}` });

describe("/app/me + catalog", () => {
  it("me returns the profile", async () => {
    const res = await api().get("/app/me").set(bearer(farmerTok));
    expect(res.body.userType).toBe("FARMER");
    expect(res.body.shopName).toBeTruthy();
  });
  it("me 401 once the account has been deleted", async () => {
    await db.user.delete({ where: { id: farmerId } });
    expect((await api().get("/app/me").set(bearer(farmerTok))).status).toBe(401);
  });
  it("catalog prices by role and supports search", async () => {
    expect((await api().get("/app/catalog").set(bearer(farmerTok))).body[0].price).toBe(100000);
    expect((await api().get("/app/catalog").set(bearer(mistriTok))).body[0].price).toBe(90000);
    expect((await api().get("/app/catalog?q=clutch").set(bearer(farmerTok))).body.length).toBe(1);
    expect((await api().get("/app/catalog?q=zzz").set(bearer(farmerTok))).body.length).toBe(0);
  });
});

describe("POST /app/orders", () => {
  it("catalog order → QUOTED + upiLink; text order → RECEIVED", async () => {
    const q = await api().post("/app/orders").set(bearer(mistriTok)).send({ items: [{ skuId, qty: 2 }] });
    expect(q.body.order.status).toBe("QUOTED");
    expect(q.body.order.total).toBe(180000); // 2 × mistri 90000, free delivery
    expect(q.body.upiLink).toContain("upi://");
    const t = await api().post("/app/orders").set(bearer(farmerTok)).send({ rawText: "need clutch" });
    expect(t.body.order.status).toBe("RECEIVED");
  });
  it("attaches multiple media as OrderMedia", async () => {
    const res = await api().post("/app/orders").set(bearer(farmerTok)).send({ mediaUrls: ["/media/a.png", "/media/b.m4a"] });
    const kinds = res.body.order.media.map((m: { kind: string }) => m.kind).sort();
    expect(kinds).toEqual(["photo", "voice"]);
  });
  it("accepts a legacy single mediaUrl", async () => {
    const res = await api().post("/app/orders").set(bearer(farmerTok)).send({ mediaUrl: "/media/legacy.png" });
    expect(res.body.order.media).toHaveLength(1);
    expect(res.body.order.media[0].kind).toBe("photo");
  });
  it("empty body creates a bare RECEIVED order", async () => {
    const res = await api().post("/app/orders").set(bearer(farmerTok));
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe("RECEIVED");
    expect(res.body.upiLink).toBeNull();
  });
  it("defaults a missing/invalid qty to 1", async () => {
    const res = await api().post("/app/orders").set(bearer(mistriTok)).send({ items: [{ skuId }] });
    expect(res.body.order.items[0].qty).toBe(1);
    expect(res.body.order.subtotal).toBe(90000); // 1 × mistri price
    expect(res.body.order.total).toBe(94000); // + ₹40 delivery (subtotal under free-delivery threshold)
  });
  it("validates media url, item count, attachment count, unknown sku", async () => {
    expect((await api().post("/app/orders").set(bearer(farmerTok)).send({ mediaUrls: ["http://evil"] })).status).toBe(400);
    expect((await api().post("/app/orders").set(bearer(farmerTok)).send({ items: Array(51).fill({ skuId, qty: 1 }) })).status).toBe(400);
    expect((await api().post("/app/orders").set(bearer(farmerTok)).send({ mediaUrls: Array(11).fill("/media/a.png") })).status).toBe(400);
    expect((await api().post("/app/orders").set(bearer(farmerTok)).send({ items: [{ skuId: "nope", qty: 1 }] })).status).toBe(400);
  });
});

describe("my orders + wallet", () => {
  it("lists my orders and blocks another customer's order", async () => {
    const mine = await api().post("/app/orders").set(bearer(farmerTok)).send({ rawText: "x" });
    expect((await api().get("/app/orders").set(bearer(farmerTok))).body.length).toBe(1);
    expect((await api().get(`/app/orders/${mine.body.order.id}`).set(bearer(farmerTok))).status).toBe(200);
    expect((await api().get(`/app/orders/${mine.body.order.id}`).set(bearer(mistriTok))).status).toBe(404);
  });
  it("wallet returns balance + txns", async () => {
    const res = await api().get("/app/wallet").set(bearer(mistriTok));
    expect(res.body.balance).toBe(0);
    expect(res.body.txns).toEqual([]);
  });
  it("wallet reports 0 balance if the account was deleted", async () => {
    await db.user.delete({ where: { id: farmerId } });
    const res = await api().get("/app/wallet").set(bearer(farmerTok));
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
  });
});

describe("POST /app/media", () => {
  it("400 when no file", async () => {
    expect((await api().post("/app/media").set(bearer(farmerTok))).status).toBe(400);
  });
  it("rejects a disallowed mime type", async () => {
    const res = await api().post("/app/media").set(bearer(farmerTok)).attach("file", Buffer.from("<b>"), { filename: "x.html", contentType: "text/html" });
    expect(res.status).toBe(400);
  });
  it("accepts an image and returns a random /media url", async () => {
    const res = await api().post("/app/media").set(bearer(farmerTok)).attach("file", Buffer.from("PNG"), { filename: "p.png", contentType: "image/png" });
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/media\/app-.*\.png$/);
  });
  it("413 on an unexpected field (MulterError)", async () => {
    const res = await api().post("/app/media").set(bearer(farmerTok)).attach("wrong", Buffer.from("x"), { filename: "p.png", contentType: "image/png" });
    expect(res.status).toBe(413);
  });
  it("413 when the file exceeds the size limit", async () => {
    const big = Buffer.alloc(25 * 1024 * 1024 + 10);
    const res = await api().post("/app/media").set(bearer(farmerTok)).attach("file", big, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(413);
    expect(res.body.error).toContain("File too large");
  });
});
