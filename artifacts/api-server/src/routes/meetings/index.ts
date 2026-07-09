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
import { getEmailSettingsRow, toCredentials } from "../../lib/notifications";
import {
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  type CalendarAttendee,
  type CalendarEventInput,
} from "../../integrations/graph/graphCalendarService";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadMeetingContext(id: number) {
  const meetings = await db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.id, id));
  if (meetings.length === 0) return null;
  const meeting = meetings[0];
  const request =
    meeting.requestId != null
      ? (
          await db
            .select()
            .from(riskReviewRequestsTable)
            .where(eq(riskReviewRequestsTable.id, meeting.requestId))
        )[0] ?? null
      : null;
  const attendees =
    meeting.requestId != null
      ? await db
          .select()
          .from(attendeesTable)
          .where(eq(attendeesTable.requestId, meeting.requestId))
      : [];
  return { meeting, request, attendees };
}

// POST /api/meetings/:id/send-invite — creates the Outlook event on first send
// (attendees receive invites) or pushes an update to the existing event.
router.post(
  "/meetings/:id/send-invite",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid meeting id" });
      return;
    }
    const ctx = await loadMeetingContext(id);
    if (!ctx) {
      res.status(404).json({ message: "Meeting not found" });
      return;
    }
    const { meeting, request, attendees } = ctx;

    const creds = toCredentials(await getEmailSettingsRow());
    if (!creds) {
      res.status(409).json({
        message:
          "Email settings are not configured or sending is disabled. Configure them in Admin > Email Notifications first.",
      });
      return;
    }
    if (!meeting.scheduledStart || !meeting.scheduledEnd) {
      res.status(400).json({
        message: "Set a scheduled start and end time before sending the invite.",
      });
      return;
    }

    const calendarAttendees: CalendarAttendee[] = [];
    const seen = new Set<string>();
    for (const a of attendees) {
      const email = a.email?.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      calendarAttendees.push({
        email,
        name: a.name,
        required: a.isRequired ?? true,
      });
    }
    if (calendarAttendees.length === 0) {
      res.status(400).json({
        message:
          "No attendees with email addresses found on this request. Add attendee emails first.",
      });
      return;
    }

    const projectName = request?.projectName ?? "Risk Review";
    const subject =
      meeting.subject?.trim() || `${meeting.meetingType} Risk Review - ${projectName}`;
    const bodyText =
      meeting.body?.trim() ||
      `Risk review meeting for ${projectName}.` +
        (request?.clientName ? ` Client: ${request.clientName}.` : "");
    // Only include the meeting link when it uses a safe scheme.
    const safeTeamsLink =
      meeting.teamsLink && /^https?:\/\//i.test(meeting.teamsLink.trim())
        ? meeting.teamsLink.trim()
        : null;
    const input: CalendarEventInput = {
      subject,
      bodyHtml: `<p>${escapeHtml(bodyText)}</p>${
        safeTeamsLink
          ? `<p>Meeting link: <a href="${escapeHtml(safeTeamsLink)}">${escapeHtml(safeTeamsLink)}</a></p>`
          : ""
      }`,
      // scheduledStart/End are absolute instants (stored as timestamps); we
      // send them to Graph as UTC and Outlook renders the event in each
      // attendee's own timezone, so no wall-clock drift is possible.
      startIso: meeting.scheduledStart.toISOString(),
      endIso: meeting.scheduledEnd.toISOString(),
      timezone: "UTC",
      attendees: calendarAttendees,
      // Only ask Graph to create a Teams meeting when no explicit link exists.
      isOnlineMeeting: !meeting.teamsLink,
    };

    const isUpdate = Boolean(meeting.outlookEventId);
    try {
      let eventId = meeting.outlookEventId;
      if (isUpdate && eventId) {
        await updateCalendarEvent(creds, eventId, input);
      } else {
        eventId = await createCalendarEvent(creds, input);
      }
      const updated = await db
        .update(meetingsTable)
        .set({
          outlookEventId: eventId,
          subject,
          status: "Scheduled",
        })
        .where(eq(meetingsTable.id, id))
        .returning();
      await recordAudit(req, {
        entityType: "meeting",
        entityId: id,
        action: isUpdate ? "invite_updated" : "invite_sent",
        detail: { requestId: meeting.requestId, attendees: calendarAttendees.length },
      });
      res.json(mapMeeting(updated[0]));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordAudit(req, {
        entityType: "meeting",
        entityId: id,
        action: "invite_failed",
        detail: { requestId: meeting.requestId, error: message.slice(0, 300) },
      });
      res.status(502).json({
        message: `Could not ${isUpdate ? "update" : "send"} the calendar invite: ${message}`,
      });
    }
  },
);

// POST /api/meetings/:id/cancel-invite — cancels the Outlook event (attendees
// receive a cancellation) if one was sent, and marks the meeting Cancelled.
router.post(
  "/meetings/:id/cancel-invite",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid meeting id" });
      return;
    }
    const ctx = await loadMeetingContext(id);
    if (!ctx) {
      res.status(404).json({ message: "Meeting not found" });
      return;
    }
    const { meeting, request } = ctx;

    if (meeting.outlookEventId) {
      const creds = toCredentials(await getEmailSettingsRow());
      if (!creds) {
        res.status(409).json({
          message:
            "An invite was sent through Outlook, but email settings are no longer configured, so a cancellation cannot be sent. Re-enable them in Admin > Email Notifications.",
        });
        return;
      }
      try {
        await cancelCalendarEvent(
          creds,
          meeting.outlookEventId,
          `The ${meeting.meetingType} risk review for ${request?.projectName ?? "this project"} has been cancelled.`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordAudit(req, {
          entityType: "meeting",
          entityId: id,
          action: "cancel_failed",
          detail: { requestId: meeting.requestId, error: message.slice(0, 300) },
        });
        res.status(502).json({
          message: `Could not send the Outlook cancellation: ${message}`,
        });
        return;
      }
    }

    const updated = await db
      .update(meetingsTable)
      .set({ status: "Cancelled", outlookEventId: null })
      .where(eq(meetingsTable.id, id))
      .returning();
    await recordAudit(req, {
      entityType: "meeting",
      entityId: id,
      action: "invite_cancelled",
      detail: {
        requestId: meeting.requestId,
        outlookCancellationSent: Boolean(meeting.outlookEventId),
      },
    });
    res.json(mapMeeting(updated[0]));
  },
);

export default router;
