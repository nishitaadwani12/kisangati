import { describe, it, expect } from "vitest";
import { api, makeShop, makeAdmin, makeCustomer, db } from "../setup/helpers";

describe("GET /api/stats/today", () => {
  it("reports today's orders, confirmed sales, and status breakdown (shop-scoped)", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    const { user } = await makeCustomer(shop.id, "FARMER");
    const order = await db.order.create({ data: { shopId: shop.id, userId: user.id, orderSource: "COUNTER", status: "PAID", subtotal: 50000, total: 50000 } });
    await db.payment.create({ data: { orderId: order.id, method: "MANUAL_UPI_QR", amount: 50000, status: "CONFIRMED", confirmedAt: new Date() } });

    // Another shop's data must NOT count.
    const other = await makeShop();
    const oc = await makeCustomer(other.id, "FARMER");
    await db.order.create({ data: { shopId: other.id, userId: oc.user.id, orderSource: "COUNTER", status: "DELIVERED", total: 99999 } });

    const res = await api().get("/api/stats/today").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ordersToday).toBe(1);
    expect(res.body.salesTodayPaise).toBe(50000);
    expect(res.body.statusBreakdown).toEqual({ PAID: 1 });
  });

  it("reports zero sales when there are no confirmed payments", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    const { user } = await makeCustomer(shop.id, "FARMER");
    await db.order.create({ data: { shopId: shop.id, userId: user.id, orderSource: "COUNTER", status: "RECEIVED" } });
    const res = await api().get("/api/stats/today").set("Authorization", `Bearer ${token}`);
    expect(res.body.ordersToday).toBe(1);
    expect(res.body.salesTodayPaise).toBe(0);
  });

  it("super-admin sees network-wide totals (all shops)", async () => {
    const { token } = await makeAdmin(null, "SUPER_ADMIN");
    const s1 = await makeShop(); const c1 = await makeCustomer(s1.id, "FARMER");
    const s2 = await makeShop(); const c2 = await makeCustomer(s2.id, "FARMER");
    await db.order.create({ data: { shopId: s1.id, userId: c1.user.id, orderSource: "COUNTER", status: "RECEIVED" } });
    await db.order.create({ data: { shopId: s2.id, userId: c2.user.id, orderSource: "COUNTER", status: "RECEIVED" } });
    const res = await api().get("/api/stats/today").set("Authorization", `Bearer ${token}`);
    expect(res.body.ordersToday).toBe(2);
  });
});
