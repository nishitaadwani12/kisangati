import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "kisangati", ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`KisanGati API listening on http://localhost:${PORT}`);
});
