import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";

// createApp reads NODE_ENV (trust proxy) and CORS_ORIGINS at call time, so we build fresh
// apps under stubbed env to cover the production and explicit-CORS branches.
describe("createApp configuration branches", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it("in production, trusts the proxy and honours an explicit CORS allowlist", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-very-strong-production-secret"); // keep the auth guard happy
    vi.stubEnv("CORS_ORIGINS", "https://app.kisangati.example, https://admin.kisangati.example");
    const { createApp } = await import("../../src/server");
    const app = createApp();
    const res = await request(app).get("/health").set("Origin", "https://app.kisangati.example");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://app.kisangati.example");
  });
});
