import { Router, Request } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { shopFilter, shopIdForCreate } from "../middleware/auth";

export const customers = Router();

const USER_TYPES = ["FARMER", "MISTRI"];
const CHANNELS = ["WALK_IN", "WHATSAPP", "MISTRI_REFERRAL", "APP"];

function shopWhere(req: Request) {
  const s = shopFilter(req);
  return s === undefined ? {} : { shopId: s };
}

// GET /api/customers?q=  — list with order counts (shop-scoped)
customers.get(
  "/",
  ah(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const list = await db.user.findMany({
      where: {
        AND: [shopWhere(req), q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] } : {}],
      },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true } } },
    });
    res.json(list);
  })
);

// POST /api/customers — create (also the walk-in onboarding path).
// body: { phone, name?, userType, acquisitionChannel, referredByMistriId?, shopId? (super-admin only) }
customers.post(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};
    if (!b.phone) throw new HttpError(400, "phone is required");
    if (!USER_TYPES.includes(b.userType)) throw new HttpError(400, `userType must be one of ${USER_TYPES.join("|")}`);
    if (!CHANNELS.includes(b.acquisitionChannel))
      throw new HttpError(400, `acquisitionChannel must be one of ${CHANNELS.join("|")}`);
    const shopId = shopIdForCreate(req, b.shopId);
    const exists = await db.user.findUnique({ where: { shopId_phone: { shopId, phone: b.phone } } });
    if (exists) throw new HttpError(409, "A customer with this phone already exists in this shop");
    const user = await db.user.create({
      data: {
        shopId,
        phone: b.phone,
        name: b.name ?? null,
        userType: b.userType,
        acquisitionChannel: b.acquisitionChannel,
        referredByMistriId: b.referredByMistriId ?? null,
      },
    });
    res.status(201).json(user);
  })
);

// Load a customer within the caller's shop, or throw 404.
async function getScopedUser(req: Request) {
  const s = shopFilter(req);
  const user = await db.user.findUnique({ where: { id: req.params.id } });
  if (!user || (s !== undefined && s !== user.shopId)) throw new HttpError(404, "Customer not found");
  return user;
}

// GET /api/customers/:id/wallet — mistri wallet balance + transaction history
customers.get(
  "/:id/wallet",
  ah(async (req, res) => {
    const user = await getScopedUser(req);
    const txns = await db.walletTxn.findMany({ where: { mistriId: user.id }, orderBy: { createdAt: "desc" } });
    res.json({ balance: user.walletBalance, txns });
  })
);

// POST /api/customers/:id/payout — pay out the mistri's FULL wallet balance. body: { utr, paidBy }
customers.post(
  "/:id/payout",
  ah(async (req, res) => {
    const utr = String(req.body?.utr ?? "").trim();
    if (!/^[A-Za-z0-9]{6,32}$/.test(utr)) throw new HttpError(400, "a valid payout UTR is required (6–32 alphanumeric)");
    const user = await getScopedUser(req);
    if (user.userType !== "MISTRI") throw new HttpError(400, "Only mistris have a wallet");
    if (user.walletBalance <= 0) throw new HttpError(400, "No balance to pay out");

    const amount = user.walletBalance;
    await db.$transaction([
      db.walletTxn.create({ data: { mistriId: user.id, type: "PAYOUT", amount, ref: utr } }),
      db.user.update({ where: { id: user.id }, data: { walletBalance: 0 } }),
    ]);
    res.json({ mistriId: user.id, paidOutPaise: amount, balance: 0 });
  })
);
