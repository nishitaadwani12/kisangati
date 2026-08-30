import { Router } from "express";
import { db } from "../db";
import { ah } from "../lib/http";

export const stats = Router();

// GET /api/stats/today — home dashboard numbers.
stats.get(
  "/today",
  ah(async (_req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [ordersToday, byStatus, paidToday] = await Promise.all([
      db.order.count({ where: { createdAt: { gte: start } } }),
      db.order.groupBy({ by: ["status"], _count: { _all: true } }),
      db.payment.aggregate({
        _sum: { amount: true },
        where: { status: "CONFIRMED", confirmedAt: { gte: start } },
      }),
    ]);

    res.json({
      ordersToday,
      salesTodayPaise: paidToday._sum.amount ?? 0,
      statusBreakdown: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    });
  })
);
