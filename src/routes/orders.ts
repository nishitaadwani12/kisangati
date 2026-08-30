import { Router, Request } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { deliveryFeeFor, cashbackFor } from "../lib/money";
import { generateOtp, hashOtp, verifyOtp } from "../lib/otp";
import { buildUpiLink } from "../lib/upi";
import { shopFilter, shopIdForCreate } from "../middleware/auth";

export const orders = Router();

const ORDER_INCLUDE = {
  user: true,
  items: { include: { sku: true } },
  payment: true,
  delivery: true,
  partPredictions: { include: { predictedSku: true } },
};

// Prisma where-fragment limiting to the caller's shop ({} = super-admin, all shops).
function shopWhere(req: Request) {
  const s = shopFilter(req);
  return s === undefined ? {} : { shopId: s };
}
function canAccess(req: Request, shopId: string) {
  const s = shopFilter(req);
  return s === undefined || s === shopId;
}
// Load an order and enforce shop access (404 if outside the caller's shop).
async function getScopedOrder(req: Request, include?: object) {
  const order = await db.order.findUnique({ where: { id: req.params.id }, include });
  if (!order || !canAccess(req, (order as { shopId: string }).shopId)) throw new HttpError(404, "Order not found");
  return order;
}

// GET /api/orders?status=RECEIVED  — list (scoped to shop), newest first
orders.get(
  "/",
  ah(async (req, res) => {
    const status = req.query.status as string | undefined;
    const list = await db.order.findMany({
      where: { ...shopWhere(req), ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: { user: true, items: true, payment: true, delivery: true },
    });
    res.json(list);
  })
);

// GET /api/orders/:id — full detail (shop-scoped)
orders.get(
  "/:id",
  ah(async (req, res) => {
    res.json(await getScopedOrder(req, ORDER_INCLUDE));
  })
);

// POST /api/orders — create a manual (counter) order.
// body: { userId, orderSource?, rawText?, tractorBrand?, model?, shopId? (super-admin only) }
orders.post(
  "/",
  ah(async (req, res) => {
    const { userId, orderSource, rawText, tractorBrand, model } = req.body ?? {};
    if (!userId) throw new HttpError(400, "userId is required");
    const shopId = shopIdForCreate(req, req.body?.shopId);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, "User not found");
    if (user.shopId !== shopId) throw new HttpError(400, "Customer belongs to a different shop");
    const order = await db.order.create({
      data: { shopId, userId, orderSource: orderSource ?? "COUNTER", rawText, tractorBrand, model, status: "RECEIVED" },
      include: ORDER_INCLUDE,
    });
    res.status(201).json(order);
  })
);

// POST /api/orders/:id/items — set matched line items and recompute totals (paise).
// body: { items: [{ skuId, qty, unitPrice }] }
orders.post(
  "/:id/items",
  ah(async (req, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, "items[] is required");
    const order = await db.order.findUnique({ where: { id: req.params.id } });
    if (!order || !canAccess(req, order.shopId)) throw new HttpError(404, "Order not found");

    let subtotal = 0;
    for (const it of items) {
      if (!it.skuId || !Number.isInteger(it.qty) || it.qty < 1 || !Number.isInteger(it.unitPrice) || it.unitPrice < 0)
        throw new HttpError(400, "each item needs skuId, integer qty>=1, integer unitPrice(paise)>=0");
      subtotal += it.qty * it.unitPrice;
    }
    const deliveryFee = deliveryFeeFor(subtotal);

    const updated = await db.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await tx.orderItem.createMany({
        data: items.map((it: any) => ({ orderId: order.id, skuId: it.skuId, qty: it.qty, unitPrice: it.unitPrice })),
      });
      return tx.order.update({
        where: { id: order.id },
        data: { subtotal, deliveryFee, total: subtotal + deliveryFee },
        include: ORDER_INCLUDE,
      });
    });
    res.json(updated);
  })
);

// POST /api/orders/:id/quote — create/refresh the payment, produce the UPI link, set status QUOTED.
// (Sending the QR to WhatsApp happens once the WhatsApp sender is wired up.)
orders.post(
  "/:id/quote",
  ah(async (req, res) => {
    const order = await db.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order || !canAccess(req, order.shopId)) throw new HttpError(404, "Order not found");
    if (order.total <= 0) throw new HttpError(400, "Add priced items before quoting");

    const upiLink = buildUpiLink(order.total, `KisanGati order ${order.id.slice(-6)}`);
    await db.$transaction([
      db.payment.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, method: "MANUAL_UPI_QR", amount: order.total, status: "PENDING" },
        update: { amount: order.total, status: "PENDING", providerRef: null, confirmedBy: null, confirmedAt: null, paidAt: null },
      }),
      db.order.update({ where: { id: order.id }, data: { status: "QUOTED" } }),
    ]);
    res.json({ orderId: order.id, status: "QUOTED", totalPaise: order.total, upiLink });
  })
);

