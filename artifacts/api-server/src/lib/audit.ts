import type { Request } from "express";
import { db, auditEventsTable, type InsertAuditEvent } from "@workspace/db";
import { logger } from "./logger";

export interface AuditInput {
  entityType: string;
  entityId?: number | null;
  action: string;
  actor?: string | null;
  detail?: unknown;
}

function resolveActor(req: Request, explicit?: string | null): string | null {
  if (explicit && explicit.trim() !== "") return explicit;
  // Prefer the authenticated user's identity when a session is present.
  const user = req.user;
  if (user?.email && user.email.trim() !== "") return user.email;
  if (user?.id) return user.id;
  const header = req.header("x-actor") ?? req.header("x-user-email");
  if (header && header.trim() !== "") return header;
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

/**
 * Records an audit event from a background/system context where no Express
 * request is available (e.g. async email notifications). Actor defaults to
 * "system" unless provided.
 */
export async function recordAuditDirect(input: AuditInput): Promise<void> {
  const values: InsertAuditEvent = {
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    actor: input.actor ?? "system",
    detail: serializeDetail(input.detail),
  };
  try {
    await db.insert(auditEventsTable).values(values);
  } catch (err) {
    logger.warn(
      { err, entityType: input.entityType, action: input.action },
      "Failed to record audit event",
    );
  }
}

/**
 * Records an audit event for a mutating operation. Failures to write the audit
 * log are swallowed (logged at warn level) so they never break the primary
 * request, but every mutation path is expected to call this.
 */
export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  const values: InsertAuditEvent = {
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    actor: resolveActor(req, input.actor),
    detail: serializeDetail(input.detail),
  };
  try {
    await db.insert(auditEventsTable).values(values);
  } catch (err) {
    logger.warn(
      { err, entityType: input.entityType, action: input.action },
      "Failed to record audit event",
    );
  }
}
