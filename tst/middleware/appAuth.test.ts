import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { customerRequired } from "../../src/middleware/appAuth";
import { HttpError } from "../../src/lib/http";
import { signToken, signCustomerToken } from "../../src/lib/auth";

const authHeader = (token: string) => ({ headers: { authorization: `Bearer ${token}` } } as unknown as Request);

describe("customerRequired", () => {
  it("401 with no token", () => {
    const next = vi.fn();
    customerRequired({ headers: {} } as unknown as Request, {} as Response, next);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(401);
  });
  it("403 for an admin token", () => {
    const next = vi.fn();
    customerRequired(authHeader(signToken({ adminUserId: "a", role: "OWNER", shopId: "s" })), {} as Response, next);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(403);
  });
  it("401 for an invalid token", () => {
    const next = vi.fn();
    customerRequired(authHeader("nope"), {} as Response, next);
    expect((next.mock.calls[0][0] as HttpError).status).toBe(401);
  });
  it("passes and sets req.customer for a valid customer token", () => {
    const next = vi.fn();
    const req = authHeader(signCustomerToken({ userId: "u1", shopId: "s1", userType: "MISTRI" }));
    customerRequired(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.customer?.userId).toBe("u1");
  });
});
