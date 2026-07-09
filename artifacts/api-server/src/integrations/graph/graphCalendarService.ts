// Microsoft Graph calendar operations (create/update/cancel events) using the
// same service-principal credentials as email sending. Plain fetch, portable.
// Requires the app registration to have the Calendars.ReadWrite application
// permission (in addition to Mail.Send for email notifications).
import {
  getGraphAccessToken,
  type GraphCredentials,
} from "./graphEmailService";

export interface CalendarAttendee {
  email: string;
  name?: string | null;
  required: boolean;
}

export interface CalendarEventInput {
  subject: string;
  bodyHtml: string;
  startIso: string;
  endIso: string;
  timezone: string;
  attendees: CalendarAttendee[];
  isOnlineMeeting: boolean;
}

function eventPayload(input: CalendarEventInput): Record<string, unknown> {
  return {
    subject: input.subject,
    body: { contentType: "HTML", content: input.bodyHtml },
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end: { dateTime: input.endIso, timeZone: input.timezone },
    attendees: input.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? undefined },
      type: a.required ? "required" : "optional",
    })),
    isOnlineMeeting: input.isOnlineMeeting,
    ...(input.isOnlineMeeting ? { onlineMeetingProvider: "teamsForBusiness" } : {}),
  };
}

async function graphFetch(
  creds: GraphCredentials,
  path: string,
  init: { method: string; body?: unknown },
): Promise<Response> {
  const token = await getGraphAccessToken(creds);
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function failWith(prefix: string, res: Response): Promise<never> {
  const text = await res.text();
  throw new Error(`${prefix} (${res.status}): ${text.slice(0, 500)}`);
}

// Creates a calendar event in the sender mailbox; Outlook sends invites to all
// attendees. Returns the Graph event id for later updates/cancellation.
export async function createCalendarEvent(
  creds: GraphCredentials,
  input: CalendarEventInput,
): Promise<string> {
  const res = await graphFetch(
    creds,
    `/users/${encodeURIComponent(creds.senderAddress)}/events`,
    { method: "POST", body: eventPayload(input) },
  );
  if (!res.ok) await failWith("Graph create event failed", res);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Graph create event returned no event id");
  return json.id;
}

// Updates an existing event; Outlook sends meeting updates to attendees.
export async function updateCalendarEvent(
  creds: GraphCredentials,
  eventId: string,
  input: CalendarEventInput,
): Promise<void> {
  const res = await graphFetch(
    creds,
    `/users/${encodeURIComponent(creds.senderAddress)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: eventPayload(input) },
  );
  if (!res.ok) await failWith("Graph update event failed", res);
}

// Cancels an event; Outlook sends cancellations to attendees. Treats an
// already-deleted event (404) as success so cancellation is idempotent.
export async function cancelCalendarEvent(
  creds: GraphCredentials,
  eventId: string,
  comment: string,
): Promise<void> {
  const res = await graphFetch(
    creds,
    `/users/${encodeURIComponent(creds.senderAddress)}/events/${encodeURIComponent(eventId)}/cancel`,
    { method: "POST", body: { comment } },
  );
  if (res.ok || res.status === 404) return;
  await failWith("Graph cancel event failed", res);
}
