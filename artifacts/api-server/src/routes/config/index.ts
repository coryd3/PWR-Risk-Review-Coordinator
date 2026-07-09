import { Router, type IRouter, type Request, type Response } from "express";
import { sql, eq } from "drizzle-orm";
import {
  db,
  riskTriggersTable,
  ruleSetsTable,
  emailTemplatesTable,
  riskReviewRequestsTable,
  emailSettingsTable,
  notificationSubscribersTable,
  type EmailSettingsRow,
  type NotificationSubscriberRow,
} from "@workspace/db";
import {
  UpdateRiskTriggerBody,
  UpdateEmailTemplateBody,
  UpdateRuleSetBody,
  UpdateEmailSettingsBody,
  CreateNotificationSubscriberBody,
  UpdateNotificationSubscriberBody,
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
  DELIVERY_METHODS,
  REGIONS,
  MEETING_TYPES,
  MEETING_STATUSES,
  ATTENDEE_ROLES,
  REQUIRED_ATTENDEE_ROLES,
  ADMIN_ASSIGNED_ROLES,
  REQUEST_TYPES,
  RISK_IDENTIFICATION_STATUSES,
  DRAFT_STATUSES,
  TEMPLATE_TYPES,
  FORMAL_FINAL_REQUIRED,
  FORMAL_FINAL_EPC_REQUIRED,
  FORMAL_FINAL_DBB_REQUIRED,
  FORMAL_FINAL_OPTIONAL,
  FORMAL_FINAL_MAJOR_OPTIONAL,
  FORMAL_FINAL_EPC_DBB_OPTIONAL,
  PRE_RISK_REQUIRED,
  PRE_RISK_EPC_DBB_REQUIRED,
  PRE_RISK_OPTIONAL,
  RISK_REVIEW_MAILBOX,
  RISK_COORDINATOR_RECIPIENT,
  type AttendeeRule,
} from "../../lib/constants";

// Mandatory roles (excluding "if applicable" conditionals) for a meeting stage.
const mandatoryRoles = (rules: AttendeeRule[]): string[] =>
  rules.filter((r) => r.note == null).map((r) => r.role);

// Every matrix rule that carries a configurable default name or mailbox, deduped
// by role, surfaced so the form can pre-fill names and Admin can review them.
const attendeeNamedDefaults = (() => {
  const groups: AttendeeRule[][] = [
    FORMAL_FINAL_REQUIRED,
    FORMAL_FINAL_EPC_REQUIRED,
    FORMAL_FINAL_DBB_REQUIRED,
    FORMAL_FINAL_OPTIONAL,
    FORMAL_FINAL_MAJOR_OPTIONAL,
    FORMAL_FINAL_EPC_DBB_OPTIONAL,
    PRE_RISK_REQUIRED,
    PRE_RISK_EPC_DBB_REQUIRED,
    PRE_RISK_OPTIONAL,
  ];
  const seen = new Set<string>();
  const out: AttendeeRule[] = [];
  for (const group of groups) {
    for (const rule of group) {
      if ((rule.defaultName || rule.email) && !seen.has(rule.role)) {
        seen.add(rule.role);
        out.push(rule);
      }
    }
  }
  return out;
})();

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

