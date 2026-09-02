import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { sendText, downloadMedia, MEDIA_DIR } from "../../src/lib/whatsapp";

const okRes = (body: unknown, ok = true, status = 200) => ({
  ok, status,
  json: async () => body,
  text: async () => JSON.stringify(body),
  arrayBuffer: async () => new TextEncoder().encode("BYTES").buffer,
});

beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("sendText", () => {
  it("skips (returns false) with no access token", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendText("PNID", "+91999", "hi")).toBe(false);
  });
  it("skips (returns false) with no phone number id even if token present", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendText("", "+91999", "hi")).toBe(false);
  });
  it("returns null in downloadMedia with no media id", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    expect(await downloadMedia("")).toBeNull();
  });
  it("sends and returns true on 200", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okRes({ ok: true })));
    expect(await sendText("PNID", "+91999", "hi")).toBe(true);
  });
  it("returns false on a non-ok response", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okRes({ error: "x" }, false, 401)));
    expect(await sendText("PNID", "+91999", "hi")).toBe(false);
  });
  it("returns false when fetch throws", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    expect(await sendText("PNID", "+91999", "hi")).toBe(false);
  });
});

describe("downloadMedia", () => {
  it("returns null with no token / no id", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    expect(await downloadMedia("m1")).toBeNull();
  });
  it("returns null if metadata fetch fails", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okRes({}, false, 404)));
    expect(await downloadMedia("m1")).toBeNull();
  });
  it("returns null if metadata has no url", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okRes({ mime_type: "image/jpeg" })));
    expect(await downloadMedia("m1")).toBeNull();
  });
  it("returns null if the binary fetch fails", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn()
      .mockResolvedValueOnce(okRes({ url: "https://dl/x", mime_type: "image/jpeg" }))
      .mockResolvedValueOnce(okRes({}, false, 500));
    vi.stubGlobal("fetch", f);
    expect(await downloadMedia("m1")).toBeNull();
  });
  it("downloads and writes the file, returns its public url", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    const f = vi.fn()
      .mockResolvedValueOnce(okRes({ url: "https://dl/x", mime_type: "audio/ogg" }))
      .mockResolvedValueOnce(okRes(null));
    vi.stubGlobal("fetch", f);
    const r = await downloadMedia("mediaX");
    expect(r?.publicUrl).toBe("/media/mediaX.ogg");
    expect(fs.existsSync(path.join(MEDIA_DIR, "mediaX.ogg"))).toBe(true);
    fs.rmSync(path.join(MEDIA_DIR, "mediaX.ogg"));
  });
  it("uses .bin when the metadata has no mime type at all", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    const f = vi.fn()
      .mockResolvedValueOnce(okRes({ url: "https://dl/x" })) // no mime_type
      .mockResolvedValueOnce(okRes(null));
    vi.stubGlobal("fetch", f);
    const r = await downloadMedia("mediaZ");
    expect(r?.publicUrl).toBe("/media/mediaZ.bin");
    fs.rmSync(path.join(MEDIA_DIR, "mediaZ.bin"));
  });
  it("uses .bin for unknown mime types", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    const f = vi.fn()
      .mockResolvedValueOnce(okRes({ url: "https://dl/x", mime_type: "application/zip" }))
      .mockResolvedValueOnce(okRes(null));
    vi.stubGlobal("fetch", f);
    const r = await downloadMedia("mediaY");
    expect(r?.publicUrl).toBe("/media/mediaY.bin");
    fs.rmSync(path.join(MEDIA_DIR, "mediaY.bin"));
  });
  it("returns null when fetch throws", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await downloadMedia("m1")).toBeNull();
  });
});
