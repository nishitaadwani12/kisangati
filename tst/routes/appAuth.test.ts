import { describe, it, expect, vi, afterEach } from "vitest";
import { api, makeShop, makeCustomer } from "../setup/helpers";

afterEach(() => vi.unstubAllEnvs());

describe("GET /app/auth/shops", () => {
  it("lists shops publicly", async () => {
    await makeShop({ name: "Alpha" });
    const res = await api().get("/app/auth/shops");
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty("name");
  });
});

describe("POST /app/auth/request-otp", () => {
  it("400 on an invalid phone", async () => {
    const shop = await makeShop();
    expect((await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "abc" })).status).toBe(400);
  });
  it("400 on an empty body (shopId/phone default to empty)", async () => {
    expect((await api().post("/app/auth/request-otp")).status).toBe(400);
  });
  it("omits devCode when OTP_DEV_ECHO is not enabled", async () => {
    vi.stubEnv("OTP_DEV_ECHO", "0");
    const shop = await makeShop();
    const res = await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "+919000000005" });
    expect(res.status).toBe(200);
    expect(res.body.devCode).toBeUndefined();
  });
  it("404 for an unknown shop", async () => {
    expect((await api().post("/app/auth/request-otp").send({ shopId: "nope", phone: "+919000000001" })).status).toBe(404);
  });
  it("returns a devCode in dev", async () => {
    const shop = await makeShop();
    const res = await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "+919000000001" });
    expect(res.status).toBe(200);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });
});

describe("POST /app/auth/verify-otp", () => {
  it("401 on an empty body (shopId/phone/code default to empty)", async () => {
    expect((await api().post("/app/auth/verify-otp")).status).toBe(401);
  });
  it("self-signup with no name stores a null name", async () => {
    const shop = await makeShop();
    const otp = await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "+919000000006" });
    const res = await api().post("/app/auth/verify-otp").send({ shopId: shop.id, phone: "+919000000006", code: otp.body.devCode });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBeNull();
  });
  it("401 on a wrong code", async () => {
    const shop = await makeShop();
    await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "+919000000002" });
    const res = await api().post("/app/auth/verify-otp").send({ shopId: shop.id, phone: "+919000000002", code: "000000" });
    expect(res.status).toBe(401);
  });
  it("self-signup creates a FARMER and returns a token", async () => {
    const shop = await makeShop();
    const otp = await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "+919000000003" });
    const res = await api().post("/app/auth/verify-otp").send({ shopId: shop.id, phone: "+919000000003", code: otp.body.devCode, name: "Ram" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.userType).toBe("FARMER");
    expect(res.body.user.name).toBe("Ram");
  });
  it("an existing mistri keeps their MISTRI type on login", async () => {
    const shop = await makeShop();
    await makeCustomer(shop.id, "MISTRI", "+919000000004");
    const otp = await api().post("/app/auth/request-otp").send({ shopId: shop.id, phone: "+919000000004" });
    const res = await api().post("/app/auth/verify-otp").send({ shopId: shop.id, phone: "+919000000004", code: otp.body.devCode });
    expect(res.body.user.userType).toBe("MISTRI");
  });
});
