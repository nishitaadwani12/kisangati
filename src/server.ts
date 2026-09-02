import fs from "fs";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { HttpError } from "./lib/http";
import { MEDIA_DIR } from "./lib/whatsapp";
import { authRequired } from "./middleware/auth";
import { customerRequired } from "./middleware/appAuth";
import { auth } from "./routes/auth";
import { webhook } from "./routes/webhook";
import { shops } from "./routes/shops";
import { orders } from "./routes/orders";
import { skus } from "./routes/skus";
import { customers } from "./routes/customers";
import { stats } from "./routes/stats";
import { appAuth } from "./routes/appAuth";
import { app as appRoutes } from "./routes/app";

// Builds the Express app (no listen) so it can be imported by both index.ts and tests.
export function createApp() {
  const app = express();

  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (corsOrigins.length === 0) console.warn("[cors] CORS_ORIGINS not set — allowing all origins (dev only; set it before deploying).");
  app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));

  app.use(express.json({ limit: "1mb", verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; } }));
  fs.mkdirSync(MEDIA_DIR, { recursive: true });

  const authLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "kisangati", ts: new Date().toISOString() });
  });

  app.use("/media", express.static(MEDIA_DIR));

  app.use("/webhook", webhook); // public — Meta WhatsApp Cloud API (verify token, not JWT)
  app.use("/api/auth", authLimiter, auth);
  app.use("/api/shops", authRequired, shops);
  app.use("/api/orders", authRequired, orders);
  app.use("/api/skus", authRequired, skus);
  app.use("/api/customers", authRequired, customers);
  app.use("/api/stats", authRequired, stats);

  app.use("/app/auth", authLimiter, appAuth);
  app.use("/app", customerRequired, appRoutes);

  // Central error handler — HttpError → its status; multer upload errors → 4xx; else 500.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    /* c8 ignore next -- defensive: no handler sends a response then throws */
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err && (err as { name?: string }).name === "MulterError") {
      const code = (err as { code?: string }).code;
      return res.status(413).json({ error: code === "LIMIT_FILE_SIZE" ? "File too large (max 25 MB)" : "Upload error" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
