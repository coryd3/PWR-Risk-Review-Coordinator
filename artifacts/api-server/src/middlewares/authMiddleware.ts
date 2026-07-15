import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSession,
  getSessionId,
  getSession,
} from "../lib/auth";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Always resolve the role from the database so that role changes take
  // effect immediately rather than being pinned to the session snapshot.
  const [dbUser] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1);
  if (!dbUser) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = { ...session.user, role: dbUser.role as AuthUser["role"] };
  next();
}
