// Centralized configuration enums and static rules.
// These are intentionally kept out of React components so they remain the
// single source of truth for the backend rule/template/calendar services.
// TODO: A future iteration can move these into the rule_sets table so they are
// editable from the Admin screen without a code change.

export const REQUEST_STATUSES = [
  "New",
  "Needs Review",
  "Missing Info",
  "Roles Assigned",
  "Ready to Schedule Pre-Risk",
  "Pre-Risk Scheduled",
  "Pre-Risk Complete",
  "Ready to Schedule Formal Risk",
  "Formal Risk Scheduled",
  "Formal Risk Complete",
  "Ready for Final Risk",
  "Final Risk Scheduled",
  "Final Risk Complete",
  "Cancelled",
  "On Hold",
] as const;

export const NEXT_ACTIONS = [
  "Review request",
  "Confirm attendees",
  "Confirm legal information",
  "Confirm risk lead",
  "Schedule pre-risk",
  "Send pre-risk invite manually",
  "Await slides/risk register",
  "Schedule formal risk",
  "Send formal risk invite manually",
  "Follow up with requester",
  "Schedule final risk",
  "Close request",
] as const;

export const BUSINESS_LINES = [
  "BESS",
  "NES",
  "GHI",
  "Nuclear",
  "Solar",
  "Mining",
] as const;

export const MEETING_TYPES = ["Pre-Risk", "Formal Risk", "Final Risk"] as const;

export const MEETING_STATUSES = [
  "Not Started",
  "Needs Scheduling",
  "Scheduled",
  "Indicative",
  "Waiting for Client",
  "Not Needed",
  "N/A",
  "Complete",
  "Rescheduled",
  "Cancelled",
  "On Hold",
] as const;

// Project delivery method. Central to Major-opportunity classification per the
// validated packet: Design-Build/EPC and Professional Services use the BMcD fee
// threshold; Design-Bid-Build uses the Total Installed Cost threshold.
export const DELIVERY_METHODS = [
  "Design-Build / EPC",
  "Design-Bid-Build",
  "Professional Services",
] as const;

// Geographic region. KC (Kansas City home office) vs Non-KC drives regional
// attendee routing and reporting.
export const REGIONS = ["KC", "Non-KC"] as const;

// Major-opportunity thresholds (USD).
export const MAJOR_FEE_THRESHOLD_USD = 10_000_000;
export const MAJOR_DBB_TIC_THRESHOLD_USD = 50_000_000;
// President of Construction is an optional attendee only when the project is EPC
// and its Total Installed Cost exceeds this threshold (validated packet).
export const EPC_PRESIDENT_TIC_THRESHOLD_USD = 30_000_000;

// ---------------------------------------------------------------------------
// Attendee matrix (validated packet)
// ---------------------------------------------------------------------------
// The required/optional attendee set differs by meeting (Pre-Risk vs
// Formal/Final Risk), delivery method (EPC vs DBB), Major-opportunity status,
// and business line (Solar/BESS add distribution mailboxes).
//
// Named individuals are intentionally stored as configurable DEFAULTS on each
// rule (defaultName / email) rather than hardcoded into templates or logic. The
// packet explicitly warns against hardcoding attendee names, so an admin can
// maintain these without a code change.
// TODO: move these rules into the rule_sets table for full Admin editing.

export interface AttendeeRule {
  // Canonical role label. Also drives the attendee role dropdown and the
  // required-attendee warnings, so labels must stay stable.
  role: string;
  // Packet-provided default individual for this seat, if any. Configurable.
  defaultName?: string;
  // Distribution mailbox for "mailbox" seats (e.g. business-line distros).
  email?: string;
  // Applicability note (e.g. "if applicable", threshold conditions). Rules with
  // a note are conditional and are NOT flagged as missing by warnings.
  note?: string;
}

// Coordinator seats that are assigned by the admin AFTER the requester submits
// the initial request. They are never collected on the new-request form; the
// admin fills them in from the request dashboard, which advances the request
// status to "Roles Assigned".
export const ADMIN_ASSIGNED_ROLES = [
  "Formal Risk Coordinator",
  "PWR Risk Coordinator",
] as const;

// Required for every Formal & Final Risk Review.
export const FORMAL_FINAL_REQUIRED: AttendeeRule[] = [
  { role: "Formal Risk Coordinator" },
  { role: "PWR Risk Coordinator" },
  { role: "Executive-in-Charge" },
  { role: "Business-Line Director" },
  { role: "Biz Develop/Capture Manager" },
  { role: "Project Manager" },
  { role: "Engineering Manager" },
  { role: "Attorney" },
];

