import { describe, it, expect } from "vitest";
import { api, makeShop, makeAdmin, db } from "../setup/helpers";

describe("POST /api/auth/login", () => {
  it("400 when missing fields", async () => {
    expect((await api().post("/api/auth/login").send({})).status).toBe(400);
  });
  it("401 on unknown email", async () => {
    expect((await api().post("/api/auth/login").send({ email: "no@x.com", password: "pw123456" })).status).toBe(401);
  });
  it("401 on wrong password", async () => {
    const shop = await makeShop();
    const { user } = await makeAdmin(shop.id, "OWNER", "rightpass");
    const res = await api().post("/api/auth/login").send({ email: user.email, password: "wrongpass" });
    expect(res.status).toBe(401);
  });
  it("returns a token + user on success", async () => {
    const shop = await makeShop();
    const { user } = await makeAdmin(shop.id, "OWNER", "rightpass");
    const res = await api().post("/api/auth/login").send({ email: user.email.toUpperCase(), password: "rightpass" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("OWNER");
    expect(res.body.user.shopName).toBe(shop.name);
  });
  it("super-admin (no shop) logs in with a null shopName", async () => {
    const { user } = await makeAdmin(null, "SUPER_ADMIN", "rightpass");
    const res = await api().post("/api/auth/login").send({ email: user.email, password: "rightpass" });
    expect(res.status).toBe(200);
    expect(res.body.user.shopName).toBeNull();
  });
});

describe("GET /api/auth/me", () => {
  it("401 without a token", async () => {
    expect((await api().get("/api/auth/me")).status).toBe(401);
  });
  it("returns the user; super-admin also gets the shop list", async () => {
    const shop = await makeShop();
    await makeShop();
    const { token } = await makeAdmin(null, "SUPER_ADMIN");
    const res = await api().get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("SUPER_ADMIN");
    expect(res.body.shops.length).toBe(2);
    const owner = await makeAdmin(shop.id, "OWNER");
    const r2 = await api().get("/api/auth/me").set("Authorization", `Bearer ${owner.token}`);
    expect(r2.body.shops).toEqual([]);
  });
  it("401 when the session user no longer exists", async () => {
    const shop = await makeShop();
    const { user, token } = await makeAdmin(shop.id, "OWNER");
    await db.adminUser.delete({ where: { id: user.id } });
    expect((await api().get("/api/auth/me").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });
});
