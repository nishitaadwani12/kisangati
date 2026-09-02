import { beforeEach, afterAll } from "vitest";
import { db } from "../../src/db";
import { resetDb } from "./helpers";

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await db.$disconnect(); });
