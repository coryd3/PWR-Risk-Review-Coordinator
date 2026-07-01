/**
 * Tests for planRow — the DB-free per-row decision logic. The idempotency and
 * CRM-duplicate guards are exercised with in-memory fakes for the database
 * lookups, so these run without a real PostgreSQL connection.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import type { RiskTriggerRow } from "@workspace/db";
import { hashRow, type RawRow } from "./tracker-normalize";
import { planRow, type PlanDeps } from "./tracker-plan";

function trigger(
  id: number,
  triggerNumber: number,
  triggerName: string,
  isMajor = false,
): RiskTriggerRow {
  return {
    id,
    triggerNumber,
    triggerName,
    triggerDescription: null,
    isMajorOpportunityTrigger: isMajor,
    active: true,
  };
}

const TRIGGERS: RiskTriggerRow[] = [
  trigger(101, 1, "Major opportunity threshold exceeded", true),
  trigger(102, 2, "Second major trigger", true),
  trigger(105, 5, "Unusual contract terms"),
  trigger(110, 10, "Client project delivery method is Design-Build or EPC"),
];

// A fake of the database lookups planRow depends on. Seed it with already-
// staged hashes and existing CRM numbers to drive the idempotency paths.
function fakeDeps(opts?: {
  staged?: Record<string, { processed: boolean; requestId: number | null }>;
  crm?: Record<string, number>;
}): PlanDeps {
  const staged = opts?.staged ?? {};
  const crm = opts?.crm ?? {};
  return {
    async getStagedByHash(hash) {
      return staged[hash];
    },
    async getRequestIdByCrm(c) {
      return crm[c];
    },
  };
}

const FULL_ROW: RawRow = {
  "Requester Name": "Sample Requester",
  "Requester Email": "requester@example.com",
  "Client Name": "Example Client",
  "Project Name": "Legacy Project One",
  "CRM Opportunity Number": "OPP-LEGACY-001",
  "BMcD Contract Value": "$45,000,000",
  "Total Installed Cost (TIC)": "$120,000,000",
  "Business Line": "BESS, Solar",
  "EPC Prime": "Yes",
  "Risk Triggers": "1, 5",
  "Pre-Risk Target Date": "07/15/2025",
  "Formal Risk Target Date": "07/29/2025",
  "Pre-Risk Lead": "Lead Person",
  "Business-Line Director": "Dir One <dir@x.com>",
  "Project Manager": "PM A",
  Notes: "Migrated.",
};

test("planRow builds a full import payload with synthesis + classification", async () => {
  const plan = await planRow(FULL_ROW, 2, TRIGGERS, fakeDeps());
  assert.equal(plan.kind, "import");
  if (plan.kind !== "import") return;

  const { payload } = plan;
  assert.equal(plan.label, "Legacy Project One");
  assert.equal(payload.requestValues.businessLineClassification, "BESS + Solar");
  assert.equal(payload.requestValues.isMajorOpportunity, true); // trigger 1
  assert.equal(payload.requestValues.isEpcPrime, true);
  assert.equal(payload.requestValues.bmcdContractValueNumeric, 45_000_000);
  assert.equal(payload.requestValues.totalInstalledCostNumeric, 120_000_000);
  assert.deepEqual(
    payload.matched.map((t) => t.triggerNumber),
    [1, 5],
  );
  // attendees from the two role columns
  assert.deepEqual(
    payload.attendees.map((a) => a.role),
    ["Business-Line Director", "Project Manager"],
  );
  // a meeting per present target date
  assert.deepEqual(
    payload.meetings.map((m) => m.meetingType),
    ["Pre-Risk", "Formal Risk"],
  );
  assert.equal(payload.meetings[0].targetDate, "2025-07-15");
});

test("planRow appends a note for unmatched triggers instead of dropping them", async () => {
  const plan = await planRow(
    { ...FULL_ROW, "Risk Triggers": "1, mystery" },
    2,
    TRIGGERS,
    fakeDeps(),
  );
  assert.equal(plan.kind, "import");
  if (plan.kind !== "import") return;
  assert.deepEqual(plan.payload.unmatched, ["mystery"]);
  assert.match(plan.payload.finalNotes ?? "", /Unmatched risk triggers/);
  assert.match(plan.payload.finalNotes ?? "", /mystery/);
});

test("planRow skips a blank trailing row as 'empty' (not counted)", async () => {
  const plan = await planRow({ a: "", b: null, c: "   " }, 9, TRIGGERS, fakeDeps());
  assert.equal(plan.kind, "empty");
});

test("idempotency: a row already imported (same hash) is skipped, not re-staged", async () => {
  const hash = hashRow(FULL_ROW);
  const deps = fakeDeps({
    staged: { [hash]: { processed: true, requestId: 42 } },
  });
  const plan = await planRow(FULL_ROW, 2, TRIGGERS, deps);
  assert.equal(plan.kind, "skip");
  if (plan.kind !== "skip") return;
  assert.match(plan.reason, /already imported/);
  assert.equal(plan.stage, false);
});

test("idempotency: staged-but-unprocessed row is still imported", async () => {
  const hash = hashRow(FULL_ROW);
  const deps = fakeDeps({
    staged: { [hash]: { processed: false, requestId: null } },
  });
  const plan = await planRow(FULL_ROW, 2, TRIGGERS, deps);
  assert.equal(plan.kind, "import");
});

test("idempotency: re-importing the same file skips on the second pass", async () => {
  // Simulate a stateful staging table: the first import marks the hash
  // processed, so the second pass over the identical row is skipped.
  const stagedState: Record<
    string,
    { processed: boolean; requestId: number | null }
  > = {};
  const deps: PlanDeps = {
    async getStagedByHash(h) {
      return stagedState[h];
    },
    async getRequestIdByCrm() {
      return undefined;
    },
  };

  const first = await planRow(FULL_ROW, 2, TRIGGERS, deps);
  assert.equal(first.kind, "import");
  if (first.kind === "import") {
    // Promote: record the hash as processed (what the real importer does).
    stagedState[first.rowHash] = { processed: true, requestId: 1 };
  }

  const second = await planRow(FULL_ROW, 2, TRIGGERS, deps);
  assert.equal(second.kind, "skip");
  if (second.kind === "skip") {
    assert.match(second.reason, /already imported/);
  }
});

test("an existing CRM opportunity number is not duplicated", async () => {
  const deps = fakeDeps({ crm: { "OPP-LEGACY-001": 7 } });
  const plan = await planRow(FULL_ROW, 2, TRIGGERS, deps);
  assert.equal(plan.kind, "skip");
  if (plan.kind !== "skip") return;
  assert.match(plan.reason, /request already exists for CRM OPP-LEGACY-001 \(id 7\)/);
  assert.equal(plan.stage, true);
});

test("malformed row (no Project Name and no CRM) is recorded as skipped with a reason", async () => {
  const malformed: RawRow = {
    "Requester Name": "Someone",
    "Business Line": "Solar",
    Notes: "row with no identity",
  };
  const plan = await planRow(malformed, 4, TRIGGERS, fakeDeps());
  assert.equal(plan.kind, "skip");
  if (plan.kind !== "skip") return;
  assert.match(
    plan.reason,
    /missing both Project Name and CRM Opportunity Number/,
  );
  // It must be staged (recorded) rather than silently dropped.
  assert.equal(plan.stage, true);
  assert.equal(plan.label, "row 4");
});

test("fixture CSV plans into the expected outcomes end-to-end", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const csvPath = path.resolve(here, "../fixtures/sample-tracker.csv");
  const workbook = XLSX.read(fs.readFileSync(csvPath), { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: null,
    raw: true,
  });

  const deps = fakeDeps();
  const kinds: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const plan = await planRow(rows[i], i + 2, TRIGGERS, deps);
    kinds.push(plan.kind);
  }

  // The fixture must contain at least one of each interesting outcome so the
  // edge cases stay covered as the sheet evolves. (Fully-blank trailing CSV
  // lines are dropped by the parser, so the "empty" path is covered by a
  // dedicated unit test rather than the fixture.)
  assert.ok(kinds.includes("import"), "expected at least one importable row");
  assert.ok(
    kinds.includes("skip"),
    "expected at least one skipped row (the malformed identity-less row)",
  );
});