// POST /api/orders/:id/payment/confirm — manual confirmation.
// body: { utr, confirmedBy }. UTR is REQUIRED: staff must read the UPI reference off the actual
// "money received" notification, which enforces verifying the transfer really landed (not a screenshot).
orders.post(
  "/:id/payment/confirm",
  ah(async (req, res) => {
    const utr = String(req.body?.utr ?? "").trim();
    if (!utr) throw new HttpError(400, "utr is required — enter the UPI reference from the payment-received notification after verifying the amount");
    if (!/^[A-Za-z0-9]{6,32}$/.test(utr)) throw new HttpError(400, "utr looks invalid (expected 6–32 alphanumeric characters)");

    const order = await db.order.findUnique({ where: { id: req.params.id }, include: { payment: true } });
    if (!order || !canAccess(req, order.shopId)) throw new HttpError(404, "Order not found");
    if (!order.payment) throw new HttpError(400, "No payment to confirm — quote the order first");
    if (order.payment.status === "CONFIRMED") throw new HttpError(409, "Payment already confirmed");

    const now = new Date();
    await db.$transaction([
      db.payment.update({
        where: { orderId: order.id },
        data: { status: "CONFIRMED", utr, confirmedBy: req.body?.confirmedBy ?? "staff", confirmedAt: now, paidAt: now },
      }),
      db.order.update({ where: { id: order.id }, data: { status: "PAID" } }),
    ]);
    res.json({ orderId: order.id, status: "PAID", utr });
  })
);

// POST /api/orders/:id/dispatch — assign route/conductor, generate OTP, mark DISPATCHED.
// body: { busRoute, conductorName }. Returns the plaintext OTP ONCE (never stored in plaintext).
orders.post(
  "/:id/dispatch",
  ah(async (req, res) => {
    const { busRoute, conductorName } = req.body ?? {};
    const order = await db.order.findUnique({ where: { id: req.params.id }, include: { payment: true } });
    if (!order || !canAccess(req, order.shopId)) throw new HttpError(404, "Order not found");
    if (order.payment?.status !== "CONFIRMED") throw new HttpError(400, "Confirm payment before dispatch");

    const otp = generateOtp();
    await db.$transaction([
      db.delivery.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, busRoute, conductorName, otpHash: hashOtp(otp), dispatchedAt: new Date() },
        update: { busRoute, conductorName, otpHash: hashOtp(otp), dispatchedAt: new Date(), claimedAt: null },
      }),
      db.order.update({ where: { id: order.id }, data: { status: "DISPATCHED" } }),
    ]);
    res.json({ orderId: order.id, status: "DISPATCHED", otp, busRoute, conductorName });
  })
);

// POST /api/orders/:id/deliver — verify OTP, mark DELIVERED, credit mistri cashback if applicable.
// body: { otp }
orders.post(
  "/:id/deliver",
  ah(async (req, res) => {
    const otp = String(req.body?.otp ?? "");
    const order = await db.order.findUnique({ where: { id: req.params.id }, include: { delivery: true, user: true } });
    if (!order || !canAccess(req, order.shopId)) throw new HttpError(404, "Order not found");
    if (!order.delivery?.otpHash) throw new HttpError(400, "Order not dispatched yet");
    if (!verifyOtp(otp, order.delivery.otpHash)) throw new HttpError(400, "Incorrect OTP");

    // Commission rule: cashback only on app-placed mistri orders.
    const earnsCashback = order.user.userType === "MISTRI" && order.orderSource === "APP";
    const cashback = earnsCashback ? cashbackFor(order.subtotal) : 0;

    await db.$transaction(async (tx) => {
      await tx.delivery.update({ where: { orderId: order.id }, data: { claimedAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
      if (cashback > 0) {
        await tx.walletTxn.create({ data: { mistriId: order.userId, orderId: order.id, type: "CASHBACK", amount: cashback } });
        await tx.user.update({ where: { id: order.userId }, data: { walletBalance: { increment: cashback } } });
      }
    });
    res.json({ orderId: order.id, status: "DELIVERED", cashbackPaise: cashback });
  })
);
