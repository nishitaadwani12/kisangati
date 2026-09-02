import { describe, it, expect, vi, afterEach } from "vitest";
import { issueOtp, checkOtp } from "../../src/lib/otpStore";

afterEach(() => vi.useRealTimers());

describe("otpStore", () => {
  it("issues a 6-digit code", () => {
    const code = issueOtp("shop1", "+919000000001");
    expect(code).toMatch(/^\d{6}$/);
  });
  it("verifies the correct code once (one-time use)", () => {
    const code = issueOtp("shop1", "+919000000002");
    expect(checkOtp("shop1", "+919000000002", code)).toBe(true);
    expect(checkOtp("shop1", "+919000000002", code)).toBe(false); // consumed
  });
  it("rejects a wrong code", () => {
    issueOtp("shop1", "+919000000003");
    expect(checkOtp("shop1", "+919000000003", "000000")).toBe(false);
  });
  it("rejects an unknown phone/shop", () => {
    expect(checkOtp("shopX", "+910000000000", "123456")).toBe(false);
  });
  it("expires after the TTL", () => {
    vi.useFakeTimers();
    const code = issueOtp("shop1", "+919000000004");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(checkOtp("shop1", "+919000000004", code)).toBe(false);
  });
});
