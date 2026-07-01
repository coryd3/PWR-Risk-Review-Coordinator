/**
 * Tests for the pure tracker-normalize helpers. Run with:
 *   pnpm --filter @workspace/scripts run test
 * These exercise the parsing/classification logic that silently breaks when the
 * legacy spreadsheet's columns or formatting drift.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { RiskTriggerRow } from "@workspace/db";
import {
  FIELD_ALIASES,
  buildLookup,
  classifyBusinessLine,
  classifyMajor,
  extractAttendees,
  hashRow,
  norm,
  parseAttendeeCell,
  parseBool,
  parseDate,
  parseMoney,
  pickString,
  resolveTriggers,
  splitList,
} from "./tracker-normalize";

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
  trigger(
    110,
    10,
    "Client project delivery method is Design-Build or EPC",
  ),
];

test("norm collapses casing, spacing and punctuation", () => {
  assert.equal(norm("BMcD Contract Value ($)"), "bmcdcontractvalue");
  assert.equal(norm("CRM Opportunity #"), "crmopportunity");
  assert.equal(norm("  Pre-Risk   Target Date "), "prerisktargetdate");
});

test("header aliasing tolerates legacy column-name variants", () => {
  const lookup = buildLookup({
    "BMcD Contract Value ($)": "$45,000,000",
    "Opportunity Name": "Legacy One",
    "CRM #": "OPP-1",
    "Business Line(s)": "BESS, Solar",
  });
  assert.equal(
    pickString(lookup, FIELD_ALIASES.bmcdContractValueRaw),
    "$45,000,000",
  );
  assert.equal(pickString(lookup, FIELD_ALIASES.projectName), "Legacy One");
  assert.equal(
    pickString(lookup, FIELD_ALIASES.crmOpportunityNumber),
    "OPP-1",
  );
  assert.equal(
    pickString(lookup, FIELD_ALIASES.businessLines),
    "BESS, Solar",
  );
});

test("pickString returns null when every alias is blank/missing", () => {
  const lookup = buildLookup({ "Project Name": "   ", Other: "x" });
  assert.equal(pickString(lookup, FIELD_ALIASES.projectName), null);
  assert.equal(pickString(lookup, FIELD_ALIASES.crmOpportunityNumber), null);
});

test("parseMoney handles symbols, commas, and K/M suffixes", () => {
  assert.equal(parseMoney("$45,000,000"), 45_000_000);
  assert.equal(parseMoney("50M"), 50_000_000);
  assert.equal(parseMoney("250k"), 250_000);
  assert.equal(parseMoney("1234.5"), 1234.5);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(null), null);
  // A non-empty string with no digits strips to "" -> Number("") === 0, so it
  // yields 0 rather than null (only empty/nullish input returns null).
  assert.equal(parseMoney("n/a"), 0);
});

test("classifyMajor flags triggers 1, 2, or any Major-flagged trigger", () => {
  assert.equal(classifyMajor([TRIGGERS[0]]), true); // trigger 1
  assert.equal(classifyMajor([TRIGGERS[1]]), true); // trigger 2
  assert.equal(classifyMajor([TRIGGERS[2]]), false); // trigger 5
  assert.equal(
    classifyMajor([
      { triggerNumber: 7, isMajorOpportunityTrigger: true },
    ]),
    true,
  );
  assert.equal(classifyMajor([]), false);
});

test("classifyBusinessLine resolves combinations case-insensitively", () => {
  assert.equal(classifyBusinessLine(["BESS", "Solar"]), "BESS + Solar");
  assert.equal(classifyBusinessLine(["solar"]), "Solar");
  assert.equal(classifyBusinessLine(["bess"]), "BESS");
  assert.equal(classifyBusinessLine(["GHI"]), "GHI");
  assert.equal(classifyBusinessLine(["Wind"]), "Other");
  assert.equal(classifyBusinessLine([]), "Other");
});

test("splitList splits on commas, semicolons, slashes, pipes, newlines", () => {
  assert.deepEqual(splitList("BESS, Solar; Wind"), ["BESS", "Solar", "Wind"]);
  assert.deepEqual(splitList("a/b|c\nd"), ["a", "b", "c", "d"]);
  assert.deepEqual(splitList(null), []);
  assert.deepEqual(splitList("  "), []);
});

test("resolveTriggers matches by number", () => {
  const { matched, unmatched } = resolveTriggers("1, 5", TRIGGERS);
  assert.deepEqual(
    matched.map((t) => t.triggerNumber),
    [1, 5],
  );
  assert.deepEqual(unmatched, []);
});

test("resolveTriggers matches by exact and substring name", () => {
  const { matched } = resolveTriggers(
    "Client project delivery method is Design-Build or EPC",
    TRIGGERS,
  );
  assert.deepEqual(
    matched.map((t) => t.id),
    [110],
  );
});

test("resolveTriggers mixes name and number tokens and dedupes", () => {
  const { matched, unmatched } = resolveTriggers(
    "Client project delivery method is Design-Build or EPC; 10; 1; 1",
    TRIGGERS,
  );
  assert.deepEqual(
    matched.map((t) => t.triggerNumber),
    [10, 1],
  );
  assert.deepEqual(unmatched, []);
});

test("resolveTriggers reports unmatched tokens instead of dropping them", () => {
  const { matched, unmatched } = resolveTriggers("1, 999, mystery", TRIGGERS);
  assert.deepEqual(
    matched.map((t) => t.triggerNumber),
    [1],
  );
  assert.deepEqual(unmatched, ["999", "mystery"]);
});

test("parseBool reads the legacy truthy spellings", () => {
  for (const v of ["Yes", "y", "TRUE", "x", "1", "EPC Prime", true]) {
    assert.equal(parseBool(v), true, `expected ${String(v)} -> true`);
  }
  for (const v of ["No", "n", "", null, undefined, false, "maybe"]) {
    assert.equal(parseBool(v), false, `expected ${String(v)} -> false`);
  }
});

test("parseDate normalizes Date, Excel serial, and string formats", () => {
  assert.equal(parseDate(new Date(Date.UTC(2025, 6, 15))), "2025-07-15");
  assert.equal(parseDate("07/15/2025"), "2025-07-15");
  assert.equal(parseDate("7/5/25"), "2025-07-05");
  assert.equal(parseDate("2025-08-20"), "2025-08-20");
  assert.equal(parseDate("2025-8-2"), "2025-08-02");
  // Excel numeric serials only resolve when XLSX.SSF is available. The ESM
  // build of xlsx does NOT expose SSF, so the importer reads workbooks with
  // `cellDates: true` (dates arrive as Date objects, handled above) and the
  // numeric-serial fallback returns null in this environment.
  assert.equal(parseDate(45853), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate("not a date"), null);
});

test("parseAttendeeCell extracts name + email from <> and () forms", () => {
  assert.deepEqual(parseAttendeeCell("Jane Doe <jane@x.com>"), {
    name: "Jane Doe",
    email: "jane@x.com",
  });
  assert.deepEqual(parseAttendeeCell("John Roe (john@x.com)"), {
    name: "John Roe",
    email: "john@x.com",
  });
  assert.deepEqual(parseAttendeeCell("No Email Person"), {
    name: "No Email Person",
    email: null,
  });
});

test("extractAttendees synthesizes attendees from role columns", () => {
  const lookup = buildLookup({
    "Business-Line Director": "Dir One <dir@x.com>",
    "Project Manager": "PM A; PM B <pmb@x.com>",
    "Attorney": "",
    "Engineering Manager": "EM Person",
  });
  const attendees = extractAttendees(lookup);
  assert.deepEqual(attendees, [
    { name: "Dir One", email: "dir@x.com", role: "Business-Line Director" },
    { name: "PM A", email: null, role: "Project Manager" },
    { name: "PM B", email: "pmb@x.com", role: "Project Manager" },
    { name: "EM Person", email: null, role: "Engineering Manager" },
  ]);
});

test("hashRow is stable and ignores key casing/spacing differences", () => {
  const a = hashRow({ "Project Name": "X", "CRM #": "OPP-1" });
  const b = hashRow({ "project name": "X", "crm #": "OPP-1" });
  assert.equal(a, b);
  const c = hashRow({ "Project Name": "Y", "CRM #": "OPP-1" });
  assert.notEqual(a, c);
});
