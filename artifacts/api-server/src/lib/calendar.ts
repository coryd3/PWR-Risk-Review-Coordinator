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
} from "./constants";

export interface CalendarPreview {
  meetingType: string;
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
      // Default to 10:00 local target date as a placeholder start time.
      const startDate = new Date(`${target}T10:00:00`);
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
