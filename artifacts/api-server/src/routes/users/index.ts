import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateUserRoleBody } from "@workspace/api-zod";
import { recordAudit } from "../../lib/audit";

const router: IRouter = Router();

function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    profileImageUrl: u.profileImageUrl,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

// GET /api/users — list all users and their roles (admin only, enforced centrally).
router.get("/users", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(rows.map(serializeUser));
});

// PATCH /api/users/:id/role — change a user's role (admin only, enforced centrally).
router.patch(
  "/users/:id/role",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = UpdateUserRoleBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    const { role } = parsed.data;
    const id = String(req.params.id);

    const [target] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id));
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Prevent removing the last admin (avoids locking everyone out of admin).
    if (target.role === "admin" && role !== "admin") {
      const admins = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "admin"));
      if (admins.length <= 1) {
        res.status(400).json({ error: "Cannot change the role of the last admin" });
        return;
      }
    }

    const [updated] = await db
      .update(usersTable)
      .set({ role })
      .where(eq(usersTable.id, id))
      .returning();

    await recordAudit(req, {
      entityType: "user",
      action: "role_changed",
      detail: { userId: updated.id, email: updated.email, from: target.role, to: role },
    });

    res.json(serializeUser(updated));
  },
);

export default router;
