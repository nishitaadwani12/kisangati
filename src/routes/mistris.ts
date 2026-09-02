import { Router } from "express";
import { db } from "../db";
import { ah } from "../lib/http";
import { shopWhere } from "../middleware/auth";

export const mistris = Router();

// GET /api/mistris — per-mistri commission roll-up (shop-scoped).
// For each mistri: current wallet balance (= commission owed), lifetime cashback earned,
// lifetime paid out, order count, and last order date. Aggregated in a few grouped queries
// (no N+1). Sorted by amount owed (desc) so staff see who to pay first.
mistris.get(
  "/",
  ah(async (req, res) => {
    const users = await db.user.findMany({
      where: { ...shopWhere(req), userType: "MISTRI" },
      select: { id: true, name: true, phone: true, walletBalance: true },
    });
    const ids = users.map((u) => u.id);

    const [orderAgg, txnAgg] = await Promise.all([
      db.order.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true }, _max: { createdAt: true } }),
      db.walletTxn.groupBy({ by: ["mistriId", "type"], where: { mistriId: { in: ids } }, _sum: { amount: true } }),
    ]);

    const orders = new Map(orderAgg.map((o) => [o.userId, o]));
    const cashback = new Map<string, number>();
    const paidOut = new Map<string, number>();
    for (const t of txnAgg) {
      /* c8 ignore next -- groupBy only returns non-empty groups, so _sum.amount is never null */
      const amt = t._sum.amount ?? 0;
      (t.type === "PAYOUT" ? paidOut : cashback).set(t.mistriId, amt);
    }

    const list = users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      walletBalance: u.walletBalance, // commission currently owed
      totalCashback: cashback.get(u.id) ?? 0,
      totalPaidOut: paidOut.get(u.id) ?? 0,
      orderCount: orders.get(u.id)?._count._all ?? 0,
      lastActivityAt: orders.get(u.id)?._max.createdAt ?? null,
    }));
    list.sort((a, b) => b.walletBalance - a.walletBalance || (a.name ?? "").localeCompare(b.name ?? ""));
    res.json(list);
  })
);
