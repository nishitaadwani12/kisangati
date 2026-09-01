import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
if (!process.env.JWT_SECRET) console.warn("[auth] JWT_SECRET not set — using an insecure dev default. Set it in .env before deploying.");

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
