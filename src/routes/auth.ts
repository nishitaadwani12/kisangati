import { Router } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { verifyPassword, signToken, Role } from "../lib/auth";
import { authRequired } from "../middleware/auth";

export const auth = Router();

// POST /api/auth/login — body: { email, password } → { token, user }
auth.post(
  "/login",
  ah(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!email || !password) throw new HttpError(400, "email and password are required");

    const user = await db.adminUser.findUnique({ where: { email }, include: { shop: true } });
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      throw new HttpError(401, "Incorrect email or password");

    const token = signToken({ adminUserId: user.id, role: user.role as Role, shopId: user.shopId });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopId: user.shopId, shopName: user.shop?.name ?? null },
    });
  })
);

// GET /api/auth/me — current session + list of shops (for the super-admin shop switcher)
auth.get(
  "/me",
  authRequired,
  ah(async (req, res) => {
    const a = req.auth!;
    const user = await db.adminUser.findUnique({ where: { id: a.adminUserId }, include: { shop: true } });
    if (!user) throw new HttpError(401, "Session user no longer exists");
    const shops = a.role === "SUPER_ADMIN" ? await db.shop.findMany({ orderBy: { name: "asc" } }) : [];
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopId: user.shopId, shopName: user.shop?.name ?? null },
      shops,
    });
  })
);
