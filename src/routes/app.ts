import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { deliveryFeeFor, priceFor } from "../lib/money";
import { buildUpiLink } from "../lib/upi";
import { MEDIA_DIR } from "../lib/whatsapp";

// Customer-app API. All routes require a customer token (mounted with customerRequired).
export const app = Router();

const ORDER_INCLUDE = { items: { include: { sku: true } }, payment: true, delivery: true };

// GET /app/me — profile
app.get(
  "/me",
  ah(async (req, res) => {
    const c = req.customer!;
    const user = await db.user.findUnique({ where: { id: c.userId }, include: { shop: true } });
    if (!user) throw new HttpError(401, "Account no longer exists");
    res.json({ id: user.id, name: user.name, phone: user.phone, userType: user.userType, walletBalance: user.walletBalance, shopName: user.shop.name });
  })
);

// GET /app/catalog?q= — shop catalog with the price for THIS customer's type (farmer vs mistri)
app.get(
  "/catalog",
  ah(async (req, res) => {
    const c = req.customer!;
    const q = (req.query.q as string | undefined)?.trim();
    const skus = await db.sku.findMany({
      where: { shopId: c.shopId, ...(q ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }, { modelCompat: { contains: q } }] } : {}) },
      orderBy: { name: "asc" },
      take: 50,
    });
    res.json(skus.map((s) => ({ id: s.id, name: s.name, brand: s.brand, modelCompat: s.modelCompat, category: s.category, price: priceFor(s, c.userType), stockQty: s.stockQty })));
  })
);

// POST /app/orders — place an order.
// body: { items?: [{skuId, qty}], rawText?, mediaUrl?, tractorBrand?, model? }
// Catalog (items) orders are priced and go straight to QUOTED; voice/photo/text go to RECEIVED for staff.
app.post(
  "/orders",
  ah(async (req, res) => {
    const c = req.customer!;
    const b = req.body ?? {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (b.mediaUrl != null && !String(b.mediaUrl).startsWith("/media/")) throw new HttpError(400, "invalid mediaUrl");
    if (items.length > 50) throw new HttpError(400, "too many items");

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: { shopId: c.shopId, userId: c.userId, orderSource: "APP", rawText: b.rawText ?? null, mediaUrl: b.mediaUrl ?? null, tractorBrand: b.tractorBrand ?? null, model: b.model ?? null, status: "RECEIVED" },
      });
      if (items.length) {
        // Fetch all referenced SKUs (scoped to this shop) in ONE query, then build the line items.
        const ids = [...new Set(items.map((it: { skuId: string }) => it.skuId))] as string[];
        const skus = await tx.sku.findMany({ where: { id: { in: ids }, shopId: c.shopId } });
        const byId = new Map(skus.map((s) => [s.id, s]));
        let subtotal = 0;
        const rows = items.map((it: { skuId: string; qty?: number }) => {
          const sku = byId.get(it.skuId);
          if (!sku) throw new HttpError(400, "Unknown part in order");
          const qty = Number.isInteger(it.qty) && (it.qty as number) > 0 ? (it.qty as number) : 1;
          const unitPrice = priceFor(sku, c.userType);
          subtotal += qty * unitPrice;
          return { orderId: created.id, skuId: sku.id, qty, unitPrice };
        });
        await tx.orderItem.createMany({ data: rows });
        const deliveryFee = deliveryFeeFor(subtotal);
        await tx.order.update({ where: { id: created.id }, data: { subtotal, deliveryFee, total: subtotal + deliveryFee, status: "QUOTED" } });
        await tx.payment.create({ data: { orderId: created.id, method: "MANUAL_UPI_QR", amount: subtotal + deliveryFee, status: "PENDING" } });
      }
      return tx.order.findUnique({ where: { id: created.id }, include: ORDER_INCLUDE });
    });

    const upiLink = order && order.total > 0 ? buildUpiLink(order.total, `KisanGati order ${order.id.slice(-6)}`) : null;
    res.status(201).json({ order, upiLink });
  })
);

// GET /app/orders — my orders
app.get(
  "/orders",
  ah(async (req, res) => {
    const c = req.customer!;
    const list = await db.order.findMany({ where: { shopId: c.shopId, userId: c.userId }, orderBy: { createdAt: "desc" }, include: ORDER_INCLUDE });
    res.json(list);
  })
);

// GET /app/orders/:id — my order detail
app.get(
  "/orders/:id",
  ah(async (req, res) => {
    const c = req.customer!;
    const order = await db.order.findUnique({ where: { id: req.params.id }, include: ORDER_INCLUDE });
    if (!order || order.userId !== c.userId) throw new HttpError(404, "Order not found");
    res.json(order);
  })
);

// GET /app/wallet — mistri wallet balance + history
app.get(
  "/wallet",
  ah(async (req, res) => {
    const c = req.customer!;
    const user = await db.user.findUnique({ where: { id: c.userId } });
    const txns = await db.walletTxn.findMany({ where: { mistriId: c.userId }, orderBy: { createdAt: "desc" } });
    res.json({ balance: user?.walletBalance ?? 0, txns });
  })
);

// POST /app/media — upload a voice note / photo (multipart field "file"); returns its /media URL.
// Only image/audio types allowed; the extension is derived from the (trusted) MIME, and the filename is a
// random UUID — client filenames are never used (avoids stored-XSS / arbitrary-file hosting).
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/webm": "webm",
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
    filename: (_req, file, cb) => cb(null, `app-${randomUUID()}.${ALLOWED_MIME[file.mimetype] ?? "bin"}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIME[file.mimetype] ? cb(null, true) : cb(new HttpError(400, "Only image or audio files are allowed")),
});
app.post(
  "/media",
  upload.single("file"),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, "no file uploaded (field name must be 'file')");
    res.status(201).json({ url: `/media/${req.file.filename}` });
  })
);
