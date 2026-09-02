import { describe, it, expect } from "vitest";
import { api, makeShop, makeAdmin, makeCustomer, db } from "../setup/helpers";

// Helpers to build a mistri's commission history.
async function credit(mistriId: string, amount: number) {
  await db.walletTxn.create({ data: { mistriId, type: "CASHBACK", amount } });
}
async function payout(mistriId: string, amount: number) {
  await db.walletTxn.create({ data: { mistriId, type: "PAYOUT", amount, ref: "UTR123456" } });
}
async function order(shopId: string, userId: string) {
  return db.order.create({ data: { shopId, userId, orderSource: "APP", status: "DELIVERED" } });
}

describe("GET /api/mistris", () => {
  it("returns [] when the shop has no mistris (farmers excluded)", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    await makeCustomer(shop.id, "FARMER"); // must not appear
    const res = await api().get("/api/mistris").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("rolls up balance, lifetime cashback/payout, order count and last activity", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    const { user } = await makeCustomer(shop.id, "MISTRI", "+919000000001");
    await db.user.update({ where: { id: user.id }, data: { name: "Ramesh", walletBalance: 240 } });
    await credit(user.id, 1000);
    await credit(user.id, 240);
    await payout(user.id, 1000);
    await order(shop.id, user.id);
    await order(shop.id, user.id);

    const res = await api().get("/api/mistris").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const m = res.body[0];
    expect(m).toMatchObject({
      name: "Ramesh", phone: "+919000000001",
      walletBalance: 240, totalCashback: 1240, totalPaidOut: 1000, orderCount: 2,
    });
    expect(m.lastActivityAt).toBeTruthy();
  });

  it("shows zeros and null last activity for a mistri with no orders or txns", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    await makeCustomer(shop.id, "MISTRI", "+919000000002");
    const res = await api().get("/api/mistris").set("Authorization", `Bearer ${token}`);
    expect(res.body[0]).toMatchObject({ walletBalance: 0, totalCashback: 0, totalPaidOut: 0, orderCount: 0, lastActivityAt: null });
  });

  it("sorts by amount owed (desc), then by name — tolerating a null name", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    const low = await makeCustomer(shop.id, "MISTRI", "+919000000010");
    const highA = await makeCustomer(shop.id, "MISTRI", "+919000000011");
    const highNull = await makeCustomer(shop.id, "MISTRI", "+919000000012");
    await db.user.update({ where: { id: low.user.id }, data: { name: "Zeba", walletBalance: 100 } });
    await db.user.update({ where: { id: highA.user.id }, data: { name: "Anil", walletBalance: 500 } });
    await db.user.update({ where: { id: highNull.user.id }, data: { name: null, walletBalance: 500 } });

    const res = await api().get("/api/mistris").set("Authorization", `Bearer ${token}`);
    // Both 500-balance mistris come before the 100 one; among the 500s, "" (null) sorts before "Anil".
    expect(res.body.map((m: { walletBalance: number }) => m.walletBalance)).toEqual([500, 500, 100]);
    expect(res.body[0].name).toBeNull();
    expect(res.body[1].name).toBe("Anil");
  });

  it("is shop-scoped for an owner (other shops' mistris excluded)", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    await makeCustomer(shop.id, "MISTRI", "+919000000020");
    const other = await makeShop();
    await makeCustomer(other.id, "MISTRI", "+919000000021");
    const res = await api().get("/api/mistris").set("Authorization", `Bearer ${token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].phone).toBe("+919000000020");
  });

  it("shows mistris across all shops for a super-admin", async () => {
    const { token } = await makeAdmin(null, "SUPER_ADMIN");
    const s1 = await makeShop(); await makeCustomer(s1.id, "MISTRI", "+919000000030");
    const s2 = await makeShop(); await makeCustomer(s2.id, "MISTRI", "+919000000031");
    const res = await api().get("/api/mistris").set("Authorization", `Bearer ${token}`);
    expect(res.body).toHaveLength(2);
  });
});
