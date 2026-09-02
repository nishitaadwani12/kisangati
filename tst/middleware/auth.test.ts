import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { authRequired, shopFilter, canAccess, shopWhere, shopIdForCreate } from "../../src/middleware/auth";
import { HttpError } from "../../src/lib/http";
import { signToken, signCustomerToken } from "../../src/lib/auth";

const reqWith = (over: Partial<Request>) => over as unknown as Request;
const authHeader = (token: string) => reqWith({ headers: { authorization: `Bearer ${token}` } } as Partial<Request>);

describe("authRequired", () => {
  it("401 when no token", () => {
    const next = vi.fn();
    authRequired(reqWith({ headers: {} } as Partial<Request>), {} as Response, next);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(401);
  });
  it("403 for a customer token", () => {
    const next = vi.fn();
    authRequired(authHeader(signCustomerToken({ userId: "u", shopId: "s", userType: "FARMER" })), {} as Response, next);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(403);
  });
  it("401 for an invalid token", () => {
    const next = vi.fn();
    authRequired(authHeader("garbage"), {} as Response, next);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(401);
  });
  it("passes and sets req.auth for a valid admin token", () => {
    const next = vi.fn();
    const req = authHeader(signToken({ adminUserId: "a1", role: "OWNER", shopId: "s1" }));
    authRequired(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.auth?.adminUserId).toBe("a1");
  });
});

describe("shop scoping helpers", () => {
  const owner = reqWith({ auth: { adminUserId: "a", role: "OWNER", shopId: "s1" }, query: {} } as Partial<Request>);
  const staffNoShop = reqWith({ auth: { adminUserId: "a", role: "STAFF", shopId: null }, query: {} } as Partial<Request>);
  const superAll = reqWith({ auth: { adminUserId: "a", role: "SUPER_ADMIN", shopId: null }, query: {} } as Partial<Request>);
  const superScoped = reqWith({ auth: { adminUserId: "a", role: "SUPER_ADMIN", shopId: null }, query: { shopId: "s9" } } as Partial<Request>);

  it("shopFilter: owner → own shop, super → all, super+query → that shop, shopless → __none__", () => {
    expect(shopFilter(owner)).toBe("s1");
    expect(shopFilter(superAll)).toBeUndefined();
    expect(shopFilter(superScoped)).toBe("s9");
    expect(shopFilter(staffNoShop)).toBe("__none__");
  });
  it("canAccess: owner only own; super any", () => {
    expect(canAccess(owner, "s1")).toBe(true);
    expect(canAccess(owner, "s2")).toBe(false);
    expect(canAccess(superAll, "anything")).toBe(true);
  });
  it("shopWhere: {} for super-all, { shopId } otherwise", () => {
    expect(shopWhere(superAll)).toEqual({});
    expect(shopWhere(owner)).toEqual({ shopId: "s1" });
  });
  it("shopIdForCreate: owner→own; super needs an explicit shop; shopless owner throws", () => {
    expect(shopIdForCreate(owner)).toBe("s1");
    expect(shopIdForCreate(superScoped)).toBe("s9");
    expect(shopIdForCreate(superAll, "sBody")).toBe("sBody");
    expect(() => shopIdForCreate(superAll)).toThrow(HttpError);
    expect(() => shopIdForCreate(staffNoShop)).toThrow(HttpError);
  });
});
