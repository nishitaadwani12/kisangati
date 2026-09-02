import { describe, it, expect } from "vitest";
import { normalizeKey } from "../../src/lib/text";

describe("normalizeKey", () => {
  it("collapses case/space/punctuation so variants match", () => {
    expect(normalizeKey("ABC-123")).toBe("abc123");
    expect(normalizeKey("abc 123")).toBe("abc123");
    expect(normalizeKey("abc123")).toBe("abc123");
  });
  it("joins multiple parts and ignores null/undefined/empty", () => {
    expect(normalizeKey("Swaraj", "855", null)).toBe("swaraj855");
    expect(normalizeKey("Oil Filter", undefined, "")).toBe("oilfilter");
  });
  it("returns empty string for no alphanumerics", () => {
    expect(normalizeKey("---", " ")).toBe("");
  });
});
