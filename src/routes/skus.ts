import { Router, Request } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";
import { shopFilter, shopIdForCreate } from "../middleware/auth";
import { normalizeKey } from "../lib/text";

export const skus = Router();

function shopWhere(req: Request) {
  const s = shopFilter(req);
  return s === undefined ? {} : { shopId: s };
}
function canAccess(req: Request, shopId: string) {
  const s = shopFilter(req);
  return s === undefined || s === shopId;
}

// GET /api/skus?q=&lowStock=  — list/search catalog (shop-scoped)
skus.get(
  "/",
  ah(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const lowStock = req.query.lowStock === "true";
    const nq = q ? normalizeKey(q) : "";
    const list = await db.sku.findMany({
      where: {
        AND: [
          shopWhere(req),
          q
            ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }, { modelCompat: { contains: q } }, ...(nq ? [{ matchKey: { contains: nq } }] : [])] }
            : {},
          lowStock ? { stockQty: { lte: 5 } } : {},
        ],
      },
      orderBy: { name: "asc" },
      take: 30,
    });
    res.json(list);
  })
);

// Validate that an explicit mistriPrice sits between wholesale cost and the farmer retail price.
function validateMistriPrice(mistriPrice: number, retailPrice: number, wholesalePrice: number) {
  if (!Number.isInteger(mistriPrice) || mistriPrice < 0) throw new HttpError(400, "mistriPrice must be an integer (paise) >= 0");
  if (mistriPrice < wholesalePrice) throw new HttpError(400, "mistriPrice cannot be below wholesale cost");
  if (mistriPrice > retailPrice) throw new HttpError(400, "mistriPrice cannot exceed the farmer retail price");
}

// POST /api/skus — create. Prices in paise.
// body: { name, brand?, modelCompat?, category?, retailPrice, mistriPrice?, wholesalePrice?, weightG?, stockQty? }
skus.post(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};
    if (!b.name || !Number.isInteger(b.retailPrice) || b.retailPrice < 0)
      throw new HttpError(400, "name and integer retailPrice(paise)>=0 are required");
    const wholesalePrice = Number.isInteger(b.wholesalePrice) ? b.wholesalePrice : 0;
    if (b.mistriPrice != null) validateMistriPrice(b.mistriPrice, b.retailPrice, wholesalePrice);
    const shopId = shopIdForCreate(req, b.shopId);
    const matchKey = normalizeKey(b.name, b.brand, b.modelCompat);
    if (!matchKey) throw new HttpError(400, "name must contain letters or numbers");

    // Find-or-create: reuse an existing part with the same normalized key in this shop (dedupe),
    // so "abc-123" and "abc 123" never become two records.
    const existing = await db.sku.findUnique({ where: { shopId_matchKey: { shopId, matchKey } } });
    if (existing) return res.status(200).json(existing);

    const sku = await db.sku.create({
      data: {
        shopId,
        matchKey,
        name: b.name,
        brand: b.brand ?? null,
        modelCompat: b.modelCompat ?? null,
        category: b.category ?? null,
        retailPrice: b.retailPrice,
        mistriPrice: b.mistriPrice ?? null,
        wholesalePrice,
        weightG: Number.isInteger(b.weightG) ? b.weightG : 0,
        stockQty: Number.isInteger(b.stockQty) ? b.stockQty : 0,
      },
    });
    res.status(201).json(sku);
  })
);

// PATCH /api/skus/:id — edit fields / adjust stock
skus.patch(
  "/:id",
  ah(async (req, res) => {
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    for (const f of ["name", "brand", "modelCompat", "category"]) if (f in b) data[f] = b[f];
    for (const f of ["retailPrice", "wholesalePrice", "weightG", "stockQty", "mistriPrice"])
      if (f in b && b[f] !== null) {
        if (!Number.isInteger(b[f])) throw new HttpError(400, `${f} must be an integer`);
        data[f] = b[f];
      }
    if ("mistriPrice" in b && b.mistriPrice === null) data.mistriPrice = null; // allow clearing
    if (Object.keys(data).length === 0) throw new HttpError(400, "no fields to update");

    const existing = await db.sku.findUnique({ where: { id: req.params.id } });
    if (!existing || !canAccess(req, existing.shopId)) throw new HttpError(404, "SKU not found");
    if (data.mistriPrice != null) {
      const retail = (data.retailPrice as number) ?? existing.retailPrice;
      const wholesale = (data.wholesalePrice as number) ?? existing.wholesalePrice;
      validateMistriPrice(data.mistriPrice as number, retail, wholesale);
    }
    // Recompute the dedupe key if identifying fields changed.
    if ("name" in data || "brand" in data || "modelCompat" in data) {
      data.matchKey = normalizeKey(
        (data.name as string) ?? existing.name,
        (data.brand as string) ?? existing.brand,
        (data.modelCompat as string) ?? existing.modelCompat
      );
    }
    const sku = await db.sku.update({ where: { id: req.params.id }, data });
    res.json(sku);
  })
);
