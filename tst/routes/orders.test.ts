import { describe, it, expect, beforeEach } from "vitest";
import { api, makeShop, makeAdmin, makeCustomer, makeSku, db } from "../setup/helpers";

let shopId: string, token: string, adminId: string, farmerId: string, mistriId: string, skuId: string;
const H = () => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  const shop = await makeShop();
  shopId = shop.id;
  const admin = await makeAdmin(shopId, "OWNER");
  token = admin.token; adminId = admin.user.id;
  farmerId = (await makeCustomer(shopId, "FARMER")).user.id;
  mistriId = (await makeCustomer(shopId, "MISTRI")).user.id;
  skuId = (await makeSku(shopId, { retailPrice: 100000, mistriPrice: 90000 })).id;
});

async function newOrder(userId = farmerId, orderSource = "COUNTER") {
  return (await api().post("/api/orders").set(H()).send({ userId, orderSource })).body;
}
async function toPaid(userId = farmerId, orderSource = "COUNTER", unitPrice = 100000) {
  const o = await newOrder(userId, orderSource);
  await api().post(`/api/orders/${o.id}/items`).set(H()).send({ items: [{ skuId, qty: 1, unitPrice }] });
  await api().post(`/api/orders/${o.id}/quote`).set(H()).send({});
  await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "412345678901" });
  return o.id;
}

describe("list + detail scoping", () => {
  it("lists only this shop's orders and filters by status", async () => {
    await newOrder();
    const other = await makeShop();
    const oc = await makeCustomer(other.id, "FARMER");
    await db.order.create({ data: { shopId: other.id, userId: oc.user.id, orderSource: "COUNTER", status: "RECEIVED" } });
    const list = await api().get("/api/orders").set(H());
    expect(list.body.length).toBe(1);
    expect((await api().get("/api/orders?status=RECEIVED").set(H())).body.length).toBe(1);
    expect((await api().get("/api/orders?status=DELIVERED").set(H())).body.length).toBe(0);
  });
  it("detail 404 for a cross-shop order", async () => {
    const other = await makeShop();
    const oc = await makeCustomer(other.id, "FARMER");
    const o = await db.order.create({ data: { shopId: other.id, userId: oc.user.id, orderSource: "COUNTER", status: "RECEIVED" } });
    expect((await api().get(`/api/orders/${o.id}`).set(H())).status).toBe(404);
  });
  it("404 across every action for a non-existent order id", async () => {
    const g = "does-not-exist";
    expect((await api().get(`/api/orders/${g}`).set(H())).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/items`).set(H()).send({ items: [{ skuId, qty: 1, unitPrice: 1 }] })).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/quote`).set(H()).send({})).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/payment/confirm`).set(H()).send({ utr: "412345678901" })).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/dispatch`).set(H()).send({})).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/deliver`).set(H()).send({})).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/cancel`).set(H()).send({})).status).toBe(404);
    expect((await api().post(`/api/orders/${g}/refund`).set(H()).send({ utr: "RFND00000009" })).status).toBe(404);
  });
});

