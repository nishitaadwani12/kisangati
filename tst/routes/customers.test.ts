import { describe, it, expect, beforeEach } from "vitest";
import { api, makeShop, makeAdmin, makeCustomer, db } from "../setup/helpers";

let shopId: string, token: string;
const H = () => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  const shop = await makeShop();
  shopId = shop.id;
  token = (await makeAdmin(shopId, "OWNER")).token;
});

describe("GET /api/customers", () => {
  it("lists (scoped) and searches by name/phone", async () => {
    await makeCustomer(shopId, "FARMER", "+919000000011");
    await db.user.updateMany({ where: { phone: "+919000000011" }, data: { name: "Rajaram" } });
    const other = await makeShop();
    await makeCustomer(other.id, "FARMER", "+919000000012");
    expect((await api().get("/api/customers").set(H())).body.length).toBe(1);
    expect((await api().get("/api/customers?q=Rajaram").set(H())).body.length).toBe(1);
    expect((await api().get("/api/customers?q=nomatch").set(H())).body.length).toBe(0);
  });
});

describe("POST /api/customers", () => {
  const h = () => H();
  it("validates phone / userType / channel", async () => {
    expect((await api().post("/api/customers").set(h()).send({ userType: "FARMER", acquisitionChannel: "WALK_IN" })).status).toBe(400);
    expect((await api().post("/api/customers").set(h()).send({ phone: "+91999", userType: "BOSS", acquisitionChannel: "WALK_IN" })).status).toBe(400);
    expect((await api().post("/api/customers").set(h()).send({ phone: "+91999", userType: "FARMER", acquisitionChannel: "SKY" })).status).toBe(400);
  });
  it("400 on an empty body (phone required)", async () => {
    expect((await api().post("/api/customers").set(h())).status).toBe(400);
  });
  it("creates without an optional name (name defaults to null)", async () => {
    const res = await api().post("/api/customers").set(h()).send({ phone: "+919000000099", userType: "FARMER", acquisitionChannel: "APP" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBeNull();
  });
  it("creates; rejects duplicate phone within the shop", async () => {
    const ok = await api().post("/api/customers").set(h()).send({ phone: "+919000000021", name: "R", userType: "MISTRI", acquisitionChannel: "WALK_IN" });
    expect(ok.status).toBe(201);
    const dup = await api().post("/api/customers").set(h()).send({ phone: "+919000000021", userType: "FARMER", acquisitionChannel: "WALK_IN" });
    expect(dup.status).toBe(409);
  });
});

describe("wallet + payout", () => {
  it("wallet: 404 cross-shop, ok with balance + txns", async () => {
    const other = await makeShop();
    const oc = await makeCustomer(other.id, "MISTRI");
    expect((await api().get(`/api/customers/${oc.user.id}/wallet`).set(H())).status).toBe(404);
    const { user } = await makeCustomer(shopId, "MISTRI");
    const res = await api().get(`/api/customers/${user.id}/wallet`).set(H());
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
  });
  it("payout: validates utr, requires mistri + balance, then zeroes atomically", async () => {
    const farmer = await makeCustomer(shopId, "FARMER");
    expect((await api().post(`/api/customers/${farmer.user.id}/payout`).set(H())).status).toBe(400); // no body → utr ""
    expect((await api().post(`/api/customers/${farmer.user.id}/payout`).set(H()).send({ utr: "@@" })).status).toBe(400);
    expect((await api().post(`/api/customers/${farmer.user.id}/payout`).set(H()).send({ utr: "PAYOUT000001" })).status).toBe(400); // not mistri
    const { user } = await makeCustomer(shopId, "MISTRI");
    expect((await api().post(`/api/customers/${user.id}/payout`).set(H()).send({ utr: "PAYOUT000001" })).status).toBe(400); // no balance
    await db.user.update({ where: { id: user.id }, data: { walletBalance: 4000 } });
    const res = await api().post(`/api/customers/${user.id}/payout`).set(H()).send({ utr: "PAYOUT000001" });
    expect(res.body.paidOutPaise).toBe(4000);
    expect(res.body.balance).toBe(0);
    const w = await api().get(`/api/customers/${user.id}/wallet`).set(H());
    expect(w.body.txns[0].type).toBe("PAYOUT");
    expect(w.body.txns[0].ref).toBe("PAYOUT000001");
  });
});
