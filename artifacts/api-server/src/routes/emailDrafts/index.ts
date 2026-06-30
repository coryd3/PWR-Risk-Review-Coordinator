import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, emailDraftsTable } from "@workspace/db";
import { UpdateEmailDraftBody } from "@workspace/api-zod";
import { mapEmailDraft } from "../../lib/mappers";

const router: IRouter = Router();

function parseId(req: Request): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// PUT /api/email-drafts/:id
router.put(
  "/email-drafts/:id",
  async (req: Request, res: Response): Promise<void> => {
    const id = parseId(req);
    if (id == null) {
      res.status(400).json({ message: "Invalid draft id" });
      return;
    }
    const existing = await db
      .select()
      .from(emailDraftsTable)
      .where(eq(emailDraftsTable.id, id));
    if (existing.length === 0) {
      res.status(404).json({ message: "Email draft not found" });
      return;
    }
    const body = UpdateEmailDraftBody.parse(req.body);
    const current = existing[0];
    const nowSent =
      body.status === "Sent Manually" && current.status !== "Sent Manually";
    const updated = await db
      .update(emailDraftsTable)
      .set({
        toRecipients: body.toRecipients ?? current.toRecipients,
        ccRecipients: body.ccRecipients ?? current.ccRecipients,
        subject: body.subject ?? current.subject,
        body: body.body ?? current.body,
        status: body.status ?? current.status,
        updatedAt: new Date(),
        sentAt: nowSent ? new Date() : current.sentAt,
      })
      .where(eq(emailDraftsTable.id, id))
      .returning();
    res.json(mapEmailDraft(updated[0]));
  },
);

export default router;
