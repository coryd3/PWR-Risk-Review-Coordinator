import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  meetingsTable,
  riskReviewRequestsTable,
  attendeesTable,
} from "@workspace/db";
import { UpdateMeetingBody } from "@workspace/api-zod";
import { mapMeeting, mapMeetingWithRequest } from "../../lib/mappers";
import { recordAudit } from "../../lib/audit";

const router: IRouter = Router();

function parseId(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/meetings
router.get("/meetings", async (_req: Request, res: Response): Promise<void> => {
  const meetings = await db.select().from(meetingsTable);
  const requests = await db.select().from(riskReviewRequestsTable);
  const attendees = await db.select().from(attendeesTable);

  const requestMap = new Map(requests.map((r) => [r.id, r]));
  const requiredByRequest = new Map<number, string[]>();
  const optionalByRequest = new Map<number, string[]>();
  for (const a of attendees) {
    if (a.requestId == null || !a.name || a.name.trim() === "") continue;
    const target = a.isRequired ? requiredByRequest : optionalByRequest;
    const list = target.get(a.requestId) ?? [];
    list.push(a.name);
    target.set(a.requestId, list);
  }

  res.json(
    meetings.map((m) =>
      mapMeetingWithRequest(
        m,
        m.requestId != null ? requestMap.get(m.requestId) ?? null : null,
        m.requestId != null ? requiredByRequest.get(m.requestId) ?? [] : [],
        m.requestId != null ? optionalByRequest.get(m.requestId) ?? [] : [],
      ),
    ),
  );
});

// PUT /api/meetings/:id
router.put("/meetings/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req);
  if (id == null) {
    res.status(400).json({ message: "Invalid meeting id" });
    return;
  }
  const existing = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, id));
  if (existing.length === 0) {
    res.status(404).json({ message: "Meeting not found" });
    return;
  }
  const body = UpdateMeetingBody.parse(req.body);
  const current = existing[0];

  const updated = await db
    .update(meetingsTable)
    .set({
      meetingType: body.meetingType ?? current.meetingType,
      targetDate: body.targetDate ?? current.targetDate,
      scheduledStart:
        body.scheduledStart !== undefined
          ? body.scheduledStart
            ? new Date(body.scheduledStart)
            : null
          : current.scheduledStart,
      scheduledEnd:
        body.scheduledEnd !== undefined
          ? body.scheduledEnd
            ? new Date(body.scheduledEnd)
            : null
          : current.scheduledEnd,
      timezone: body.timezone ?? current.timezone,
      subject: body.subject ?? current.subject,
      body: body.body ?? current.body,
      teamsLink: body.teamsLink ?? current.teamsLink,
      status: body.status ?? current.status,
      riskLead: body.riskLead ?? current.riskLead,
      rescheduledCount: body.rescheduledCount ?? current.rescheduledCount,
      notes: body.notes ?? current.notes,
    })
    .where(eq(meetingsTable.id, id))
    .returning();
  await recordAudit(req, {
    entityType: "meeting",
    entityId: id,
    action: "update",
    detail: { requestId: current.requestId },
  });
  res.json(mapMeeting(updated[0]));
});

export default router;
