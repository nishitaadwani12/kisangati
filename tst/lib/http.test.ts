import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { ah, HttpError } from "../../src/lib/http";

describe("HttpError", () => {
  it("carries status + message", () => {
    const e = new HttpError(404, "nope");
    expect(e.status).toBe(404);
    expect(e.message).toBe("nope");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("ah (async handler wrapper)", () => {
  it("passes a thrown error to next()", async () => {
    const next = vi.fn();
    const handler = ah(async () => { throw new HttpError(400, "bad"); });
    await handler({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect((next.mock.calls[0][0] as HttpError).status).toBe(400);
  });
  it("does not call next() on success", async () => {
    const next = vi.fn();
    const handler = ah(async (_req, res) => { (res as unknown as { sent: boolean }).sent = true; });
    const res = {} as Response;
    await handler({} as Request, res, next);
    expect(next).not.toHaveBeenCalled();
    expect((res as unknown as { sent: boolean }).sent).toBe(true);
  });
});
