import { Router } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { hashPassword } from "../lib/auth";

export const shops = Router();

// Only the network super-admin may manage shops.
function requireSuper(req: { auth?: { role: string } }) {
  if (req.auth?.role !== "SUPER_ADMIN") throw new HttpError(403, "Only the network admin can manage shops");
}

// GET /api/shops — list all shops (super-admin only)
shops.get(
  "/",
  ah(async (req, res) => {
    requireSuper(req);
    const list = await db.shop.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { orders: true, users: true, skus: true } } },
    });
    res.json(list);
  })
);

// POST /api/shops — create a shop + its owner login (controlled onboarding).
// body: { shopName, town?, ownerEmail, ownerName?, password }
shops.post(
  "/",
  ah(async (req, res) => {
    requireSuper(req);
    /* c8 ignore next -- express.json always sets req.body to at least {}; ?? {} is defensive */
    const b = req.body ?? {};
    const shopName = String(b.shopName ?? "").trim();
    const ownerEmail = String(b.ownerEmail ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!shopName) throw new HttpError(400, "shopName is required");
    if (!/^\S+@\S+\.\S+$/.test(ownerEmail)) throw new HttpError(400, "a valid ownerEmail is required");
    if (password.length < 6) throw new HttpError(400, "password must be at least 6 characters");
    if (await db.adminUser.findUnique({ where: { email: ownerEmail } }))
      throw new HttpError(409, "An account with this email already exists");

    const shop = await db.shop.create({ data: { name: shopName, town: b.town ?? null } });
    const owner = await db.adminUser.create({
      data: { email: ownerEmail, name: b.ownerName ?? null, passwordHash: await hashPassword(password), role: "OWNER", shopId: shop.id },
    });
    res.status(201).json({ shop, owner: { id: owner.id, email: owner.email, role: owner.role } });
  })
);
