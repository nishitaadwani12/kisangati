import { Router, Request } from "express";
import { db } from "../db";
import { ah } from "../lib/http";
import { shopFilter } from "../middleware/auth";

export const stats = Router();

function shopWhere(req: Request) {
  const s = shopFilter(req);
  return s === undefined ? {} : { shopId: s };
}

// GET /api/stats/today — home dashboard numbers (shop-scoped).
stats.get(
  "/today",
  ah(async (req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const scope = shopWhere(req);

    const [ordersToday, byStatus, paidToday] = await Promise.all([
      db.order.count({ where: { ...scope, createdAt: { gte: start } } }),
      db.order.groupBy({ by: ["status"], _count: { _all: true }, where: scope }),
      db.payment.aggregate({
        _sum: { amount: true },
        where: { status: "CONFIRMED", confirmedAt: { gte: start }, order: { is: scope } },
      }),
    ]);

    res.json({
      ordersToday,
      salesTodayPaise: paidToday._sum.amount ?? 0,
      statusBreakdown: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    });
  })
);