// Serialize email settings for clients. The client secret is write-only: only
// a boolean indicating whether one is stored is ever returned.
function mapEmailSettings(row: EmailSettingsRow | null) {
  return {
    enabled: row?.enabled ?? false,
    tenantId: row?.tenantId ?? null,
    clientId: row?.clientId ?? null,
    clientSecretSet: Boolean(row?.clientSecret),
    senderAddress: row?.senderAddress ?? null,
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

function mapSubscriber(row: NotificationSubscriberRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    active: row.active,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}

// GET /api/email-settings
router.get(
  "/email-settings",
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db.select().from(emailSettingsTable).limit(1);
    res.json(mapEmailSettings(rows[0] ?? null));
  },
);

// PUT /api/email-settings
router.put(
  "/email-settings",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateEmailSettingsBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    const values = pickDefined(parsed.data);
    if (Object.keys(values).length === 0) {
      res.status(400).json({ message: "No updatable fields provided" });
      return;
    }
    // Atomic singleton upsert: the settings row always has id = 1, so
    // concurrent first writes can never create duplicate rows.
    const upserted = await db
      .insert(emailSettingsTable)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({
        target: emailSettingsTable.id,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    const saved: EmailSettingsRow = upserted[0];
    await recordAudit(req, {
      entityType: "email_settings",
      entityId: saved.id,
      action: "update",
      // Never log the secret value itself, only which fields changed.
      detail: { fields: Object.keys(values) },
    });
    res.json(mapEmailSettings(saved));
  },
);

// GET /api/notification-subscribers
router.get(
  "/notification-subscribers",
  async (_req: Request, res: Response): Promise<void> => {
    const rows = await db
      .select()
      .from(notificationSubscribersTable)
      .orderBy(notificationSubscribersTable.id);
    res.json(rows.map(mapSubscriber));
  },
);

// POST /api/notification-subscribers
router.post(
  "/notification-subscribers",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateNotificationSubscriberBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    const email = parsed.data.email.trim();
    if (email === "") {
      res.status(400).json({ message: "Email is required" });
      return;
    }
    const inserted = await db
      .insert(notificationSubscribersTable)
      .values({
        email,
        name: parsed.data.name ?? null,
        active: parsed.data.active ?? true,
      })
      .returning();
    await recordAudit(req, {
      entityType: "notification_subscriber",
      entityId: inserted[0].id,
      action: "create",
      detail: { email },
    });
    res.status(201).json(mapSubscriber(inserted[0]));
  },
);

// PUT /api/notification-subscribers/:id
router.put(
  "/notification-subscribers/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid subscriber id" });
      return;
    }
    const parsed = UpdateNotificationSubscriberBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    const values = pickDefined(parsed.data);
    if (typeof values.email === "string") {
      values.email = values.email.trim();
      if (values.email === "") {
        res.status(400).json({ message: "Email cannot be empty" });
        return;
      }
    }
    if (Object.keys(values).length === 0) {
      res.status(400).json({ message: "No updatable fields provided" });
      return;
    }
    const updated = await db
      .update(notificationSubscribersTable)
      .set(values)
      .where(eq(notificationSubscribersTable.id, id))
      .returning();
    if (updated.length === 0) {
      res.status(404).json({ message: "Subscriber not found" });
      return;
    }
    await recordAudit(req, {
      entityType: "notification_subscriber",
      entityId: id,
      action: "update",
      detail: { fields: Object.keys(values) },
    });
    res.json(mapSubscriber(updated[0]));
  },
);

// DELETE /api/notification-subscribers/:id
router.delete(
  "/notification-subscribers/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parsePathId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid subscriber id" });
      return;
    }
    const deleted = await db
      .delete(notificationSubscribersTable)
      .where(eq(notificationSubscribersTable.id, id))
      .returning();
    if (deleted.length === 0) {
      res.status(404).json({ message: "Subscriber not found" });
      return;
    }
    await recordAudit(req, {
      entityType: "notification_subscriber",
      entityId: id,
      action: "delete",
      detail: { email: deleted[0].email },
    });
    res.status(204).send();
  },
);

// GET /api/config
router.get("/config", (_req: Request, res: Response): void => {
  res.json({
    statuses: [...REQUEST_STATUSES],
    nextActions: [...NEXT_ACTIONS],
    businessLines: [...BUSINESS_LINES],
    deliveryMethods: [...DELIVERY_METHODS],
    regions: [...REGIONS],
    meetingTypes: [...MEETING_TYPES],
    meetingStatuses: [...MEETING_STATUSES],
    attendeeRoles: [...ATTENDEE_ROLES],
    requiredAttendeeRoles: [...REQUIRED_ATTENDEE_ROLES],
    adminAssignedRoles: [...ADMIN_ASSIGNED_ROLES],
    formalFinalRequiredRoles: mandatoryRoles(FORMAL_FINAL_REQUIRED),
    formalFinalEpcRequiredRoles: mandatoryRoles(FORMAL_FINAL_EPC_REQUIRED),
    preRiskRequiredRoles: mandatoryRoles(PRE_RISK_REQUIRED),
    preRiskEpcDbbRequiredRoles: mandatoryRoles(PRE_RISK_EPC_DBB_REQUIRED),
    attendeeNamedDefaults,
    emailRouting: {
      mailbox: RISK_REVIEW_MAILBOX,
      coordinator: { ...RISK_COORDINATOR_RECIPIENT },
    },
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
