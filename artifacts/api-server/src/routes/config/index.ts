import { Router, type IRouter, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import {
  db,
  riskTriggersTable,
  ruleSetsTable,
  emailTemplatesTable,
  riskReviewRequestsTable,
} from "@workspace/db";
import {
  mapRiskTrigger,
  mapRuleSet,
  mapEmailTemplate,
} from "../../lib/mappers";
import {
  REQUEST_STATUSES,
  NEXT_ACTIONS,
  BUSINESS_LINES,
  MEETING_TYPES,
  MEETING_STATUSES,
  ATTENDEE_ROLES,
  EPC_PRIME_ROLES,
  STANDARD_ROLES,
  REQUEST_TYPES,
  RISK_IDENTIFICATION_STATUSES,
  DRAFT_STATUSES,
  TEMPLATE_TYPES,
} from "../../lib/constants";

const router: IRouter = Router();

// GET /api/risk-triggers
router.get("/risk-triggers", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(riskTriggersTable)
    .orderBy(riskTriggersTable.triggerNumber);
  res.json(rows.map(mapRiskTrigger));
});

// GET /api/rule-sets
router.get("/rule-sets", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(ruleSetsTable)
    .orderBy(ruleSetsTable.priority);
  res.json(rows.map(mapRuleSet));
});

// GET /api/email-templates
router.get(
  "/email-templates",
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db.select().from(emailTemplatesTable);
    res.json(rows.map(mapEmailTemplate));
  },
);

// GET /api/config
router.get("/config", (_req: Request, res: Response): void => {
  res.json({
    statuses: [...REQUEST_STATUSES],
    nextActions: [...NEXT_ACTIONS],
    businessLines: [...BUSINESS_LINES],
    meetingTypes: [...MEETING_TYPES],
    meetingStatuses: [...MEETING_STATUSES],
    attendeeRoles: [...ATTENDEE_ROLES],
    epcPrimeRoles: [...EPC_PRIME_ROLES],
    standardRoles: [...STANDARD_ROLES],
    requestTypes: [...REQUEST_TYPES],
    riskIdentificationStatuses: [...RISK_IDENTIFICATION_STATUSES],
    draftStatuses: [...DRAFT_STATUSES],
    templateTypes: [...TEMPLATE_TYPES],
  });
});

// GET /api/dashboard/summary
router.get(
  "/dashboard/summary",
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db
      .select({
        status: riskReviewRequestsTable.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(riskReviewRequestsTable)
      .groupBy(riskReviewRequestsTable.status);

    const counts = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      counts.set(r.status, r.count);
      total += r.count;
    }
    const get = (s: string) => counts.get(s) ?? 0;

    res.json({
      newRequests: get("New"),
      readyToSchedule:
        get("Ready to Schedule Pre-Risk") +
        get("Ready to Schedule Formal Risk") +
        get("Ready for Final Risk"),
      preRiskScheduled: get("Pre-Risk Scheduled"),
      formalRiskScheduled: get("Formal Risk Scheduled"),
      finalRiskScheduled: get("Final Risk Scheduled"),
      missingInfo: get("Missing Info"),
      completed: get("Final Risk Complete"),
      total,
    });
  },
);

export default router;
