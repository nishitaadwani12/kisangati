import { describe, it, expect } from "vitest";
import { mediaKind } from "../../src/lib/media";

describe("mediaKind", () => {
  it("classifies images as photo", () => {
    for (const u of ["/media/a.jpg", "/media/a.JPEG", "/media/a.png", "/media/a.webp", "/media/a.heic", "/media/a.gif"]) expect(mediaKind(u)).toBe("photo");
  });
  it("classifies audio as voice", () => {
    for (const u of ["/media/a.m4a", "/media/a.ogg", "/media/a.mp3", "/media/a.aac", "/media/a.wav", "/media/a.webm"]) expect(mediaKind(u)).toBe("voice");
  });
  it("everything else is file", () => {
    expect(mediaKind("/media/a.pdf")).toBe("file");
    expect(mediaKind("wa-media:123")).toBe("file");
  });
});
