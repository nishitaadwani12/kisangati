import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deliverOtp, otpProviderConfigured } from "../../src/lib/notify";

beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("otpProviderConfigured", () => {
  it("true when an SMS provider URL is set", () => {
    vi.stubEnv("OTP_PROVIDER_URL", "https://sms");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    expect(otpProviderConfigured()).toBe(true);
  });
  it("true when a WhatsApp token is set", () => {
    vi.stubEnv("OTP_PROVIDER_URL", "");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    expect(otpProviderConfigured()).toBe(true);
  });
  it("false when neither is set", () => {
    vi.stubEnv("OTP_PROVIDER_URL", "");
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    expect(otpProviderConfigured()).toBe(false);
  });
});

describe("deliverOtp", () => {
  it("sends via WhatsApp when a shop number + token exist", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await deliverOtp("+91999", "123456", { whatsappPhoneNumberId: "PNID" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/PNID/messages");
  });
  it("falls back to the SMS provider when WhatsApp isn't available", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("OTP_PROVIDER_URL", "https://sms/send");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await deliverOtp("+91999", "123456");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://sms/send");
  });
  it("falls back to WhatsApp→SMS→dev-log; logs when nothing is configured", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("OTP_PROVIDER_URL", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await deliverOtp("+91999", "123456");
    expect(log).toHaveBeenCalled();
  });
  it("falls through from a failed WhatsApp send to the dev log", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "tok");
    vi.stubEnv("OTP_PROVIDER_URL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}), text: async () => "" }));
    await deliverOtp("+91999", "123456", { whatsappPhoneNumberId: "PNID" });
    expect(log).toHaveBeenCalled();
  });
  it("handles an SMS provider error without throwing", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("OTP_PROVIDER_URL", "https://sms/send");
    vi.stubEnv("OTP_PROVIDER_AUTH", "Bearer k");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    await deliverOtp("+91999", "123456");
    expect(log).toHaveBeenCalled(); // fell through to dev log
  });
  it("logs a non-ok SMS response and falls through", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("OTP_PROVIDER_URL", "https://sms/send");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" }));
    await deliverOtp("+91999", "123456");
    expect(err).toHaveBeenCalled();
  });
});
