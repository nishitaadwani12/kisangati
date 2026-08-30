import { Router } from "express";
import { db } from "../db";
import { ah, HttpError } from "../lib/http";

export const skus = Router();

// GET /api/skus?q=&lowStock=  — list/search catalog
skus.get(
  "/",
  ah(async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const lowStock = req.query.lowStock === "true";
    const list = await db.sku.findMany({
      where: {
        AND: [
          q ? { OR: [{ name: { contains: q } }, { brand: { contains: q } }, { modelCompat: { contains: q } }] } : {},
          lowStock ? { stockQty: { lte: 5 } } : {},
        ],
      },
      orderBy: { name: "asc" },
    });
    res.json(list);
  })
);

// POST /api/skus — create. Prices in paise.
// body: { name, brand?, modelCompat?, category?, retailPrice, wholesalePrice?, weightG?, stockQty? }
skus.post(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};
    if (!b.name || !Number.isInteger(b.retailPrice) || b.retailPrice < 0)
      throw new HttpError(400, "name and integer retailPrice(paise)>=0 are required");
    const sku = await db.sku.create({
      data: {
        name: b.name,
        brand: b.brand ?? null,
        modelCompat: b.modelCompat ?? null,
        category: b.category ?? null,
        retailPrice: b.retailPrice,
        wholesalePrice: Number.isInteger(b.wholesalePrice) ? b.wholesalePrice : 0,
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
    for (const f of ["retailPrice", "wholesalePrice", "weightG", "stockQty"])
      if (f in b) {
        if (!Number.isInteger(b[f])) throw new HttpError(400, `${f} must be an integer`);
        data[f] = b[f];
      }
    if (Object.keys(data).length === 0) throw new HttpError(400, "no fields to update");
    const sku = await db.sku.update({ where: { id: req.params.id }, data }).catch(() => null);
    if (!sku) throw new HttpError(404, "SKU not found");
    res.json(sku);
  })
);
