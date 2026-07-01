import { Router, type IRouter, type Request, type Response } from "express";
import { sql, desc } from "drizzle-orm";
import { db, usageEventsTable } from "@workspace/db";
import { mapUsageEvent } from "../../lib/mappers";
import { recordUsageRaw } from "../../lib/usage";
import { USAGE_ACTIONS, BURDENED_LABOR_RATE_USD } from "../../lib/constants";

const router: IRouter = Router();

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// POST /api/usage — open endpoint: submit a usage event from any platform.
router.post("/usage", async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    v == null || v === "" ? null : Number(v);
  try {
    const row = await recordUsageRaw(req, {
      program: (body.program as string) ?? null,
      addin: (body.addin as string) ?? null,
      version: (body.version as string) ?? null,
      usage: (body.usage as string) ?? null,
      action: (body.action as string) ?? null,
      username: (body.username as string) ?? null,
      usageUnit: num(body.usageUnit),
      minutesPerUnit: num(body.minutesPerUnit),
      source: (body.source as string) ?? null,
      detail: body.detail,
    });
    if (!row) {
      res.status(500).json({ message: "Failed to record usage event" });
      return;
    }
    res.status(201).json(mapUsageEvent(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid usage event";
    res.status(400).json({ message });
  }
});

// GET /api/usage — recent usage events.
router.get("/usage", async (req: Request, res: Response): Promise<void> => {
  const rawLimit = Number(req.query.limit);
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 && rawLimit <= 500
      ? rawLimit
      : 50;
  const rows = await db
    .select()
    .from(usageEventsTable)
    .orderBy(desc(usageEventsTable.createdAt))
    .limit(limit);
  res.json(rows.map(mapUsageEvent));
});

// GET /api/usage/summary — aggregated impact (hours + dollars saved).
router.get(
  "/usage/summary",
  async (_req: Request, res: Response): Promise<void> => {
    const rate = BURDENED_LABOR_RATE_USD;

    const [totals] = await db
      .select({
        count: sql<number>`cast(count(*) as int)`,
        usageUnits: sql<number>`cast(coalesce(sum(${usageEventsTable.usageUnit}), 0) as int)`,
        minutesSaved: sql<number>`cast(coalesce(sum(${usageEventsTable.minutesSaved}), 0) as int)`,
      })
      .from(usageEventsTable);

    const byActionRows = await db
      .select({
        action: usageEventsTable.action,
        count: sql<number>`cast(count(*) as int)`,
        usageUnits: sql<number>`cast(coalesce(sum(${usageEventsTable.usageUnit}), 0) as int)`,
        minutesSaved: sql<number>`cast(coalesce(sum(${usageEventsTable.minutesSaved}), 0) as int)`,
      })
      .from(usageEventsTable)
      .groupBy(usageEventsTable.action);

    const byMonthRows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${usageEventsTable.createdAt}), 'YYYY-MM')`,
        count: sql<number>`cast(count(*) as int)`,
        minutesSaved: sql<number>`cast(coalesce(sum(${usageEventsTable.minutesSaved}), 0) as int)`,
      })
      .from(usageEventsTable)
      .groupBy(sql`date_trunc('month', ${usageEventsTable.createdAt})`)
      .orderBy(sql`date_trunc('month', ${usageEventsTable.createdAt})`);

    const totalMinutes = totals?.minutesSaved ?? 0;
    const totalHours = totalMinutes / 60;

    const byAction = byActionRows
      .map((r) => {
        const def = USAGE_ACTIONS[r.action as keyof typeof USAGE_ACTIONS];
        const hours = r.minutesSaved / 60;
        return {
          action: r.action,
          label: def?.label ?? r.action,
          count: r.count,
          usageUnits: r.usageUnits,
          minutesSaved: r.minutesSaved,
          hoursSaved: round2(hours),
          dollarsSaved: round2(hours * rate),
        };
      })
      .sort((a, b) => b.minutesSaved - a.minutesSaved);

    const byMonth = byMonthRows.map((r) => {
      const hours = r.minutesSaved / 60;
      return {
        month: r.month,
        count: r.count,
        minutesSaved: r.minutesSaved,
        hoursSaved: round2(hours),
        dollarsSaved: round2(hours * rate),
      };
    });

    res.json({
      rate,
      totalEvents: totals?.count ?? 0,
      totalUsageUnits: totals?.usageUnits ?? 0,
      totalMinutesSaved: totalMinutes,
      totalHoursSaved: round2(totalHours),
      totalDollarsSaved: round2(totalHours * rate),
      byAction,
      byMonth,
    });
  },
);

export default router;
