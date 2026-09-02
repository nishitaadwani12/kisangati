import { describe, it, expect } from "vitest";
import { api, makeShop, makeAdmin, db } from "../setup/helpers";

async function superToken() { return (await makeAdmin(null, "SUPER_ADMIN")).token; }

describe("GET /api/shops", () => {
  it("403 for a non-super admin", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    expect((await api().get("/api/shops").set("Authorization", `Bearer ${token}`)).status).toBe(403);
  });
  it("super lists shops with counts", async () => {
    await makeShop();
    const token = await superToken();
    const res = await api().get("/api/shops").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body[0]._count).toHaveProperty("orders");
  });
});

describe("POST /api/shops", () => {
  it("403 for non-super", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    expect((await api().post("/api/shops").set("Authorization", `Bearer ${token}`).send({ shopName: "X", ownerEmail: "o@x.com", password: "secret1" })).status).toBe(403);
  });
  it("validates shopName / email / password", async () => {
    const token = await superToken();
    const h = { Authorization: `Bearer ${token}` };
    expect((await api().post("/api/shops").set(h).send({ ownerEmail: "o@x.com", password: "secret1" })).status).toBe(400);
    expect((await api().post("/api/shops").set(h).send({ shopName: "X", ownerEmail: "bad", password: "secret1" })).status).toBe(400);
    expect((await api().post("/api/shops").set(h).send({ shopName: "X", ownerEmail: "o@x.com", password: "123" })).status).toBe(400);
  });
  it("creates shop + owner; rejects duplicate email", async () => {
    const token = await superToken();
    const h = { Authorization: `Bearer ${token}` };
    const res = await api().post("/api/shops").set(h).send({ shopName: "New Shop", town: "Jhansi", ownerEmail: "own@x.com", ownerName: "O", password: "secret1" });
    expect(res.status).toBe(201);
    expect(res.body.shop.name).toBe("New Shop");
    expect(res.body.owner.role).toBe("OWNER");
    expect(await db.adminUser.findUnique({ where: { email: "own@x.com" } })).toBeTruthy();
    const dup = await api().post("/api/shops").set(h).send({ shopName: "Y", ownerEmail: "own@x.com", password: "secret1" });
    expect(dup.status).toBe(409);
  });
  it("400 on an empty/absent body (nullish fields default safely)", async () => {
    const token = await superToken();
    // No .send() → no request body at all; every field falls through its ?? default.
    expect((await api().post("/api/shops").set({ Authorization: `Bearer ${token}` })).status).toBe(400);
  });
  it("creates with only the required fields (no town / owner name)", async () => {
    const token = await superToken();
    const res = await api().post("/api/shops").set({ Authorization: `Bearer ${token}` }).send({ shopName: "Bare", ownerEmail: "bare@x.com", password: "secret1" });
    expect(res.status).toBe(201);
    expect(res.body.shop.town).toBeNull();
  });
});
