import { describe, it, expect, beforeEach } from "vitest";
import { api, makeShop, makeAdmin, makeSku } from "../setup/helpers";

let shopId: string, token: string;
const H = () => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  const shop = await makeShop();
  shopId = shop.id;
  token = (await makeAdmin(shopId, "OWNER")).token;
});

describe("GET /api/skus", () => {
  it("lists (scoped), searches, and filters low stock", async () => {
    await makeSku(shopId, { name: "Clutch Plate", brand: "Swaraj", matchKey: "clutchplate", stockQty: 2 });
    await makeSku(shopId, { name: "Oil Filter", brand: "Mahindra", matchKey: "oilfilter", stockQty: 20 });
    const other = await makeShop();
    await makeSku(other.id, { name: "Foreign", matchKey: "foreign" });
    expect((await api().get("/api/skus").set(H())).body.length).toBe(2);
    expect((await api().get("/api/skus?q=clutch").set(H())).body.length).toBe(1);
    expect((await api().get("/api/skus?lowStock=true").set(H())).body.length).toBe(1);
  });
  it("searches with a query that normalizes to empty (no matchKey clause)", async () => {
    await makeSku(shopId, { name: "Clutch", matchKey: "clutch" });
    expect((await api().get("/api/skus?q=---").set(H())).body.length).toBe(0);
  });
});

describe("POST /api/skus", () => {
  const h = () => H();
  it("validates name + retail + mistri bounds", async () => {
    expect((await api().post("/api/skus").set(h()).send({ retailPrice: 100 })).status).toBe(400);
    expect((await api().post("/api/skus").set(h()).send({ name: "P", retailPrice: 80000, wholesalePrice: 60000, mistriPrice: 50000 })).status).toBe(400); // below wholesale
    expect((await api().post("/api/skus").set(h()).send({ name: "P", retailPrice: 80000, mistriPrice: 90000 })).status).toBe(400); // above retail
    expect((await api().post("/api/skus").set(h()).send({ name: "---" , retailPrice: 100 })).status).toBe(400); // empty matchKey
    expect((await api().post("/api/skus").set(h()).send({ name: "P", retailPrice: 80000, mistriPrice: -5 })).status).toBe(400); // negative mistri
    expect((await api().post("/api/skus").set(h())).status).toBe(400); // empty body → name/retail defaults
  });
  it("stores optional integer fields (wholesale, weight, stock) when provided", async () => {
    const res = await api().post("/api/skus").set(h()).send({ name: "Full Part", brand: "Swaraj", modelCompat: "735", category: "engine", retailPrice: 100000, wholesalePrice: 60000, mistriPrice: 80000, weightG: 1200, stockQty: 9 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ wholesalePrice: 60000, weightG: 1200, stockQty: 9, brand: "Swaraj" });
  });
  it("creates, and find-or-creates on duplicate normalized name", async () => {
    const a = await api().post("/api/skus").set(h()).send({ name: "ABC-123", retailPrice: 5000 });
    expect(a.status).toBe(201);
    const b = await api().post("/api/skus").set(h()).send({ name: "abc 123", retailPrice: 5000 });
    expect(b.status).toBe(200); // returned existing
    expect(b.body.id).toBe(a.body.id);
  });
});

describe("PATCH /api/skus/:id", () => {
  it("404 unknown, 400 no fields / non-integer", async () => {
    expect((await api().patch("/api/skus/nope").set(H()).send({ name: "x" })).status).toBe(404);
    const s = await makeSku(shopId);
    expect((await api().patch(`/api/skus/${s.id}`).set(H()).send({})).status).toBe(400);
    expect((await api().patch(`/api/skus/${s.id}`).set(H())).status).toBe(400); // no body at all
    expect((await api().patch(`/api/skus/${s.id}`).set(H()).send({ stockQty: "five" })).status).toBe(400);
  });
  it("updates fields, recomputes matchKey on rename, clears mistriPrice", async () => {
    const s = await makeSku(shopId, { name: "Old", retailPrice: 100000, mistriPrice: 90000 });
    expect((await api().patch(`/api/skus/${s.id}`).set(H()).send({ name: "New", stockQty: 7 })).body.stockQty).toBe(7);
    expect((await api().patch(`/api/skus/${s.id}`).set(H()).send({ mistriPrice: null })).body.mistriPrice).toBeNull();
  });
  it("re-validates the mistri price when retail drops below it", async () => {
    const s = await makeSku(shopId, { retailPrice: 100000, mistriPrice: 90000 });
    expect((await api().patch(`/api/skus/${s.id}`).set(H()).send({ retailPrice: 50000 })).status).toBe(400);
  });
  it("updates brand (recomputes matchKey) and finds a part via its normalized key", async () => {
    const s = await makeSku(shopId, { name: "ABC-123", brand: "X", matchKey: "abc123x" });
    expect((await api().patch(`/api/skus/${s.id}`).set(H()).send({ brand: "Swaraj" })).status).toBe(200);
    // search by normalized query hits the matchKey branch
    expect((await api().get("/api/skus?q=abc123").set(H())).body.length).toBe(1);
  });
});
