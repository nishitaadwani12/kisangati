import { Router } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { signCustomerToken } from "../lib/auth";
import { issueOtp, checkOtp } from "../lib/otpStore";
import { deliverOtp, otpProviderConfigured } from "../lib/notify";

// PUBLIC customer auth for the mobile app (phone + OTP). No JWT required to reach these.
export const appAuth = Router();

// GET /app/auth/shops — let the app show which shop the customer is ordering from.
appAuth.get(
  "/shops",
  ah(async (_req, res) => {
    const shops = await db.shop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, town: true } });
    res.json(shops);
  })
);

// POST /app/auth/request-otp — body: { shopId, phone }
// Dev: no SMS/WhatsApp sender yet, so the code is logged and (in non-production) returned as devCode.
appAuth.post(
  "/request-otp",
  ah(async (req, res) => {
    const shopId = String(req.body?.shopId ?? "");
    const phone = String(req.body?.phone ?? "").trim();
    if (!/^\+?\d{10,15}$/.test(phone)) throw new HttpError(400, "a valid phone number is required");
    const shop = await db.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new HttpError(404, "Shop not found");

    const code = issueOtp(shopId, phone);
    await deliverOtp(phone, code);
    // Return the code ONLY when explicitly opted in for local dev (OTP_DEV_ECHO=1) and no real
    // provider is configured and not production. Never echo the OTP by default.
    const devEcho = process.env.OTP_DEV_ECHO === "1" && process.env.NODE_ENV !== "production" && !otpProviderConfigured();
    res.json({ sent: true, devCode: devEcho ? code : undefined });
  })
);

// POST /app/auth/verify-otp — body: { shopId, phone, code, name? }
// Verifies, upserts the customer within the shop, returns a customer token + profile.
appAuth.post(
  "/verify-otp",
  ah(async (req, res) => {
    const shopId = String(req.body?.shopId ?? "");
    const phone = String(req.body?.phone ?? "").trim();
    const code = String(req.body?.code ?? "").trim();
    if (!checkOtp(shopId, phone, code)) throw new HttpError(401, "Incorrect or expired code");

    let user = await db.user.findUnique({ where: { shopId_phone: { shopId, phone } } });
    if (!user) {
      // Self-signup defaults to FARMER; mistris are marked by shop staff.
      user = await db.user.create({ data: { shopId, phone, name: req.body?.name ?? null, userType: "FARMER", acquisitionChannel: "APP" } });
    }
    const token = signCustomerToken({ userId: user.id, shopId, userType: user.userType });
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, userType: user.userType, walletBalance: user.walletBalance } });
  })
);
