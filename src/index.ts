import "dotenv/config";
import { createApp } from "./server";

const PORT = Number(process.env.PORT) || 3000;

createApp().listen(PORT, () => {
  console.log(`KisanGati API listening on http://localhost:${PORT}`);
});
