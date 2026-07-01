import type { Request, Response, NextFunction } from "express";
import { USER_ROLES, type UserRole } from "@workspace/db";

export const ROLES: readonly UserRole[] = USER_ROLES;

export function isRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** The role of the current request's authenticated user, or null. */
export function currentRole(req: Request): UserRole | null {
  const role = req.user?.role;
  return isRole(role) ? role : null;
}

const ALL: readonly UserRole[] = ["admin", "contributor", "viewer", "requester"];
const READERS: readonly UserRole[] = ["admin", "contributor", "viewer"];
const CONTRIB: readonly UserRole[] = ["admin", "contributor"];
const ADMIN: readonly UserRole[] = ["admin"];
const CREATE_REQUEST: readonly UserRole[] = ["admin", "contributor", "requester"];

interface RouteRule {
  methods: readonly string[];
  pattern: RegExp;
  roles: readonly UserRole[];
}

// First matching rule wins. Paths are relative to the /api mount (e.g. "/requests").
const RULES: readonly RouteRule[] = [
  // User & role management — admin only.
  { methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], pattern: /^\/users(\/|$)/, roles: ADMIN },
  // Legacy tracker import — admin only.
  { methods: ["POST"], pattern: /^\/import(\/|$)/, roles: ADMIN },
  // The New Request form needs these two reads, so requesters may read them.
  { methods: ["GET"], pattern: /^\/config$/, roles: ALL },
  { methods: ["GET"], pattern: /^\/risk-triggers(\/|$)/, roles: ALL },
  // Other config catalogs are for readers only (requesters don't need them).
  { methods: ["GET"], pattern: /^\/(rule-sets|email-templates)(\/|$)/, roles: READERS },
  // Editing config catalogs — admin only.
  { methods: ["POST", "PUT", "PATCH", "DELETE"], pattern: /^\/(risk-triggers|rule-sets|email-templates)(\/|$)/, roles: ADMIN },
  // Submitting a new request — requester (plus contributor/admin).
  { methods: ["POST"], pattern: /^\/requests$/, roles: CREATE_REQUEST },
  // Impact dashboards — readers only.
  { methods: ["GET"], pattern: /^\/usage(\/|$)/, roles: READERS },
];

export function allowedRolesFor(method: string, path: string): readonly UserRole[] {
  for (const rule of RULES) {
    if (rule.methods.includes(method) && rule.pattern.test(path)) {
      return rule.roles;
    }
  }
  // Defaults: any other read is for readers; any other mutation needs contributor.
  return method === "GET" ? READERS : CONTRIB;
}

/**
 * Central authorization guard. Mount after the public (health/auth) routers and
 * before the business routers. Requires an authenticated user with a role that
 * is permitted for the requested method + path.
 */
export function authorizeByRole(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === "OPTIONS") {
    next();
    return;
  }

  const role = currentRole(req);
  if (!role) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const effectiveMethod = method === "HEAD" ? "GET" : method;
  const allowed = allowedRolesFor(effectiveMethod, req.path);
  if (!allowed.includes(role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
