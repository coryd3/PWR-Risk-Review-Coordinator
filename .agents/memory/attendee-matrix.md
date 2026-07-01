---
name: Attendee matrix
description: How required/optional attendees are computed per request from the validated packet.
---

The attendee set is NOT a flat list. It is a matrix driven by four axes: meeting
stage (Pre-Risk vs Formal/Final), delivery method (EPC vs DBB), Major-opportunity
status, and business line (Solar/BESS add distribution mailboxes).

- A request type covering BOTH stages (Pre-Risk and Formal Risk Discussion) needs
  the UNION of both required sets, not one or the other.
- A conditional-seat marker (a rule "note" such as "if applicable") means the seat
  is surfaced but is NOT flagged missing by warnings. Only unconditional/mandatory
  roles are treated as required.
- Named individuals who fill a seat are stored as configurable defaults on each
  rule, never hardcoded into logic or templates.
  **Why:** the packet explicitly forbids hardcoding names; an admin must be able to
  change who fills a seat without a code edit.
  **How to apply:** when adding a seat, add a role + optional configurable default,
  and expose the defaults via /config so the form can pre-seed rows.
- EPC-only optional seats (e.g. President of Construction gated on EPC & a TIC
  threshold; Facility Security Director; the alternate CDB Operations Executive)
  must be gated by the EPC flag even inside an "EPC or DBB" optional block, or DBB
  requests wrongly show them.
  **Why:** a prior bug leaked EPC-only optional seats onto DBB requests.
- tracker-import deliberately keeps its OWN separate role lists and Major logic;
  do not assume the app matrix and the importer share a source of truth.
