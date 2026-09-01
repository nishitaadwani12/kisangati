import { Request, Response, NextFunction } from "express";
import { verifyAnyToken, CustomerToken } from "../lib/auth";
import { HttpError } from "../lib/http";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: CustomerToken;
    }
  }
}

// Require a valid CUSTOMER token (mobile app). Attaches req.customer.
export function customerRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new HttpError(401, "Not authenticated"));
  try {
    const payload = verifyAnyToken(token);
    if (!("customer" in payload) || !payload.customer) return next(new HttpError(403, "Not a customer session"));
    req.customer = payload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session"));
  }
}
