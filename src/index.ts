import "dotenv/config";
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

const app = express();

// Security headers. crossOriginResourcePolicy relaxed so the app/dashboard can load /media cross-origin.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS: restrict to CORS_ORIGINS (comma-separated) if set; otherwise allow all (dev) with a warning.
const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (corsOrigins.length === 0) console.warn("[cors] CORS_ORIGINS not set — allowing all origins (dev only; set it before deploying).");
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));

app.use(express.json({ limit: "1mb" }));
fs.mkdirSync(MEDIA_DIR, { recursive: true }); // ensure media upload/download dir exists

// Throttle auth/OTP endpoints against brute force.
const authLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "kisangati", ts: new Date().toISOString() });
});

// Downloaded WhatsApp media (voice/photos). Public static — filenames are unguessable media ids.
// (Production: move behind signed URLs / object storage.)
app.use("/media", express.static(MEDIA_DIR));

app.use("/webhook", webhook); // public — Meta WhatsApp Cloud API (verify token, not JWT)
app.use("/api/auth", authLimiter, auth); // public (login) + /me (self-guarded)
app.use("/api/shops", authRequired, shops);
app.use("/api/orders", authRequired, orders);
app.use("/api/skus", authRequired, skus);
app.use("/api/customers", authRequired, customers);
app.use("/api/stats", authRequired, stats);

// Customer mobile-app API
app.use("/app/auth", authLimiter, appAuth); // public (phone + OTP)
app.use("/app", customerRequired, appRoutes);

// Central error handler — HttpError carries a status; everything else is a 500.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`KisanGati API listening on http://localhost:${PORT}`);
});
