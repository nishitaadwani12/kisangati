import { describe, it, expect, vi, afterEach } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken, signCustomerToken, verifyAnyToken } from "../../src/lib/auth";

describe("auth crypto", () => {
  it("hashes and verifies a password", async () => {
    const h = await hashPassword("pw123456");
    expect(await verifyPassword("pw123456", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("round-trips an admin token", () => {
    const dec = verifyToken(signToken({ adminUserId: "a1", role: "OWNER", shopId: "s1" }));
    expect(dec.adminUserId).toBe("a1");
    expect(dec.role).toBe("OWNER");
    expect(dec.shopId).toBe("s1");
  });
  it("marks a customer token with customer:true", () => {
    const dec = verifyAnyToken(signCustomerToken({ userId: "u1", shopId: "s1", userType: "FARMER" })) as { customer?: boolean; userId?: string };
    expect(dec.customer).toBe(true);
    expect(dec.userId).toBe("u1");
  });
  it("throws on a tampered/invalid token", () => {
    expect(() => verifyToken("not.a.jwt")).toThrow();
  });
});

describe("JWT secret guard (isolated module loads)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("throws in production when JWT_SECRET is unset", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    await expect(import("../../src/lib/auth")).rejects.toThrow(/JWT_SECRET/);
  });
  it("throws in production when JWT_SECRET equals the dev default", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "dev-only-insecure-secret-change-me");
    await expect(import("../../src/lib/auth")).rejects.toThrow(/JWT_SECRET/);
  });
  it("does NOT throw in production with a strong secret set", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-very-strong-production-secret");
    await expect(import("../../src/lib/auth")).resolves.toBeTruthy();
  });
  it("warns when falling back to the dev secret", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../../src/lib/auth");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
