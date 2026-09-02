import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Create a fresh SQLite schema for the test DB (prisma/test.db) before the suite runs.
export default function setup() {
  const testDb = path.join(process.cwd(), "prisma", "test.db");
  for (const f of [testDb, `${testDb}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "ignore",
  });
}
