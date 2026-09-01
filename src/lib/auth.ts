import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const DEV_SECRET = "dev-only-insecure-secret-change-me";
const SECRET = process.env.JWT_SECRET || DEV_SECRET;
// Fail fast in production: never run on the public dev default.
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || SECRET === DEV_SECRET)) {
  throw new Error("JWT_SECRET must be set to a strong secret in production");
}
if (SECRET === DEV_SECRET) console.warn("[auth] Using the insecure dev JWT secret. Set JWT_SECRET before deploying.");

export type Role = "SUPER_ADMIN" | "OWNER" | "STAFF";
export interface TokenPayload { adminUserId: string; role: Role; shopId: string | null }

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export const signToken = (p: TokenPayload) => jwt.sign(p, SECRET, { expiresIn: "12h" });
export const verifyToken = (token: string): TokenPayload => jwt.verify(token, SECRET) as TokenPayload;

// Customer (farmer/mistri) tokens for the mobile app — kept distinct from admin tokens via `customer: true`.
export interface CustomerToken { customer: true; userId: string; shopId: string; userType: string }
export const signCustomerToken = (p: Omit<CustomerToken, "customer">) =>
  jwt.sign({ ...p, customer: true }, SECRET, { expiresIn: "30d" });
export const verifyAnyToken = (token: string): TokenPayload | CustomerToken =>
  jwt.verify(token, SECRET) as TokenPayload | CustomerToken;
