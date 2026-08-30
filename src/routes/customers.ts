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