// Additional required attendees for EPC Formal & Final Risk Reviews.
export const FORMAL_FINAL_EPC_REQUIRED: AttendeeRule[] = [
  { role: "CDB Operations Executive", defaultName: "Matt Ralston or Chad Cotter" },
  { role: "Business Line CDB Operations Manager" },
  { role: "Construction Manager", note: "if applicable" },
  { role: "Self-Perform Construction Lead", note: "if applicable" },
];

// Additional required attendees for DBB Formal & Final Risk Reviews.
export const FORMAL_FINAL_DBB_REQUIRED: AttendeeRule[] = [
  { role: "Construction Manager", note: "if applicable" },
  { role: "Self-Perform Construction Lead", note: "if applicable" },
];

// Optional for all Formal & Final Risk Reviews.
export const FORMAL_FINAL_OPTIONAL: AttendeeRule[] = [
  { role: "Regional GP Manager", note: "if applicable" },
  { role: "Regional Risk Manager", note: "if applicable" },
  { role: "PWR Risk Admin", email: "PWR-RiskExecReviews@burnsmcd.com" },
];

// Optional for Major-opportunity Formal & Final Risk Reviews.
export const FORMAL_FINAL_MAJOR_OPTIONAL: AttendeeRule[] = [
  { role: "Senior VP & General Manager, PWR", defaultName: "Scott Strawn" },
  { role: "Vice President, Operations", defaultName: "Travis Fucich" },
  { role: "PWR Lead Risk Coordinator", defaultName: "Chris Hamker" },
  { role: "SVP, Energy", defaultName: "Ed Anello & Joe Podrebarac" },
  { role: "COO, Energy", defaultName: "Paul Fischer" },
  { role: "Insurance" },
];

// Optional for EPC or DBB Formal & Final Risk Reviews.
export const FORMAL_FINAL_EPC_DBB_OPTIONAL: AttendeeRule[] = [
  {
    role: "Senior VP of Self-Perform Construction",
    defaultName: "Jeff Allen",
    note: "if applicable",
  },
  {
    role: "President of Construction",
    defaultName: "Brett Williams",
    note: "only if EPC TIC > $30M",
  },
  {
    role: "CDB Operations Executive",
    defaultName: "Matt Ralston or Chad Cotter",
    note: "only if EPC - opposite of the required seat",
  },
  {
    role: "Facility Security Director",
    defaultName: "RJ Hope",
    note: "only if EPC",
  },
];

// Required for every PWR Pre-Risk Review.
export const PRE_RISK_REQUIRED: AttendeeRule[] = [
  { role: "Business-Line Director" },
  { role: "Project Manager" },
  { role: "Engineering Manager" },
  { role: "Construction Manager", note: "if applicable" },
];

// Additional required attendees for EPC & DBB PWR Pre-Risk Reviews.
export const PRE_RISK_EPC_DBB_REQUIRED: AttendeeRule[] = [
  { role: "CDB Operations Manager" },
  { role: "Self-Perform PM", note: "if applicable" },
];

// Optional for all PWR Pre-Risk Reviews.
export const PRE_RISK_OPTIONAL: AttendeeRule[] = [
  { role: "Executive-in-Charge" },
  { role: "Biz Develop/Capture Manager" },
  { role: "Attorney" },
  { role: "Regional GP Manager", note: "if applicable" },
  { role: "Regional Risk Manager", note: "if applicable" },
  { role: "PWR Lead Risk Coordinator", defaultName: "Chris Hamker" },
  { role: "PWR Risk Admin", email: "PWR-RiskExecReviews@burnsmcd.com" },
  { role: "Other Attendees" },
];

// Business-line distribution mailboxes. Added to the optional recipients when
// the request's business line and delivery method match.
export const BUSINESS_LINE_DISTRIBUTIONS = {
  solarEpcDbb: "PWR-RiskSolarEPC@burnsmcd.com",
  bessEpcDbb: "PWR-RiskBESSEPC@burnsmcd.com",
  solarNonEpc: "PWR-RiskSolar@burnsmcd.com",
  bessNonEpc: "PWR-RiskBESS@burnsmcd.com",
} as const;

// Union of every role that can appear on a request, used for the attendee role
// dropdown. Derived from the matrix so it stays a single source of truth, with
// a couple of legacy roles appended.
const MATRIX_GROUPS: AttendeeRule[][] = [
  FORMAL_FINAL_REQUIRED,
  FORMAL_FINAL_EPC_REQUIRED,
  FORMAL_FINAL_DBB_REQUIRED,
  FORMAL_FINAL_OPTIONAL,
  FORMAL_FINAL_MAJOR_OPTIONAL,
  FORMAL_FINAL_EPC_DBB_OPTIONAL,
  PRE_RISK_REQUIRED,
  PRE_RISK_EPC_DBB_REQUIRED,
  PRE_RISK_OPTIONAL,
];

