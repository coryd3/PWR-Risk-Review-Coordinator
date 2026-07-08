// Client-side helpers for the lightweight Outlook integration (Option A):
// - buildMailtoUrl / openInOutlook: launch a pre-filled message in the user's
//   default mail client (Outlook desktop on corporate machines).
// - buildIcsContent / downloadInvite: produce a standard iCalendar (.ics) file
//   that opens the meeting in Outlook ready to send.
// No authentication and no server calls are required, keeping the app portable.

function normalizeRecipients(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
}

export interface MailtoInput {
  to?: string | null;
  cc?: string | null;
  subject?: string | null;
  body?: string | null;
}

export function buildMailtoUrl(input: MailtoInput): string {
  const to = normalizeRecipients(input.to);
  const params = new URLSearchParams();
  const cc = normalizeRecipients(input.cc);
  if (cc) params.set("cc", cc);
  if (input.subject) params.set("subject", input.subject);
  if (input.body) params.set("body", input.body.replace(/\r?\n/g, "\r\n"));
  // URLSearchParams encodes spaces as "+", but many mail clients render "+"
  // literally in mailto bodies, so normalize to %20.
  const qs = params.toString().replace(/\+/g, "%20");
  const path = encodeURIComponent(to).replace(/%2C/g, ",");
  return `mailto:${path}${qs ? `?${qs}` : ""}`;
}

export function openInOutlook(input: MailtoInput): void {
  const url = buildMailtoUrl(input);
  const a = document.createElement("a");
  a.href = url;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface CalendarInvite {
  subject?: string | null;
  body?: string | null;
  organizer?: string | null;
  requiredAttendees?: string[] | null;
  optionalAttendees?: string[] | null;
  start?: string | null;
  end?: string | null;
  reminderMinutes?: number | null;
  teamsLink?: string | null;
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toIcsUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

// Fold lines longer than 75 octets per RFC 5545 (continuation lines start with a space).
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  let idx = 75;
  while (idx < line.length) {
    chunks.push(" " + line.slice(idx, idx + 74));
    idx += 74;
  }
  return chunks.join("\r\n");
}

export function inviteHasStart(invite: CalendarInvite): boolean {
  return Boolean(invite.start);
}

export function buildIcsContent(invite: CalendarInvite): string {
  if (!invite.start) {
    throw new Error("Cannot build an invite without a start time.");
  }
  const now = toIcsUtc(new Date().toISOString());
  const start = toIcsUtc(invite.start);
  const end = invite.end
    ? toIcsUtc(invite.end)
    : toIcsUtc(new Date(new Date(invite.start).getTime() + 60 * 60_000).toISOString());
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@pwr-risk-coordinator`;

  // Organizer and attendees are captured in the body text. We deliberately do
  // NOT emit an ORGANIZER property (see below) or ATTENDEE properties: we only
  // have attendee names, not email addresses, and fabricating addresses would
  // create bounce-prone invites. This keeps it an appointment the importing
  // user owns and can add real attendees to before sending.
  const headerLines: string[] = [];
  if (invite.organizer) {
    headerLines.push(`Organizer: ${invite.organizer}`);
  }
  if (invite.requiredAttendees && invite.requiredAttendees.length > 0) {
    headerLines.push(`Required Attendees: ${invite.requiredAttendees.join(", ")}`);
  }
  if (invite.optionalAttendees && invite.optionalAttendees.length > 0) {
    headerLines.push(`Optional Attendees: ${invite.optionalAttendees.join(", ")}`);
  }
  const descriptionParts = [
    ...headerLines,
    headerLines.length > 0 ? "" : null,
    invite.body ?? "",
  ].filter((p): p is string => p !== null);
  const description = descriptionParts.join("\n");

  const location =
    invite.teamsLink && !/placeholder/i.test(invite.teamsLink)
      ? invite.teamsLink
      : "";

  const reminder =
    typeof invite.reminderMinutes === "number" && invite.reminderMinutes > 0
      ? invite.reminderMinutes
      : 15;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PWR Risk Review Coordinator//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(invite.subject ?? "PWR Risk Review")}`,
    `DESCRIPTION:${icsEscape(description)}`,
  ];
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  // No ORGANIZER line: Outlook treats an imported .ics whose organizer differs
  // from the current account as a received meeting the user cannot send. Omitting
  // it makes the importing user the organizer so they can invite and send.
  lines.push(
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    `TRIGGER:-PT${reminder}M`,
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function icsFilename(subject?: string | null): string {
  const safe = (subject ?? "invite")
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${safe || "invite"}.ics`;
}

export function downloadInvite(invite: CalendarInvite): void {
  const content = buildIcsContent(invite);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = icsFilename(invite.subject);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
