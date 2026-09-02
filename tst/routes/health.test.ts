import { describe, it, expect } from "vitest";
import { api, makeShop, makeAdmin } from "../setup/helpers";

describe("smoke", () => {
  it("GET /health returns ok", async () => {
    const res = await api().get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("harness: seeded admin can list their shop's (empty) orders", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    const res = await api().get("/api/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
