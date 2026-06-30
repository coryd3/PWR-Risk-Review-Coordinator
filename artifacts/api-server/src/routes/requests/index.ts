import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  riskReviewRequestsTable,
  meetingsTable,
  emailDraftsTable,
  emailTemplatesTable,
  notesTable,
  statusHistoryTable,
} from "@workspace/db";
import {
  CreateRequestBody,
  UpdateRequestBody,
  CreateMeetingBody,
  GenerateEmailDraftsBody,
  CreateNoteBody,
  ChangeStatusBody,
  GenerateCalendarPreviewBody,
} from "@workspace/api-zod";
import {
  loadRequestDetail,
  getRequestRow,
  getTriggersForRequest,
  getAttendeesForRequest,
  replaceTriggers,
  replaceAttendees,
  recomputeClassification,
  parseMoney,
} from "../../lib/requestService";
import {
  mapRequest,
  mapRequestDetail,
  mapMeeting,
  mapEmailDraft,
  mapNote,
  mapStatusHistory,
} from "../../lib/mappers";
import { computeWarnings, classifyMajor, classifyBusinessLine } from "../../lib/rules";
import {
  buildTemplateContext,
  renderTemplate,
  defaultTemplateTypesForRequest,
} from "../../lib/templates";
import { buildCalendarPreview } from "../../lib/calendar";
import { recordAudit } from "../../lib/audit";

const router: IRouter = Router();

function parseId(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/requests
router.get("/requests", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(riskReviewRequestsTable)
    .orderBy(desc(riskReviewRequestsTable.updatedAt));
  res.json(rows.map(mapRequest));
});

// POST /api/requests
router.post("/requests", async (req: Request, res: Response): Promise<void> => {
  const body = CreateRequestBody.parse(req.body);
  const inserted = await db
    .insert(riskReviewRequestsTable)
    .values({
      requesterName: body.requesterName ?? null,
      requesterEmail: body.requesterEmail ?? null,
      clientName: body.clientName ?? null,
      projectName: body.projectName ?? null,
      crmOpportunityNumber: body.crmOpportunityNumber ?? null,
      bmcdContractValueRaw: body.bmcdContractValueRaw ?? null,
      bmcdContractValueNumeric: parseMoney(body.bmcdContractValueRaw),
      totalInstalledCostRaw: body.totalInstalledCostRaw ?? null,
      totalInstalledCostNumeric: parseMoney(body.totalInstalledCostRaw),
      businessLines: body.businessLines ?? [],
      contractReviewRvwNumber: body.contractReviewRvwNumber ?? null,
      isEpcPrime: body.isEpcPrime ?? false,
      requestType: body.requestType ?? null,
      riskIdentificationStatus: body.riskIdentificationStatus ?? null,
      preRiskTargetDate: body.preRiskTargetDate ?? null,
      formalRiskTargetDate: body.formalRiskTargetDate ?? null,
      proposalDueDate: body.proposalDueDate ?? null,
      formalRiskDiscussionDate: body.formalRiskDiscussionDate ?? null,
      finalRiskTargetDate: body.finalRiskTargetDate ?? null,
      preRiskLead: body.preRiskLead ?? null,
      formalRiskLead: body.formalRiskLead ?? null,
      status: body.status ?? "New",
      nextAction: body.nextAction ?? null,
      owner: body.owner ?? null,
      notes: body.notes ?? null,
    })
    .returning();
  const created = inserted[0];

  if (body.triggerIds && body.triggerIds.length > 0) {
    await replaceTriggers(created.id, body.triggerIds);
  }
  if (body.attendees && body.attendees.length > 0) {
    await replaceAttendees(created.id, body.attendees);
  }
  await recomputeClassification(created.id);

  await recordAudit(req, {
    entityType: "request",
    entityId: created.id,
    action: "create",
    actor: body.requesterEmail ?? body.requesterName ?? null,
    detail: { projectName: created.projectName, status: created.status },
  });

  const detail = await loadRequestDetail(created.id);
  if (!detail) {
    res.status(500).json({ message: "Failed to load created request" });
    return;
  }
  res
    .status(201)
    .json(
      mapRequestDetail(
        detail.row,
        detail.triggers,
        detail.attendees,
        detail.meetings,
        detail.warnings,
      ),
    );
});

// GET /api/requests/:id
router.get("/requests/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req);
  if (id == null) {
    res.status(400).json({ message: "Invalid request id" });
    return;
  }
  const detail = await loadRequestDetail(id);
  if (!detail) {
    res.status(404).json({ message: "Request not found" });
    return;
  }
  res.json(
    mapRequestDetail(
      detail.row,
      detail.triggers,
      detail.attendees,
      detail.meetings,
      detail.warnings,
    ),
  );
});

