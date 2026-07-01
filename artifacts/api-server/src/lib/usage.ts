import type { Request } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usageEventsTable,
  type InsertUsageEvent,
  type UsageEventRow,
} from "@workspace/db";
import { logger } from "./logger";
import {
  USAGE_ACTIONS,
  USAGE_PROGRAM,
  USAGE_VERSION,
  type UsageActionKey,
} from "./constants";

// Recorded via an in-process hook against the app's own catalog.
export interface UsageInput {
  action: UsageActionKey;
  usageUnit?: number;
  username?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  detail?: unknown;
}

// Recorded via the open POST /usage endpoint (any platform). Raw params mirror
// the external UsageTracking contract; `action` is optional and, when it maps
// to a known catalog entry, fills in sensible defaults.
export interface RawUsageInput {
  program?: string | null;
  addin?: string | null;
  version?: string | null;
  usage?: string | null;
  action?: string | null;
  username?: string | null;
  usageUnit?: number | null;
  minutesPerUnit?: number | null;
  source?: string | null;
  detail?: unknown;
}

interface PersistParams {
  program: string;
  addin: string | null;
  version: string | null;
  usage: string;
  action: string;
  username: string | null;
  usageUnit: number;
  minutesPerUnit: number;
  entityType: string | null;
  entityId: number | null;
  source: string;
  detail: unknown;
}

function resolveUsername(
  req: Request | null,
  explicit?: string | null,
): string | null {
  if (explicit && explicit.trim() !== "") return explicit;
  if (req) {
    const header =
      req.header("x-username") ??
      req.header("x-actor") ??
      req.header("x-user-email");
    if (header && header.trim() !== "") return header;
  }
  return null;
}

function serializeDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return null;
  }
}

function normalizeUnit(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.floor(value);
}

function forwardTarget(): string | null {
  const url = process.env["USAGE_TRACKING_URL"];
  return url && url.trim() !== "" ? url.trim() : null;
}

function buildForwardUrl(base: string, p: PersistParams): string {
  const url = new URL(base);
  url.searchParams.set("Program", p.program);
  if (p.addin) url.searchParams.set("Addin", p.addin);
  if (p.version) url.searchParams.set("Version", p.version);
  url.searchParams.set("Usage", p.usage);
  if (p.username) url.searchParams.set("Username", p.username);
  url.searchParams.set("UsageUnit", String(p.usageUnit));
  return url.toString();
}

/**
 * Fire-and-forget forward of a usage event to the external UsageTracking API.
 * Never throws; updates the row's forward_status when it settles.
 */
async function forwardUsage(id: number, params: PersistParams): Promise<void> {
  const base = forwardTarget();
  if (!base) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(buildForwardUrl(base, params), {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await db
      .update(usageEventsTable)
      .set({ forwardStatus: "sent", forwardError: null })
      .where(eq(usageEventsTable.id, id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, id }, "Failed to forward usage event to external tracker");
    try {
      await db
        .update(usageEventsTable)
        .set({ forwardStatus: "failed", forwardError: message })
        .where(eq(usageEventsTable.id, id));
    } catch {
      // swallow — forwarding is best-effort
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function persist(params: PersistParams): Promise<UsageEventRow | null> {
  const forwardEnabled = forwardTarget() != null;
  const minutesSaved = params.usageUnit * params.minutesPerUnit;
  const values: InsertUsageEvent = {
    program: params.program,
    addin: params.addin,
    version: params.version,
    usage: params.usage,
    action: params.action,
    username: params.username,
    usageUnit: params.usageUnit,
    minutesPerUnit: params.minutesPerUnit,
    minutesSaved,
    entityType: params.entityType,
    entityId: params.entityId,
    source: params.source,
    forwardStatus: forwardEnabled ? "pending" : "disabled",
    detail: serializeDetail(params.detail),
  };
  let row: UsageEventRow | null = null;
  try {
    const inserted = await db.insert(usageEventsTable).values(values).returning();
    row = inserted[0] ?? null;
  } catch (err) {
    logger.warn({ err, action: params.action }, "Failed to record usage event");
    return null;
  }
  if (forwardEnabled && row) {
    void forwardUsage(row.id, params);
  }
  return row;
}

/**
 * Records a usage event for a known catalog action. Fire-and-forget: a failure
 * to log usage never breaks the primary request (mirrors recordAudit).
 */
export async function recordUsage(
  req: Request | null,
  input: UsageInput,
): Promise<void> {
  const def = USAGE_ACTIONS[input.action];
  if (!def) {
    logger.warn({ action: input.action }, "Unknown usage action; skipping");
    return;
  }
  await persist({
    program: USAGE_PROGRAM,
    addin: def.addin,
    version: USAGE_VERSION,
    usage: def.usage,
    action: input.action,
    username: resolveUsername(req, input.username),
    usageUnit: normalizeUnit(input.usageUnit),
    minutesPerUnit: def.minutesPerUnit,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    source: "app",
    detail: input.detail,
  });
}

/**
 * Records a usage event from raw parameters submitted via the open API. Returns
 * the created row (or null on failure). Unlike recordUsage this is awaited by
 * the caller so the API can echo the stored event.
 */
export async function recordUsageRaw(
  req: Request | null,
  input: RawUsageInput,
): Promise<UsageEventRow | null> {
  const catalogKey = input.action as UsageActionKey | undefined;
  const def = catalogKey ? USAGE_ACTIONS[catalogKey] : undefined;

  const usage = (input.usage ?? def?.usage ?? "").trim();
  if (usage === "") {
    throw new Error("`usage` (or a known `action`) is required");
  }
  const minutesPerUnit =
    typeof input.minutesPerUnit === "number" && input.minutesPerUnit >= 0
      ? Math.floor(input.minutesPerUnit)
      : (def?.minutesPerUnit ?? 0);

  return persist({
    program: (input.program ?? USAGE_PROGRAM).trim() || USAGE_PROGRAM,
    addin: input.addin ?? def?.addin ?? null,
    version: input.version ?? USAGE_VERSION,
    usage,
    action: input.action ?? "custom",
    username: resolveUsername(req, input.username),
    usageUnit: normalizeUnit(input.usageUnit),
    minutesPerUnit,
    entityType: null,
    entityId: null,
    source: (input.source ?? "external").trim() || "external",
    detail: input.detail,
  });
}
