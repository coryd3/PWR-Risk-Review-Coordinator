import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, DEFAULT_USER_ROLE, type UserRole } from "@workspace/db";
import {
  clearSession,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: ((claims.email as string) || "").trim().toLowerCase() || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  // A transaction-scoped advisory lock makes the "first user" decision atomic so
  // concurrent first sign-ins cannot each be promoted to admin.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(918273645)`);

    const now = new Date();
    const subject = userData.id;

    // 1) Returning user — bind by the verified OIDC subject FIRST. Refresh the
    // profile and stamp the login; the assigned role is never touched here.
    const [bySubject] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, subject));
    if (bySubject) {
      // Refresh the email, but never steal one already owned by a different row
      // (e.g. this may be a collision-created account whose email is null and
      // whose claim email still belongs to someone else) — that would trip the
      // unique constraint and break the login.
      let emailToSet = userData.email;
      if (emailToSet && emailToSet !== bySubject.email) {
        const [conflict] = await tx
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, emailToSet));
        if (conflict && conflict.id !== subject) {
          emailToSet = bySubject.email;
        }
      }
      const [updated] = await tx
        .update(usersTable)
        .set({
          email: emailToSet,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(usersTable.id, subject))
        .returning();
      return updated;
    }

    // 2) First sign-in for this subject. If an admin pre-added them by email,
    // claim that invite and permanently bind this subject to it, keeping the
    // assigned role. We ONLY claim rows that have never signed in
    // (lastLoginAt IS NULL); a matching email that already belongs to a
    // signed-in subject is never inherited, so no one can hijack another
    // person's elevated account by presenting the same email.
    if (userData.email) {
      const [byEmail] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, userData.email));
      if (byEmail && byEmail.lastLoginAt === null) {
        const [claimed] = await tx
          .update(usersTable)
          .set({
            id: subject,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            lastLoginAt: now,
            updatedAt: now,
          })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
        return claimed;
      }
      if (byEmail) {
        // The email is already bound to a different, previously-signed-in
        // subject (e.g. a corporate address later reassigned to a new hire).
        // Do NOT merge or inherit its role: create a fresh, unprivileged
        // account for this subject, dropping the conflicting email.
        console.warn(
          `[auth] email ${userData.email} already bound to another subject; ` +
            `creating a separate default account for subject ${subject}`,
        );
        const [user] = await tx
          .insert(usersTable)
          .values({
            id: subject,
            email: null,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            role: DEFAULT_USER_ROLE,
            lastLoginAt: now,
          })
          .returning();
        return user;
      }
    }

    // 3) Brand-new user with no matching invite: the very first person ever to
    // sign in becomes the admin; everyone after them defaults to the requester
    // role until an admin elevates them.
    const [{ total }] = await tx
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(usersTable);
    const initialRole: UserRole = total === 0 ? "admin" : DEFAULT_USER_ROLE;

    const [user] = await tx
      .insert(usersTable)
      .values({ ...userData, role: initialRole, lastLoginAt: now })
      .returning();
    return user;
  });
}

router.get("/auth/user", async (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    res.json(GetCurrentAuthUserResponse.parse({ user: req.user }));
    return;
  }

  // No session yet — auto-authenticate since Databricks platform already
  // verified the user before they reached this app.
  const email = (
    (req.headers["x-forwarded-email"] as string) ||
    (req.headers["x-forwarded-preferred-username"] as string) ||
    process.env.DATABRICKS_USER_EMAIL ||
    "cldavis@burnsmcd.com"
  ).trim().toLowerCase();

  const dbUser = await upsertUser({
    sub: email,
    email,
    first_name: email.split("@")[0],
    last_name: null,
    profile_image_url: null,
  });

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
      role: dbUser.role as UserRole,
    },
    access_token: "databricks-platform",
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json(GetCurrentAuthUserResponse.parse({ user: sessionData.user }));
});

router.get("/login", async (req: Request, res: Response) => {
  // Databricks platform handles authentication — users must be logged into
  // the workspace before they can reach this app. No OIDC redirect needed.
  const returnTo = getSafeReturnTo(req.query.returnTo);

  // Read user identity from Databricks-injected headers, fall back to env
  const email = (
    (req.headers["x-forwarded-email"] as string) ||
    (req.headers["x-forwarded-preferred-username"] as string) ||
    process.env.DATABRICKS_USER_EMAIL ||
    "cldavis@burnsmcd.com"
  ).trim().toLowerCase();

  const dbUser = await upsertUser({
    sub: email,
    email,
    first_name: email.split("@")[0],
    last_name: null,
    profile_image_url: null,
  });

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
      role: dbUser.role as UserRole,
    },
    access_token: "databricks-platform",
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

// OIDC callback no longer needed — kept as redirect stub for old bookmarks.
router.get("/callback", (_req: Request, res: Response) => {
  res.redirect("/");
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