// PUT /api/requests/:id
router.put("/requests/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req);
  if (id == null) {
    res.status(400).json({ message: "Invalid request id" });
    return;
  }
  const existing = await getRequestRow(id);
  if (!existing) {
    res.status(404).json({ message: "Request not found" });
    return;
  }
  const parsed = UpdateRequestBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: "Invalid request body", issues: parsed.error.issues });
    return;
  }
  const { triggerIds, attendees, bmcdContractValueRaw, totalInstalledCostRaw, ...rest } =
    parsed.data;

  // Partial-update semantics: only write keys actually provided in the body so
  // omitted fields are preserved rather than nulled out.
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) values[key] = value;
  }
  if (bmcdContractValueRaw !== undefined) {
    values.bmcdContractValueRaw = bmcdContractValueRaw;
    values.bmcdContractValueNumeric = parseMoney(bmcdContractValueRaw);
  }
  if (totalInstalledCostRaw !== undefined) {
    values.totalInstalledCostRaw = totalInstalledCostRaw;
    values.totalInstalledCostNumeric = parseMoney(totalInstalledCostRaw);
  }

  if (
    Object.keys(values).length === 0 &&
    triggerIds === undefined &&
    attendees === undefined
  ) {
    res.status(400).json({ message: "No updatable fields provided" });
    return;
  }

  if (Object.keys(values).length > 0) {
    await db
      .update(riskReviewRequestsTable)
      .set(values as Partial<typeof riskReviewRequestsTable.$inferInsert>)
      .where(eq(riskReviewRequestsTable.id, id));
  }

  if (triggerIds !== undefined) {
    await replaceTriggers(id, triggerIds);
  }
  if (attendees !== undefined) {
    await replaceAttendees(id, attendees);
  }
  await recomputeClassification(id);

  await recordAudit(req, {
    entityType: "request",
    entityId: id,
    action: "update",
  });

  const detail = await loadRequestDetail(id);
  if (!detail) {
    res.status(404).json({ message: "Request not found" });
    return;
  }
  res.json(
    mapRequestDetail(
      detail.row,
      detail.triggers,
      detail.attendees,
      detail.meetings,
      detail.warnings,
    ),
  );
});

// DELETE /api/requests/:id
router.delete(
  "/requests/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const existing = await getRequestRow(id);
    if (!existing) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    await replaceTriggers(id, []);
    await replaceAttendees(id, []);
    await db.delete(meetingsTable).where(eq(meetingsTable.requestId, id));
    await db.delete(emailDraftsTable).where(eq(emailDraftsTable.requestId, id));
    await db.delete(notesTable).where(eq(notesTable.requestId, id));
    await db
      .delete(statusHistoryTable)
      .where(eq(statusHistoryTable.requestId, id));
    await db
      .delete(riskReviewRequestsTable)
      .where(eq(riskReviewRequestsTable.id, id));
    await recordAudit(req, {
      entityType: "request",
      entityId: id,
      action: "delete",
      detail: { projectName: existing.projectName },
    });
    res.status(204).send();
  },
);

// POST /api/requests/:id/classify
router.post(
  "/requests/:id/classify",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const updated = await recomputeClassification(id);
    if (!updated) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    await recordAudit(req, {
      entityType: "request",
      entityId: id,
      action: "classify",
      detail: {
        isMajorOpportunity: updated.isMajorOpportunity,
        businessLineClassification: updated.businessLineClassification,
      },
    });
    const [triggers, attendees] = await Promise.all([
      getTriggersForRequest(id),
      getAttendeesForRequest(id),
    ]);
    res.json({
      isMajorOpportunity: updated.isMajorOpportunity,
      businessLineClassification: updated.businessLineClassification ?? "Other",
      warnings: computeWarnings(updated, triggers, attendees),
    });
  },
);

// GET /api/requests/:id/meetings
router.get(
  "/requests/:id/meetings",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const rows = await db
      .select()
      .from(meetingsTable)
      .where(eq(meetingsTable.requestId, id));
    res.json(rows.map(mapMeeting));
  },
);

// POST /api/requests/:id/meetings
router.post(
  "/requests/:id/meetings",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const existing = await getRequestRow(id);
    if (!existing) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    const body = CreateMeetingBody.parse(req.body);
    const inserted = await db
      .insert(meetingsTable)
      .values({
        requestId: id,
        meetingType: body.meetingType,
        targetDate: body.targetDate ?? null,
        scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : null,
        scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
        timezone: body.timezone ?? "America/Chicago",
        subject: body.subject ?? null,
        body: body.body ?? null,
        teamsLink: body.teamsLink ?? null,
        status: body.status ?? "Needs Scheduling",
        riskLead: body.riskLead ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    await recordAudit(req, {
      entityType: "meeting",
      entityId: inserted[0].id,
      action: "create",
      detail: { requestId: id, meetingType: inserted[0].meetingType },
    });
    res.status(201).json(mapMeeting(inserted[0]));
  },
);

// GET /api/requests/:id/email-drafts
router.get(
  "/requests/:id/email-drafts",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const rows = await db
      .select()
      .from(emailDraftsTable)
      .where(eq(emailDraftsTable.requestId, id))
      .orderBy(desc(emailDraftsTable.createdAt));
    res.json(rows.map(mapEmailDraft));
  },
);