describe("create", () => {
  it("400 without userId", async () => expect((await api().post("/api/orders").set(H()).send({})).status).toBe(400));
  it("404 for unknown user", async () => expect((await api().post("/api/orders").set(H()).send({ userId: "nope" })).status).toBe(404));
  it("400 for a customer from another shop", async () => {
    const other = await makeShop();
    const oc = await makeCustomer(other.id, "FARMER");
    expect((await api().post("/api/orders").set(H()).send({ userId: oc.user.id })).status).toBe(400);
  });
  it("201 on success", async () => {
    const res = await api().post("/api/orders").set(H()).send({ userId: farmerId, rawText: "x" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("RECEIVED");
  });
});

describe("items", () => {
  it("400 on bad items[]", async () => {
    const o = await newOrder();
    expect((await api().post(`/api/orders/${o.id}/items`).set(H()).send({ items: [] })).status).toBe(400);
    expect((await api().post(`/api/orders/${o.id}/items`).set(H()).send({ items: [{ skuId, qty: 0, unitPrice: 1 }] })).status).toBe(400);
  });
  it("recomputes totals incl. delivery fee", async () => {
    const o = await newOrder();
    const res = await api().post(`/api/orders/${o.id}/items`).set(H()).send({ items: [{ skuId, qty: 1, unitPrice: 50000 }] });
    expect(res.body.subtotal).toBe(50000);
    expect(res.body.deliveryFee).toBe(4000); // under ₹1000
    expect(res.body.total).toBe(54000);
  });
  it("409 once the order is past QUOTED", async () => {
    const id = await toPaid();
    expect((await api().post(`/api/orders/${id}/items`).set(H()).send({ items: [{ skuId, qty: 1, unitPrice: 1 }] })).status).toBe(409);
  });
});

describe("quote / confirm / dispatch / deliver", () => {
  it("quote 400 with no priced items", async () => {
    const o = await newOrder();
    expect((await api().post(`/api/orders/${o.id}/quote`).set(H()).send({})).status).toBe(400);
  });
  it("quote 409 once the order is already PAID", async () => {
    const id = await toPaid();
    expect((await api().post(`/api/orders/${id}/quote`).set(H()).send({})).status).toBe(409);
  });
  it("full happy path + confirmedBy stamped from token", async () => {
    const o = await newOrder();
    await api().post(`/api/orders/${o.id}/items`).set(H()).send({ items: [{ skuId, qty: 1, unitPrice: 100000 }] });
    const q = await api().post(`/api/orders/${o.id}/quote`).set(H()).send({});
    expect(q.body.status).toBe("QUOTED");
    expect(q.body.upiLink).toContain("upi://");
    expect((await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "aa" })).status).toBe(400); // bad utr
    const c = await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "412345678901" });
    expect(c.body.status).toBe("PAID");
    const detail = await api().get(`/api/orders/${o.id}`).set(H());
    expect(detail.body.payment.confirmedBy).toBe(adminId);
    expect((await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "412345678902" })).status).toBe(409); // already confirmed
    const d = await api().post(`/api/orders/${o.id}/dispatch`).set(H()).send({ busRoute: "R", conductorName: "C" });
    expect(d.body.status).toBe("DISPATCHED");
    expect((await api().post(`/api/orders/${o.id}/dispatch`).set(H()).send({})).status).toBe(409); // can't re-dispatch
  });
  it("dispatch 409 before payment", async () => {
    const o = await newOrder();
    expect((await api().post(`/api/orders/${o.id}/dispatch`).set(H()).send({})).status).toBe(409);
  });
  it("confirm 409 when not QUOTED, 400 when payment row is missing", async () => {
    const o = await newOrder();
    expect((await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "412345678901" })).status).toBe(409);
    // QUOTED but no payment row (constructed directly) → 400
    await db.order.update({ where: { id: o.id }, data: { status: "QUOTED", total: 100 } });
    expect((await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "412345678901" })).status).toBe(400);
  });
  it("confirm 409 if the payment is already CONFIRMED while still QUOTED", async () => {
    const o = await newOrder();
    await api().post(`/api/orders/${o.id}/items`).set(H()).send({ items: [{ skuId, qty: 1, unitPrice: 100000 }] });
    await api().post(`/api/orders/${o.id}/quote`).set(H()).send({});
    // Force the inconsistent state: order QUOTED but its payment already CONFIRMED.
    await db.payment.update({ where: { orderId: o.id }, data: { status: "CONFIRMED" } });
    expect((await api().post(`/api/orders/${o.id}/payment/confirm`).set(H()).send({ utr: "412345678901" })).status).toBe(409);
  });
  it("deliver credits cashback only for app-placed mistri orders", async () => {
    const mid = await toPaid(mistriId, "APP", 90000);
    await api().post(`/api/orders/${mid}/dispatch`).set(H()).send({ busRoute: "R", conductorName: "C" });
    const del = await api().post(`/api/orders/${mid}/deliver`).set(H()).send({});
    expect(del.body.cashbackPaise).toBe(3600); // 4% of 90000
    // farmer/counter order → no cashback
    const fid = await toPaid(farmerId, "COUNTER", 100000);
    await api().post(`/api/orders/${fid}/dispatch`).set(H()).send({ busRoute: "R", conductorName: "C" });
    expect((await api().post(`/api/orders/${fid}/deliver`).set(H()).send({})).body.cashbackPaise).toBe(0);
  });
  it("deliver 409 before dispatch", async () => {
    const id = await toPaid();
    expect((await api().post(`/api/orders/${id}/deliver`).set(H()).send({})).status).toBe(409);
  });
});

describe("cancel + refund", () => {
  it("cancels an unpaid order (no refund due)", async () => {
    const o = await newOrder();
    const res = await api().post(`/api/orders/${o.id}/cancel`).set(H()).send({ reason: "x" });
    expect(res.body.status).toBe("CANCELLED");
    expect(res.body.refundDue).toBe(false);
  });
  it("cancelling a paid order flags refund due → refund completed", async () => {
    const id = await toPaid(farmerId, "COUNTER", 100000);
    const c = await api().post(`/api/orders/${id}/cancel`).set(H()).send({ reason: "changed mind" });
    expect(c.body.refundDue).toBe(true);
    expect(c.body.refundAmountPaise).toBe(100000);
    expect((await api().post(`/api/orders/${id}/refund`).set(H()).send({ utr: "@@" })).status).toBe(400);
    const r = await api().post(`/api/orders/${id}/refund`).set(H()).send({ utr: "RFND00000001" });
    expect(r.body.refundStatus).toBe("COMPLETED");
  });
  it("409 cancelling a dispatched order; 400 refund when none due", async () => {
    const id = await toPaid();
    await api().post(`/api/orders/${id}/dispatch`).set(H()).send({ busRoute: "R", conductorName: "C" });
    expect((await api().post(`/api/orders/${id}/cancel`).set(H()).send({ reason: "x" })).status).toBe(409);
    const o2 = await newOrder();
    expect((await api().post(`/api/orders/${o2.id}/refund`).set(H()).send({ utr: "RFND00000002" })).status).toBe(400);
  });
  it("cancel with no reason falls back to a default reason", async () => {
    const o = await newOrder();
    const res = await api().post(`/api/orders/${o.id}/cancel`).set(H());
    expect(res.body.status).toBe("CANCELLED");
    const detail = await api().get(`/api/orders/${o.id}`).set(H());
    expect(detail.body.cancelReason).toBe("Cancelled");
  });
});

describe("empty-body defaults", () => {
  it("create 400 with no body; items 400 with no body", async () => {
    expect((await api().post("/api/orders").set(H())).status).toBe(400);
    const o = await newOrder();
    expect((await api().post(`/api/orders/${o.id}/items`).set(H())).status).toBe(400);
  });
  it("confirm/refund 400 with no body (utr required)", async () => {
    const id = await toPaid();
    // status is PAID, not QUOTED, but utr is validated first → 400 before the status check
    expect((await api().post(`/api/orders/${id}/payment/confirm`).set(H())).status).toBe(400);
    expect((await api().post(`/api/orders/${id}/refund`).set(H())).status).toBe(400);
  });
  it("dispatch with no body still records the transition (null route)", async () => {
    const id = await toPaid();
    const res = await api().post(`/api/orders/${id}/dispatch`).set(H());
    expect(res.body.status).toBe("DISPATCHED");
  });
});
