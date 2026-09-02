import { describe, it, expect, afterEach } from "vitest";
import { buildUpiLink } from "../../src/lib/upi";

afterEach(() => { delete process.env.UPI_VPA; delete process.env.UPI_PAYEE_NAME; });

describe("buildUpiLink", () => {
  it("builds a upi:// link with amount in rupees and defaults", () => {
    const link = buildUpiLink(84000, "order abc");
    expect(link).toContain("upi://pay?");
    expect(link).toContain("am=840.00");
    expect(link).toContain("cu=INR");
    expect(link).toContain("pa=shop%40upi"); // default VPA, url-encoded
    expect(link).toContain("tn=order+abc");
  });
  it("uses env VPA + payee name when set", () => {
    process.env.UPI_VPA = "satram@ybl";
    process.env.UPI_PAYEE_NAME = "Satram";
    const link = buildUpiLink(50000, "x");
    expect(link).toContain("pa=satram%40ybl");
    expect(link).toContain("pn=Satram");
    expect(link).toContain("am=500.00");
  });
});
