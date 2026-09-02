import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, makeShop, makeAdmin, makeCustomer } from "../setup/helpers";

// Exercises the central error handler's generic 500 branch: an unexpected (non-HttpError,
// non-Multer) failure must be caught and returned as a sanitized 500.
describe("central error handler — unexpected errors", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("returns 500 (not a leaked stack) when a DB constraint fails unexpectedly", async () => {
    const shop = await makeShop();
    const { token } = await makeAdmin(shop.id, "OWNER");
    const { user } = await makeCustomer(shop.id, "FARMER");
    const order = (await api().post("/api/orders").set("Authorization", `Bearer ${token}`).send({ userId: user.id })).body;
    // Reference a SKU id that does not exist → foreign-key violation inside the items transaction.
    const res = await api()
      .post(`/api/orders/${order.id}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ skuId: "ghost-sku-id", qty: 1, unitPrice: 1000 }] });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });
});
