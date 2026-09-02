import request from "supertest";
import { db } from "../../src/db";
import { createApp } from "../../src/server";
import { signToken, signCustomerToken, hashPassword, Role } from "../../src/lib/auth";

export const app = createApp();
export const api = () => request(app);

// Wipe all rows (FK-safe order) between tests.
export async function resetDb() {
  await db.orderMedia.deleteMany();
  await db.walletTxn.deleteMany();
  await db.payment.deleteMany();
  await db.delivery.deleteMany();
  await db.orderItem.deleteMany();
  await db.partPrediction.deleteMany();
  await db.trainingExample.deleteMany();
  await db.order.deleteMany();
  await db.user.deleteMany();
  await db.adminUser.deleteMany();
  await db.sku.deleteMany();
  await db.shop.deleteMany();
}

let n = 0;
const uniq = () => `${Date.now()}-${n++}`;

export function makeShop(over: Record<string, unknown> = {}) {
  return db.shop.create({ data: { name: `Shop ${uniq()}`, ...over } });
}

export async function makeAdmin(shopId: string | null, role: Role = "OWNER", password = "pw123456") {
  const user = await db.adminUser.create({ data: { email: `${role.toLowerCase()}-${uniq()}@x.com`, passwordHash: await hashPassword(password), role, shopId } });
  return { user, token: signToken({ adminUserId: user.id, role, shopId }) };
}

export async function makeCustomer(shopId: string, userType = "FARMER", phone?: string) {
  const user = await db.user.create({ data: { shopId, phone: phone ?? `+9199${uniq().replace(/\D/g, "").slice(-8)}`, userType, acquisitionChannel: "APP" } });
  return { user, token: signCustomerToken({ userId: user.id, shopId, userType }) };
}

export function makeSku(shopId: string, over: Record<string, unknown> = {}) {
  return db.sku.create({ data: { shopId, matchKey: `mk-${uniq()}`, name: "Part", retailPrice: 80000, mistriPrice: 72000, wholesalePrice: 62000, ...over } });
}

export { db };
