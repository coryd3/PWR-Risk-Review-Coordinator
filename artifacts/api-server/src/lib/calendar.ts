// Calendar invite preview service. Generates preview data only — it does NOT
// create real Outlook/Teams events. Real event creation is a future integration
// (see integrations/outlook).
import type {
  RiskReviewRequestRow,
  RiskTriggerRow,
  AttendeeRow,
  MeetingRow,
} from "@workspace/db";
import {
  DEFAULT_TIMEZONE,
  DEFAULT_MEETING_DURATION_MINUTES,
  DEFAULT_REMINDER_MINUTES,
  RISK_REVIEW_MAILBOX,
} from "./constants";

export interface CalendarPreview {
  meetingType: string;
  organizer: string;
  subject: string;
  body: string;
  requiredAttendees: string[];
  optionalAttendees: string[];
  start: string | null;
  end: string | null;
  timezone: string;
  showAs: string;
  responseRequested: boolean;
  reminderMinutes: number;
  teamsLink: string;
}

function attendeeNames(attendees: AttendeeRow[], required: boolean): string[] {
  return attendees
    .filter((a) => a.isRequired === required && a.name && a.name.trim() !== "")
    .map((a) => a.name as string);
}

function targetDateForType(
  request: RiskReviewRequestRow,
  meetingType: string,
): string | null {
  const t = meetingType.toLowerCase();
  if (t.includes("pre-risk")) return request.preRiskTargetDate;
  if (t.includes("formal")) return request.formalRiskTargetDate;
  if (t.includes("final")) return request.finalRiskTargetDate;
  return null;
}

// Convert a wall-clock time (hour:minute on dateStr) in the given IANA timezone
// to the corresponding UTC instant, accounting for DST on that date. This avoids
// relying on the server's local timezone (UTC in production), which would push a
// downloaded invite to the small hours of the morning.
function zonedWallTimeToUtc(
  dateStr: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcTs = Date.UTC(y, m - 1, d, hour, minute, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcTs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asTz = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  const offset = asTz - utcTs;
  return new Date(utcTs - offset);
}

export function buildCalendarPreview(
  request: RiskReviewRequestRow,
  triggers: RiskTriggerRow[],
  attendees: AttendeeRow[],
  options: { meetingType?: string; meeting?: MeetingRow | null } = {},
): CalendarPreview {
  const meeting = options.meeting ?? null;
  const meetingType = options.meetingType ?? meeting?.meetingType ?? "Pre-Risk";

  const client = request.clientName ?? "TBD";
  const project = request.projectName ?? "TBD";
  const crm = request.crmOpportunityNumber ?? "TBD";

  // Pre-Risk calendar subject format from the spec; reused for all types.
  const subject = `PWR ${meetingType} Review | ${client} - ${project} (${crm})`;

  let start: string | null = null;
  let end: string | null = null;
  if (meeting?.scheduledStart) {
    start = meeting.scheduledStart.toISOString();
    end = meeting.scheduledEnd
      ? meeting.scheduledEnd.toISOString()
      : new Date(
          meeting.scheduledStart.getTime() +
            DEFAULT_MEETING_DURATION_MINUTES * 60_000,
        ).toISOString();
  } else {
    const target = targetDateForType(request, meetingType);
    if (target) {
      // Default to 10:00 AM in the review's timezone as a placeholder start
      // time, resolved to the correct UTC instant so downloaded invites land at
      // 10:00 AM local rather than in the server timezone (UTC in production).
      const startDate = zonedWallTimeToUtc(target, 10, 0, DEFAULT_TIMEZONE);
      start = startDate.toISOString();
      end = new Date(
        startDate.getTime() + DEFAULT_MEETING_DURATION_MINUTES * 60_000,
      ).toISOString();
    }
  }

  const riskLead =
    meeting?.riskLead ?? request.preRiskLead ?? request.formalRiskLead ?? "TBD";

  const triggerList =
    triggers.length > 0
      ? triggers.map((t) => `  - ${t.triggerNumber}. ${t.triggerName}`).join("\n")
      : "  - None selected";

  const body = [
    `[Scheduling note placeholder] Please confirm availability for the ${meetingType} review.`,
    `Risk Lead: ${riskLead}`,
    "Reminder: Please submit slides and the risk register at least 24 hours before the meeting.",
    "",
    `Project Name: ${project}`,
    `CRM Opportunity Number: ${crm}`,
    "Risk Triggers:",
    triggerList,
    `BMcD Contract Value: ${request.bmcdContractValueRaw ?? "TBD"}`,
    `TIC: ${request.totalInstalledCostRaw ?? "TBD"}`,
  ].join("\n");

  return {
    meetingType,
    organizer: RISK_REVIEW_MAILBOX,
    subject,
    body,
    requiredAttendees: attendeeNames(attendees, true),
    optionalAttendees: attendeeNames(attendees, false),
    start,
    end,
    timezone: meeting?.timezone ?? DEFAULT_TIMEZONE,
    showAs: "Busy",
    responseRequested: true,
    reminderMinutes: DEFAULT_REMINDER_MINUTES,
    teamsLink: meeting?.teamsLink ?? "[Teams link placeholder - future integration]",
  };
}
