// Centralized configuration enums and static rules.
// These are intentionally kept out of React components so they remain the
// single source of truth for the backend rule/template/calendar services.
// TODO: A future iteration can move these into the rule_sets table so they are
// editable from the Admin screen without a code change.

export const REQUEST_STATUSES = [
  "New",
  "Needs Review",
  "Missing Info",
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
  "Decarbonization",
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
  "Complete",
  "Rescheduled",
  "Cancelled",
  "On Hold",
] as const;

export const EPC_PRIME_ROLES = [
  "Business-Line Director",
  "Business Line CDB Operations Manager",
  "Project Manager",
  "Engineering Manager",
  "Construction Manager",
  "Self-Perform PM",
  "Biz Develop/Capture Manager",
  "Executive-in-Charge",
  "Contract Review Request RVW #",
  "Attorney",
  "Regional GP Manager",
  "Regional Risk Manager",
  "Other Attendees",
] as const;

// Standard (non-EPC-prime) attendee roles. The spec does not enumerate a
// separate reduced list, so this is a sensible default subset.
// TODO: make configurable via the static attendee rules in Admin.
export const STANDARD_ROLES = [
  "Business-Line Director",
  "Project Manager",
  "Biz Develop/Capture Manager",
  "Attorney",
  "Regional Risk Manager",
  "Other Attendees",
] as const;

export const ATTENDEE_ROLES = EPC_PRIME_ROLES;

// Roles that must exist on every request and be populated with a name. These
// are enforced in the request form (pre-seeded, non-removable, name required)
// and flagged by computeWarnings when missing.
export const REQUIRED_ATTENDEE_ROLES = [
  "Business-Line Director",
  "Project Manager",
  "Engineering Manager",
  "Biz Develop/Capture Manager",
  "Executive-in-Charge",
  "Attorney",
] as const;

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