export const ATTENDEE_ROLES: string[] = (() => {
  const seen = new Set<string>();
  const roles: string[] = [];
  for (const group of MATRIX_GROUPS) {
    for (const rule of group) {
      if (!seen.has(rule.role)) {
        seen.add(rule.role);
        roles.push(rule.role);
      }
    }
  }
  for (const legacy of ["Contract Review Request RVW #"]) {
    if (!seen.has(legacy)) {
      seen.add(legacy);
      roles.push(legacy);
    }
  }
  return roles;
})();

// Mandatory roles (excluding "if applicable" conditionals) that computeWarnings
// flags as missing. Kept as a flat baseline for the two request types; the
// actual per-request set is assembled in rules.getRequiredRoles.
export const REQUIRED_ATTENDEE_ROLES = FORMAL_FINAL_REQUIRED.map((r) => r.role);

export const REQUEST_TYPES = [
  "Pre-Risk & Formal Risk Discussion",
  "Final Risk Review",
] as const;

export const RISK_IDENTIFICATION_STATUSES = [
  "Yes",
  "No",
  "Scheduled",
  "Other",
] as const;

export const DRAFT_STATUSES = [
  "Draft",
  "Reviewed",
  "Ready to Send",
  "Sent Manually",
  "Cancelled",
] as const;

export const TEMPLATE_TYPES = [
  "Pre-Risk / Risk Review Request",
  "Formal Risk Request",
  "Final Risk Review Request",
  "Slides / Risk Register Reminder",
  "Follow-Up Reminder",
  "Reschedule Notice",
] as const;

export const DEFAULT_TIMEZONE = "America/Chicago";
export const DEFAULT_MEETING_DURATION_MINUTES = 60;
export const DEFAULT_REMINDER_MINUTES = 15;

// --- Email / calendar routing defaults ---
// Shared mailbox used as the From address on generated email drafts and as the
// organizer on Pre-Risk calendar invites. Centralized so one change updates every
// draft and invite.
export const RISK_REVIEW_MAILBOX = "PWR-RiskExecReviews@burnsmcd.com";

// The risk review coordinator who must receive every generated draft. Stored as a
// configurable default (name + email) rather than hardcoded into logic; the packet
// requires the recipient's name to be visible on the email, and an admin must be
// able to change who this is without a code edit.
export const RISK_COORDINATOR_RECIPIENT: { name: string; email: string } = {
  name: "Megan",
  email: "",
};

// ---------------------------------------------------------------------------
// Usage tracking (value measurement)
// ---------------------------------------------------------------------------
// "First-Order Impact" = direct time saved. For each tracked action we record a
// UsageUnit count and multiply by a per-unit minutes-saved value to get the
// hours (and dollars) saved. These mirror the parameters expected by the
// external UsageTracking API (Program / Addin / Version / Usage / UsageUnit).

export const USAGE_PROGRAM = "PWR Risk Review Coordinator";
export const USAGE_VERSION = "1.0.0";

// Moderate burdened labor rate used to convert saved hours into dollars.
export const BURDENED_LABOR_RATE_USD = 85;

export interface UsageActionDef {
  addin: string;
  usage: string;
  minutesPerUnit: number;
  label: string;
  description: string;
}

// Catalog of tracked actions. This is the single source of truth for what the
// app measures and how much manual effort each automated action replaces.
// minutesPerUnit is the average time saved per UsageUnit; tune as governance
// data improves.
// `usage` values follow the BMcD governance naming pattern
// <Platform>_<System>_<Tool>_<Action> and must stay stable once the dashboard
// governance table references them. `label` is the friendly name shown in the UI.
export const USAGE_ACTIONS = {
  request_created: {
    addin: "Requests",
    usage: "Web_PWR_RiskCoordinator_CreateRequest",
    minutesPerUnit: 20,
    label: "Request intake",
    description:
      "Automated intake and classification of a new risk review request, versus manually collating the form and updating the tracker.",
  },
  email_drafts_generated: {
    addin: "Email",
    usage: "Web_PWR_RiskCoordinator_GenerateEmailDrafts",
    minutesPerUnit: 15,
    label: "Email drafts generated",
    description:
      "Auto-generated meeting and request emails from templates, versus writing each message by hand.",
  },
  meeting_scheduled: {
    addin: "Meetings",
    usage: "Web_PWR_RiskCoordinator_ScheduleMeeting",
    minutesPerUnit: 10,
    label: "Meetings scheduled",
    description:
      "Assembling meeting details and coordinating attendees, versus manual scheduling.",
  },
  tracker_imported: {
    addin: "Import",
    usage: "Batch_PWR_RiskCoordinator_ImportTrackerRow",
    minutesPerUnit: 5,
    label: "Tracker rows imported",
    description:
      "Bulk import of historical tracker rows, versus manual re-entry into the tool.",
  },
} as const satisfies Record<string, UsageActionDef>;

export type UsageActionKey = keyof typeof USAGE_ACTIONS;
