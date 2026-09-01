import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../lib/auth";
import { HttpError } from "../lib/http";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

// Require a valid Bearer token; attach the decoded payload to req.auth.
export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new HttpError(401, "Not authenticated"));
  try {
    const payload = verifyToken(token) as TokenPayload & { customer?: boolean };
    if (payload.customer) return next(new HttpError(403, "Customer token cannot access the admin API"));
    req.auth = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session"));
  }
}

// Prisma where-fragment limiting a query to the caller's shop ({} = super-admin, all shops).
export function shopWhere(req: Request): Record<string, never> | { shopId: string } {
  const s = shopFilter(req);
  return s === undefined ? {} : { shopId: s };
}

// Whether the caller may access a row belonging to `shopId`.
export function canAccess(req: Request, shopId: string): boolean {
  const s = shopFilter(req);
  return s === undefined || s === shopId;
}

// The shopId a request may act within. OWNER/STAFF are locked to their own shop.
// SUPER_ADMIN (network-wide) may target a shop via ?shopId=... ; otherwise sees all (returns undefined).
export function shopFilter(req: Request): string | undefined {
  const a = req.auth!;
  if (a.role === "SUPER_ADMIN") return (req.query.shopId as string) || undefined; // undefined => all shops
  return a.shopId ?? "__none__"; // non-super without a shop sees nothing
}

// The shopId to stamp on newly-created records. SUPER_ADMIN must specify which shop.
export function shopIdForCreate(req: Request, bodyShopId?: string): string {
  const a = req.auth!;
  if (a.role === "SUPER_ADMIN") {
    const id = bodyShopId || (req.query.shopId as string);
    if (!id) throw new HttpError(400, "shopId is required (super-admin must specify the shop)");
    return id;
  }
  if (!a.shopId) throw new HttpError(403, "Your account is not attached to a shop");
  return a.shopId;
}
