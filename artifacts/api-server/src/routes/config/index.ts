import { Router, type IRouter, type Request, type Response } from "express";
import { sql, eq } from "drizzle-orm";
import {
  db,
  riskTriggersTable,
  ruleSetsTable,
  emailTemplatesTable,
  riskReviewRequestsTable,
} from "@workspace/db";
import {
  UpdateRiskTriggerBody,
  UpdateEmailTemplateBody,
  UpdateRuleSetBody,
} from "@workspace/api-zod";
import {
  mapRiskTrigger,
  mapRuleSet,
  mapEmailTemplate,
} from "../../lib/mappers";
import { recordAudit } from "../../lib/audit";
import {
  REQUEST_STATUSES,
  NEXT_ACTIONS,
  BUSINESS_LINES,
  MEETING_TYPES,
  MEETING_STATUSES,
  ATTENDEE_ROLES,
  EPC_PRIME_ROLES,
  STANDARD_ROLES,
  REQUIRED_ATTENDEE_ROLES,
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

function parsePathId(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

// PUT /api/risk-triggers/:id
router.put(
  "/risk-triggers/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid risk trigger id" });
      return;
    }
    const parsed = UpdateRiskTriggerBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    const values = pickDefined(parsed.data);
    if (Object.keys(values).length === 0) {
      res.status(400).json({ message: "No updatable fields provided" });
      return;
    }
    const updated = await db
      .update(riskTriggersTable)
      .set(values)
      .where(eq(riskTriggersTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ message: "Risk trigger not found" });
      return;
    }
    await recordAudit(req, {
      entityType: "risk_trigger",
      entityId: id,
      action: "update",
      detail: { fields: Object.keys(values) },
    });
    res.json(mapRiskTrigger(updated[0]));
  },
);

// PUT /api/email-templates/:id
router.put(
  "/email-templates/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid email template id" });
      return;
    }
    const parsed = UpdateEmailTemplateBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    const values = pickDefined(parsed.data);
    if (Object.keys(values).length === 0) {
      res.status(400).json({ message: "No updatable fields provided" });
      return;
    }
    const updated = await db
      .update(emailTemplatesTable)
      .set(values)
      .where(eq(emailTemplatesTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ message: "Email template not found" });
      return;
    }
    await recordAudit(req, {
      entityType: "email_template",
      entityId: id,
      action: "update",
      detail: { fields: Object.keys(values) },
    });
    res.json(mapEmailTemplate(updated[0]));
  },
);

// PUT /api/rule-sets/:id
router.put(
  "/rule-sets/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid rule set id" });
      return;
    }
    const parsed = UpdateRuleSetBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    const values = pickDefined(parsed.data);
    if (Object.keys(values).length === 0) {
      res.status(400).json({ message: "No updatable fields provided" });
      return;
    }
    const updated = await db
      .update(ruleSetsTable)
      .set(values)
      .where(eq(ruleSetsTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ message: "Rule set not found" });
      return;
    }
    await recordAudit(req, {
      entityType: "rule_set",
      entityId: id,
      action: "update",
      detail: { fields: Object.keys(values) },
    });
    res.json(mapRuleSet(updated[0]));
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
    requiredAttendeeRoles: [...REQUIRED_ATTENDEE_ROLES],
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
