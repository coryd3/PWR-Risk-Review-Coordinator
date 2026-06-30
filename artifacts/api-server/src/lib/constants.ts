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
