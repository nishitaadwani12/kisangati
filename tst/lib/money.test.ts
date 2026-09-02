import { describe, it, expect, vi, afterEach } from "vitest";
import { deliveryFeeFor, cashbackFor, priceFor, DELIVERY_FEE_PAISE, FREE_DELIVERY_THRESHOLD_PAISE } from "../../src/lib/money";

describe("money env config (isolated loads)", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("reads delivery fee / cashback / mistri discount from env", async () => {
    vi.resetModules();
    vi.stubEnv("DELIVERY_FEE_RUPEES", "25");
    vi.stubEnv("FREE_DELIVERY_THRESHOLD_RUPEES", "500");
    vi.stubEnv("CASHBACK_PERCENT", "5");
    vi.stubEnv("MISTRI_DISCOUNT_PERCENT", "20");
    const m = await import("../../src/lib/money");
    expect(m.DELIVERY_FEE_PAISE).toBe(2500);
    expect(m.FREE_DELIVERY_THRESHOLD_PAISE).toBe(50000);
    expect(m.cashbackFor(100000)).toBe(5000); // 5%
    expect(m.priceFor({ retailPrice: 100000, mistriPrice: null }, "MISTRI")).toBe(80000); // 20% off
  });
  it("falls back to defaults on invalid env", async () => {
    vi.resetModules();
    vi.stubEnv("CASHBACK_PERCENT", "-1");
    vi.stubEnv("MISTRI_DISCOUNT_PERCENT", "150");
    const m = await import("../../src/lib/money");
    expect(m.cashbackFor(100000)).toBe(4000); // default 4%
    expect(m.priceFor({ retailPrice: 100000, mistriPrice: null }, "MISTRI")).toBe(90000); // default 10%
  });
});

describe("deliveryFeeFor", () => {
  it("charges the flat fee below the free-delivery threshold", () => {
    expect(deliveryFeeFor(FREE_DELIVERY_THRESHOLD_PAISE - 1)).toBe(DELIVERY_FEE_PAISE);
  });
  it("is free at or above the threshold", () => {
    expect(deliveryFeeFor(FREE_DELIVERY_THRESHOLD_PAISE)).toBe(0);
    expect(deliveryFeeFor(FREE_DELIVERY_THRESHOLD_PAISE + 1)).toBe(0);
  });
  it("is 0 for an empty order", () => {
    expect(deliveryFeeFor(0)).toBe(0);
  });
});

describe("cashbackFor", () => {
  it("is 4% by default, rounded", () => {
    expect(cashbackFor(100000)).toBe(4000);
    expect(cashbackFor(12345)).toBe(Math.round(12345 * 0.04));
  });
  it("is 0 for a 0 subtotal", () => {
    expect(cashbackFor(0)).toBe(0);
  });
});

describe("priceFor", () => {
  const sku = { retailPrice: 80000, mistriPrice: 72000 };
  it("farmer → retail", () => expect(priceFor(sku, "FARMER")).toBe(80000));
  it("mistri → explicit mistri price", () => expect(priceFor(sku, "MISTRI")).toBe(72000));
  it("mistri with no mistri price → derived 10% off", () => expect(priceFor({ retailPrice: 100000, mistriPrice: null }, "MISTRI")).toBe(90000));
  it("unknown role → retail", () => expect(priceFor(sku, "X")).toBe(80000));
});
