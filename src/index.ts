import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { HttpError } from "./lib/http";
import { orders } from "./routes/orders";
import { skus } from "./routes/skus";
import { customers } from "./routes/customers";
import { stats } from "./routes/stats";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "kisangati", ts: new Date().toISOString() });
});

app.use("/api/orders", orders);
app.use("/api/skus", skus);
app.use("/api/customers", customers);
app.use("/api/stats", stats);

// Central error handler — HttpError carries a status; everything else is a 500.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`KisanGati API listening on http://localhost:${PORT}`);
});
