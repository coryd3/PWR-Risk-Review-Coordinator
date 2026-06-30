// Shared service helpers for assembling request detail and persisting
// classification. Keeps the route handlers thin and the business logic testable.
import { eq, inArray } from "drizzle-orm";
import {
  db,
  riskReviewRequestsTable,
  requestRiskTriggersTable,
  riskTriggersTable,
  attendeesTable,
  meetingsTable,
  type RiskReviewRequestRow,
  type RiskTriggerRow,
  type AttendeeRow,
  type MeetingRow,
} from "@workspace/db";
import { classifyMajor, classifyBusinessLine, computeWarnings } from "./rules";

export interface AttendeeInput {
  name?: string | null;
  email?: string | null;
  role: string;
  attendeeType?: string | null;
  source?: string | null;
  isRequired?: boolean;
}

// Parses a free-form money string ("$50,000,000", "50M") into a number.
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const multiplier = /m$/i.test(trimmed)
    ? 1_000_000
    : /k$/i.test(trimmed)
      ? 1_000
      : 1;
  const numeric = Number(trimmed.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(numeric)) return null;
  return numeric * multiplier;
}

export async function getRequestRow(
  id: number,
): Promise<RiskReviewRequestRow | undefined> {
  const rows = await db
    .select()
    .from(riskReviewRequestsTable)
    .where(eq(riskReviewRequestsTable.id, id));
  return rows[0];
}

export async function getTriggersForRequest(
  id: number,
): Promise<RiskTriggerRow[]> {
  const links = await db
    .select()
    .from(requestRiskTriggersTable)
    .where(eq(requestRiskTriggersTable.requestId, id));
  const ids = links.map((l) => l.triggerId).filter((x): x is number => x != null);
  if (ids.length === 0) return [];
  return db
    .select()
    .from(riskTriggersTable)
    .where(inArray(riskTriggersTable.id, ids));
}

export async function getAttendeesForRequest(
  id: number,
): Promise<AttendeeRow[]> {
  return db
    .select()
    .from(attendeesTable)
    .where(eq(attendeesTable.requestId, id));
}

export async function getMeetingsForRequest(id: number): Promise<MeetingRow[]> {
  return db
    .select()
    .from(meetingsTable)
    .where(eq(meetingsTable.requestId, id));
}

export async function replaceTriggers(
  requestId: number,
  triggerIds: number[],
): Promise<void> {
  await db
    .delete(requestRiskTriggersTable)
    .where(eq(requestRiskTriggersTable.requestId, requestId));
  if (triggerIds.length > 0) {
    await db
      .insert(requestRiskTriggersTable)
      .values(triggerIds.map((triggerId) => ({ requestId, triggerId })));
  }
}

export async function replaceAttendees(
  requestId: number,
  attendees: AttendeeInput[],
): Promise<void> {
  await db.delete(attendeesTable).where(eq(attendeesTable.requestId, requestId));
  if (attendees.length > 0) {
    await db.insert(attendeesTable).values(
      attendees.map((a) => ({
        requestId,
        name: a.name ?? null,
        email: a.email ?? null,
        role: a.role,
        attendeeType: a.attendeeType ?? null,
        source: a.source ?? "form",
        isRequired: a.isRequired ?? true,
      })),
    );
  }
}

// Recomputes Major/Non-Major and business line classification and persists it.
export async function recomputeClassification(
  requestId: number,
): Promise<RiskReviewRequestRow | undefined> {
  const request = await getRequestRow(requestId);
  if (!request) return undefined;
  const triggers = await getTriggersForRequest(requestId);
  const isMajorOpportunity = classifyMajor(triggers);
  const businessLineClassification = classifyBusinessLine(
    request.businessLines ?? [],
  );
  const updated = await db
    .update(riskReviewRequestsTable)
    .set({ isMajorOpportunity, businessLineClassification })
    .where(eq(riskReviewRequestsTable.id, requestId))
    .returning();
  return updated[0];
}

export interface RequestDetail {
  row: RiskReviewRequestRow;
  triggers: RiskTriggerRow[];
  attendees: AttendeeRow[];
  meetings: MeetingRow[];
  warnings: ReturnType<typeof computeWarnings>;
}

export async function loadRequestDetail(
  id: number,
): Promise<RequestDetail | null> {
  const row = await getRequestRow(id);
  if (!row) return null;
  const [triggers, attendees, meetings] = await Promise.all([
    getTriggersForRequest(id),
    getAttendeesForRequest(id),
    getMeetingsForRequest(id),
  ]);
  const warnings = computeWarnings(row, triggers, attendees);
  return { row, triggers, attendees, meetings, warnings };
}
