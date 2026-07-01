import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import {
  importTrackerFile,
  TrackerParseError,
} from "@workspace/tracker-import";
import { recordAudit } from "../../lib/audit";

const router: IRouter = Router();

// Hold the upload in memory; the importer reads from a buffer. Cap the size so a
// stray large file can't exhaust memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function parseDryRun(value: unknown): boolean {
  if (Array.isArray(value)) value = value[0];
  return value === "true" || value === "1";
}

// POST /api/import/tracker — runs the same staging + import logic as the CLI
// importer over an uploaded spreadsheet. `?dryRun=true` previews without writing.
router.post(
  "/import/tracker",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res
        .status(400)
        .json({ message: "No file uploaded. Attach a .xlsx, .xls, or .csv file." });
      return;
    }

    const dryRun = parseDryRun(req.query.dryRun);
    const actor =
      req.header("x-actor") ?? req.header("x-user-email") ?? "import-ui";

    try {
      const summary = await importTrackerFile(file.buffer, {
        sourceFile: file.originalname || "upload",
        dryRun,
        actor,
      });

      if (!dryRun) {
        await recordAudit(req, {
          entityType: "import",
          action: "import_tracker",
          detail: {
            sourceFile: summary.sourceFile,
            rowsRead: summary.rowsRead,
            imported: summary.imported,
            skipped: summary.skipped,
            errored: summary.errored,
          },
        });
      }

      res.json(summary);
    } catch (err) {
      if (err instanceof TrackerParseError) {
        res.status(400).json({ message: err.message });
        return;
      }
      throw err;
    }
  },
);

export default router;