// POST /api/requests/:id/email-drafts/generate
router.post(
  "/requests/:id/email-drafts/generate",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const detail = await loadRequestDetail(id);
    if (!detail) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    const body = GenerateEmailDraftsBody.parse(req.body ?? {});
    const types =
      body.templateTypes && body.templateTypes.length > 0
        ? body.templateTypes
        : defaultTemplateTypesForRequest(detail.row);

    const context = buildTemplateContext(
      detail.row,
      detail.triggers,
      detail.attendees,
    );

    const created = [];
    for (const type of types) {
      const templates = await db
        .select()
        .from(emailTemplatesTable)
        .where(eq(emailTemplatesTable.templateType, type));
      const template = templates.find((t) => t.active) ?? templates[0];
      if (!template) continue;
      const { subject, body: renderedBody } = renderTemplate(template, context);
      const inserted = await db
        .insert(emailDraftsTable)
        .values({
          requestId: id,
          meetingId: body.meetingId ?? null,
          templateId: template.id,
          templateType: type,
          toRecipients: "",
          ccRecipients: "",
          subject,
          body: renderedBody,
          status: "Draft",
        })
        .returning();
      created.push(mapEmailDraft(inserted[0]));
    }
    await recordAudit(req, {
      entityType: "email_draft",
      entityId: id,
      action: "generate",
      detail: { requestId: id, count: created.length, types },
    });
    res.status(201).json(created);
  },
);

// GET /api/requests/:id/notes
router.get(
  "/requests/:id/notes",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const rows = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.requestId, id))
      .orderBy(desc(notesTable.createdAt));
    res.json(rows.map(mapNote));
  },
);

// POST /api/requests/:id/notes
router.post(
  "/requests/:id/notes",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const existing = await getRequestRow(id);
    if (!existing) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    const body = CreateNoteBody.parse(req.body);
    const inserted = await db
      .insert(notesTable)
      .values({
        requestId: id,
        noteText: body.noteText,
        createdBy: body.createdBy ?? null,
      })
      .returning();
    await recordAudit(req, {
      entityType: "note",
      entityId: inserted[0].id,
      action: "create",
      actor: body.createdBy ?? null,
      detail: { requestId: id },
    });
    res.status(201).json(mapNote(inserted[0]));
  },
);

// POST /api/requests/:id/status
router.post(
  "/requests/:id/status",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const existing = await getRequestRow(id);
    if (!existing) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    const body = ChangeStatusBody.parse(req.body);
    await db.insert(statusHistoryTable).values({
      requestId: id,
      previousStatus: existing.status,
      newStatus: body.newStatus,
      changedBy: body.changedBy ?? null,
      notes: body.notes ?? null,
    });
    const updated = await db
      .update(riskReviewRequestsTable)
      .set({
        status: body.newStatus,
        nextAction: body.nextAction ?? existing.nextAction,
      })
      .where(eq(riskReviewRequestsTable.id, id))
      .returning();
    await recordAudit(req, {
      entityType: "request",
      entityId: id,
      action: "status_change",
      actor: body.changedBy ?? null,
      detail: {
        previousStatus: existing.status,
        newStatus: body.newStatus,
      },
    });
    res.json(mapRequest(updated[0]));
  },
);

// GET /api/requests/:id/status-history
router.get(
  "/requests/:id/status-history",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const rows = await db
      .select()
      .from(statusHistoryTable)
      .where(eq(statusHistoryTable.requestId, id))
      .orderBy(desc(statusHistoryTable.changedAt));
    res.json(rows.map(mapStatusHistory));
  },
);

// POST /api/requests/:id/calendar-preview
router.post(
  "/requests/:id/calendar-preview",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid request id" });
      return;
    }
    const detail = await loadRequestDetail(id);
    if (!detail) {
      res.status(404).json({ message: "Request not found" });
      return;
    }
    const body = GenerateCalendarPreviewBody.parse(req.body ?? {});
    let meeting = null;
    if (body.meetingId != null) {
      meeting =
        detail.meetings.find((m) => m.id === body.meetingId) ?? null;
    }
    const preview = buildCalendarPreview(
      detail.row,
      detail.triggers,
      detail.attendees,
      { meetingType: body.meetingType ?? undefined, meeting },
    );
    res.json(preview);
  },
);

export default router;
