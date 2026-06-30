// Outlook calendar service STUB. Preview-only in the MVP.
// Real calendar event / Teams meeting creation is a FUTURE integration.
import { getOutlookConfig } from "./outlookClient";

export interface CalendarEventInput {
  subject: string;
  body: string;
  start: string;
  end: string;
  timezone: string;
  requiredAttendees: string[];
  optionalAttendees: string[];
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

// TODO (future integration): create a real Outlook calendar event via Graph.
export async function createCalendarEvent(
  _input: CalendarEventInput,
): Promise<never> {
  void getOutlookConfig();
  throw new Error("createCalendarEvent: Not implemented in MVP.");
}

// TODO (future integration): create a real Teams meeting and return the join URL.
export async function createTeamsMeeting(): Promise<never> {
  throw new Error("createTeamsMeeting: Not implemented in MVP.");
}

// TODO (future integration): query Graph findMeetingTimes for availability.
export async function findAvailableMeetingTimes(): Promise<AvailabilitySlot[]> {
  throw new Error("findAvailableMeetingTimes: Not implemented in MVP.");
}
