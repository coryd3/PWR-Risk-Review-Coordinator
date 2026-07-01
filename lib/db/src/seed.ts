// Seed script for the PWR Risk Review Coordinator.
// Inserts the 20 master risk triggers, placeholder email templates, rule-set
// documentation rows, and a small set of fake sample requests.
// Run with: pnpm --filter @workspace/db run seed
//
// Uses only fake/sample data (no real company names, employees, emails, or
// opportunity numbers) per the spec.
import { db, pool } from "./index";
import {
  riskTriggersTable,
  emailTemplatesTable,
  ruleSetsTable,
  riskReviewRequestsTable,
  requestRiskTriggersTable,
  attendeesTable,
  meetingsTable,
} from "./schema";

const RISK_TRIGGERS: {
  triggerNumber: number;
  triggerName: string;
  isMajorOpportunityTrigger: boolean;
}[] = [
  { triggerNumber: 1, triggerName: "Client project delivery method is Design-Build or EPC", isMajorOpportunityTrigger: true },
  { triggerNumber: 2, triggerName: "Client project delivery method is Design-Bid-Build with TIC greater than $50M", isMajorOpportunityTrigger: true },
  { triggerNumber: 3, triggerName: "Project depends on new/untested technology", isMajorOpportunityTrigger: false },
  { triggerNumber: 4, triggerName: "Professional Services contract requires process or performance guarantee", isMajorOpportunityTrigger: false },
  { triggerNumber: 5, triggerName: "New business line or market", isMajorOpportunityTrigger: false },
  { triggerNumber: 6, triggerName: "Replacing existing contractor or consultant", isMajorOpportunityTrigger: false },
  { triggerNumber: 7, triggerName: "Scope includes work on residential property", isMajorOpportunityTrigger: false },
  { triggerNumber: 8, triggerName: "Scope includes review/inspection of third-party work", isMajorOpportunityTrigger: false },
  { triggerNumber: 9, triggerName: "Project includes speculative development", isMajorOpportunityTrigger: false },
  { triggerNumber: 10, triggerName: "Project performed through a Joint Venture or Consortium", isMajorOpportunityTrigger: false },
  { triggerNumber: 11, triggerName: "Project location outside the US 50 states", isMajorOpportunityTrigger: false },
  { triggerNumber: 12, triggerName: "Scope includes construction of third-party design", isMajorOpportunityTrigger: false },
  { triggerNumber: 13, triggerName: "Project located where BMEC is not licensed to work", isMajorOpportunityTrigger: false },
  { triggerNumber: 14, triggerName: "Requires new legal entity or business unit", isMajorOpportunityTrigger: false },
  { triggerNumber: 15, triggerName: "Creates conflict of interest with existing client", isMajorOpportunityTrigger: false },
  { triggerNumber: 16, triggerName: "Services performed with no Limitation of Liability", isMajorOpportunityTrigger: false },
  { triggerNumber: 17, triggerName: "Project purchasing materials or equipment under a Professional Services Agreement or Master Services Agreement", isMajorOpportunityTrigger: false },
  { triggerNumber: 18, triggerName: "Project involves digital consulting or services", isMajorOpportunityTrigger: false },
  { triggerNumber: 19, triggerName: "Project funding is Federal grant or tax credit", isMajorOpportunityTrigger: false },
  { triggerNumber: 20, triggerName: "Limited or specific AI Use", isMajorOpportunityTrigger: false },
];

const PRE_RISK_BODY = `A risk review is requested for the following opportunity.

Project Name: {{projectName}}
Client Name: {{clientName}}
CRM Opportunity Number: {{crmOpportunityNumber}}
Business Line: {{businessLine}}
BMcD Contract Value: {{bmcdContractValue}}
Total Installed Cost (TIC): {{totalInstalledCost}}

Risk Triggers:
{{riskTriggers}}

Required Attendees: {{requiredAttendees}}
Optional Attendees: {{optionalAttendees}}

Risk Identification Meeting status: {{riskIdentificationStatus}}
Pre-Risk Target Date: {{preRiskTargetDate}}
Formal Risk Target Date: {{formalRiskTargetDate}}
Proposal Due Date: {{proposalDueDate}}

Other Comments: {{otherComments}}`;

const FORMAL_RISK_BODY = `We would like to schedule the Formal Risk Discussion for the opportunity below. Please reply with your availability.

Project Name: {{projectName}}
Client Name: {{clientName}}
CRM Opportunity Number: {{crmOpportunityNumber}}

Risk Triggers:
{{riskTriggers}}

BMcD Contract Value: {{bmcdContractValue}}
TIC: {{totalInstalledCost}}

Required Meeting Attendees: {{requiredAttendees}}
Optional Meeting Attendees: {{optionalAttendees}}

Pre-Risk Date: {{preRiskTargetDate}}
Formal Risk Availability: [Please provide your availability]`;

const FINAL_RISK_BODY = `A Final Risk Review is requested for the opportunity below.

Formal Risk Discussion Date: {{formalRiskDiscussionDate}}
Pre-Risk Review Lead: {{preRiskLead}}
Formal Risk Discussion Risk Lead: {{formalRiskLead}}
Final Risk Review Target Date: {{finalRiskTargetDate}}

Project Name: {{projectName}}
Client Name: {{clientName}}
CRM Opportunity Number: {{crmOpportunityNumber}}
Business Line: {{businessLine}}

Required Attendees: {{requiredAttendees}}

Other Comments: {{otherComments}}`;

const SLIDES_BODY = `This is a reminder to submit your slides and the risk register before the upcoming risk review for {{projectName}} ({{crmOpportunityNumber}}).

Please submit at least 24 hours before the meeting.`;

const FOLLOWUP_BODY = `Following up on the risk review request for {{projectName}} ({{crmOpportunityNumber}}).

Please confirm the outstanding items so we can proceed with scheduling.`;

const RESCHEDULE_BODY = `The {{meetingType}} meeting for {{projectName}} needs to be rescheduled.

Original Date: [original date]
New Target Date: [new target date]
Notes: {{otherComments}}`;

const EMAIL_TEMPLATES = [
  {
    templateName: "Pre-Risk / Risk Review Request",
    templateType: "Pre-Risk / Risk Review Request",
    subjectTemplate: "Risk Review Request | {{clientName}} - {{projectName}} ({{crmOpportunityNumber}})",
    bodyTemplate: PRE_RISK_BODY,
  },
  {
    templateName: "Formal Risk Request",
    templateType: "Formal Risk Request",
    subjectTemplate: "Formal Risk Request | {{clientName}} - {{projectName}} ({{crmOpportunityNumber}})",
    bodyTemplate: FORMAL_RISK_BODY,
  },
  {
    templateName: "Final Risk Review Request",
    templateType: "Final Risk Review Request",
    subjectTemplate: "Final Risk Review Request | {{clientName}} - {{projectName}} ({{crmOpportunityNumber}})",
    bodyTemplate: FINAL_RISK_BODY,
  },
  {
    templateName: "Slides / Risk Register Reminder",
    templateType: "Slides / Risk Register Reminder",
    subjectTemplate: "Reminder: Slides and Risk Register Needed | {{projectName}}",
    bodyTemplate: SLIDES_BODY,
  },
  {
    templateName: "Follow-Up Reminder",
    templateType: "Follow-Up Reminder",
    subjectTemplate: "Follow-Up | {{projectName}} ({{crmOpportunityNumber}})",
    bodyTemplate: FOLLOWUP_BODY,
  },
  {
    templateName: "Reschedule Notice",
    templateType: "Reschedule Notice",
    subjectTemplate: "Reschedule Needed | {{projectName}} {{meetingType}}",
    bodyTemplate: RESCHEDULE_BODY,
  },
];

const RULE_SETS = [
  {
    name: "Major Opportunity Rule",
    conditionJson: JSON.stringify({ anyTriggerNumberIn: [1, 2] }),
    outputJson: JSON.stringify({ isMajorOpportunity: true }),
    priority: 1,
  },
  {
    name: "Business Line Classification",
    conditionJson: JSON.stringify({ basedOn: "businessLines" }),
    outputJson: JSON.stringify({
      rules: [
        "BESS + Solar if both BESS and Solar",
        "BESS if BESS and not Solar",
        "Solar if Solar and not BESS",
        "GHI if GHI and neither BESS nor Solar",
        "Otherwise Other",
      ],
    }),
    priority: 2,
  },
];

function classifyBusinessLine(businessLines: string[]): string {
  const has = (n: string) => businessLines.some((b) => b.toLowerCase() === n.toLowerCase());
  if (has("BESS") && has("Solar")) return "BESS + Solar";
  if (has("BESS")) return "BESS";
  if (has("Solar")) return "Solar";
  if (has("GHI")) return "GHI";
  return "Other";
}

async function main() {
  console.log("Clearing existing data...");
  await db.delete(requestRiskTriggersTable);
  await db.delete(attendeesTable);
  await db.delete(meetingsTable);
  await db.delete(riskReviewRequestsTable);
  await db.delete(riskTriggersTable);
  await db.delete(emailTemplatesTable);
  await db.delete(ruleSetsTable);

  console.log("Seeding risk triggers...");
  const triggers = await db
    .insert(riskTriggersTable)
    .values(RISK_TRIGGERS)
    .returning();
  const triggerByNumber = new Map(triggers.map((t) => [t.triggerNumber, t.id]));

  console.log("Seeding email templates...");
  await db.insert(emailTemplatesTable).values(EMAIL_TEMPLATES);

  console.log("Seeding rule sets...");
  await db.insert(ruleSetsTable).values(RULE_SETS);

  console.log("Seeding sample requests...");
  const samples: {
    request: typeof riskReviewRequestsTable.$inferInsert;
    triggerNumbers: number[];
    attendees: Omit<typeof attendeesTable.$inferInsert, "requestId">[];
    meetings: Omit<typeof meetingsTable.$inferInsert, "requestId">[];
  }[] = [
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Alpha",
        crmOpportunityNumber: "OPP-000001",
        bmcdContractValueRaw: "$45,000,000",
        bmcdContractValueNumeric: 45000000,
        totalInstalledCostRaw: "$120,000,000",
        totalInstalledCostNumeric: 120000000,
        businessLines: ["BESS"],
        contractReviewRvwNumber: "RVW-1001",
        isEpcPrime: true,
        requestType: "Pre-Risk & Formal Risk Discussion",
        riskIdentificationStatus: "Yes",
        preRiskTargetDate: "2026-07-15",
        formalRiskTargetDate: "2026-07-29",
        proposalDueDate: "2026-08-15",
        preRiskLead: "Placeholder Risk Lead",
        status: "Ready to Schedule Pre-Risk",
        nextAction: "Schedule pre-risk",
        owner: "Coordinator",
      },
      triggerNumbers: [1, 5],
      attendees: [
        { role: "Business-Line Director", name: "Placeholder Director", isRequired: true, source: "seed" },
        { role: "Project Manager", name: "Placeholder PM", isRequired: true, source: "seed" },
        { role: "Attorney", name: "Placeholder Attorney", isRequired: true, source: "seed" },
      ],
      meetings: [
        { meetingType: "Pre-Risk", targetDate: "2026-07-15", status: "Needs Scheduling", riskLead: "Placeholder Risk Lead" },
      ],
    },
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Beta",
        crmOpportunityNumber: "OPP-000002",
        bmcdContractValueRaw: "$30,000,000",
        bmcdContractValueNumeric: 30000000,
        totalInstalledCostRaw: "$60,000,000",
        totalInstalledCostNumeric: 60000000,
        businessLines: ["Solar"],
        contractReviewRvwNumber: "RVW-1002",
        isEpcPrime: false,
        requestType: "Pre-Risk & Formal Risk Discussion",
        riskIdentificationStatus: "Scheduled",
        preRiskTargetDate: "2026-07-20",
        formalRiskTargetDate: "2026-08-05",
        preRiskLead: "Placeholder Risk Lead",
        status: "Pre-Risk Scheduled",
        nextAction: "Await slides/risk register",
        owner: "Coordinator",
      },
      triggerNumbers: [2],
      attendees: [
        { role: "Attorney", name: "Placeholder Attorney", isRequired: true, source: "seed" },
        { role: "Other Attendees", name: "Placeholder Stakeholder", isRequired: false, source: "seed" },
      ],
      meetings: [
        { meetingType: "Pre-Risk", targetDate: "2026-07-20", status: "Scheduled", riskLead: "Placeholder Risk Lead", scheduledStart: new Date("2026-07-20T15:00:00Z") },
      ],
    },
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Gamma",
        crmOpportunityNumber: "OPP-000003",
        bmcdContractValueRaw: "$80,000,000",
        bmcdContractValueNumeric: 80000000,
        totalInstalledCostRaw: "$200,000,000",
        totalInstalledCostNumeric: 200000000,
        businessLines: ["BESS", "Solar"],
        contractReviewRvwNumber: "RVW-1003",
        isEpcPrime: true,
        requestType: "Pre-Risk & Formal Risk Discussion",
        riskIdentificationStatus: "Yes",
        preRiskTargetDate: "2026-08-01",
        formalRiskTargetDate: "2026-08-20",
        preRiskLead: "Placeholder Risk Lead",
        formalRiskLead: "Placeholder Risk Lead",
        status: "Formal Risk Scheduled",
        nextAction: "Send formal risk invite manually",
        owner: "Coordinator",
      },
      triggerNumbers: [1, 2, 10],
      attendees: [
        { role: "Business-Line Director", name: "Placeholder Director", isRequired: true, source: "seed" },
        { role: "Project Manager", name: "Placeholder PM", isRequired: true, source: "seed" },
        { role: "Attorney", name: "Placeholder Attorney", isRequired: true, source: "seed" },
      ],
      meetings: [
        { meetingType: "Formal Risk", targetDate: "2026-08-20", status: "Scheduled", riskLead: "Placeholder Risk Lead", scheduledStart: new Date("2026-08-20T16:00:00Z") },
      ],
    },
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Delta",
        crmOpportunityNumber: "OPP-000004",
        bmcdContractValueRaw: "$25,000,000",
        bmcdContractValueNumeric: 25000000,
        businessLines: ["GHI"],
        contractReviewRvwNumber: "RVW-1004",
        isEpcPrime: false,
        requestType: "Pre-Risk & Formal Risk Discussion",
        riskIdentificationStatus: "Yes",
        preRiskTargetDate: "2026-07-25",
        formalRiskTargetDate: "2026-08-10",
        preRiskLead: "Placeholder Risk Lead",
        status: "New",
        nextAction: "Review request",
        owner: "Coordinator",
      },
      triggerNumbers: [1],
      attendees: [
        { role: "Attorney", name: "Placeholder Attorney", isRequired: true, source: "seed" },
      ],
      meetings: [],
    },
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Epsilon",
        crmOpportunityNumber: "OPP-000005",
        bmcdContractValueRaw: "$5,000,000",
        bmcdContractValueNumeric: 5000000,
        businessLines: ["Mining"],
        contractReviewRvwNumber: "RVW-1005",
        isEpcPrime: false,
        requestType: "Pre-Risk & Formal Risk Discussion",
        riskIdentificationStatus: "Yes",
        preRiskTargetDate: "2026-09-01",
        formalRiskTargetDate: "2026-09-15",
        preRiskLead: "Placeholder Risk Lead",
        status: "Needs Review",
        nextAction: "Confirm attendees",
        owner: "Coordinator",
      },
      triggerNumbers: [6],
      attendees: [
        { role: "Attorney", name: "Placeholder Attorney", isRequired: true, source: "seed" },
      ],
      meetings: [],
    },
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Zeta",
        crmOpportunityNumber: "OPP-000006",
        bmcdContractValueRaw: "$55,000,000",
        bmcdContractValueNumeric: 55000000,
        totalInstalledCostRaw: "$130,000,000",
        totalInstalledCostNumeric: 130000000,
        businessLines: ["Solar"],
        contractReviewRvwNumber: "RVW-1006",
        isEpcPrime: true,
        requestType: "Final Risk Review",
        riskIdentificationStatus: "Yes",
        formalRiskDiscussionDate: "2026-06-01",
        finalRiskTargetDate: "2026-07-10",
        preRiskLead: "Placeholder Risk Lead",
        formalRiskLead: "Placeholder Risk Lead",
        status: "Ready for Final Risk",
        nextAction: "Schedule final risk",
        owner: "Coordinator",
      },
      triggerNumbers: [1],
      attendees: [
        { role: "Business-Line Director", name: "Placeholder Director", isRequired: true, source: "seed" },
        { role: "Project Manager", name: "Placeholder PM", isRequired: true, source: "seed" },
        { role: "Attorney", name: "Placeholder Attorney", isRequired: true, source: "seed" },
      ],
      meetings: [
        { meetingType: "Final Risk", targetDate: "2026-07-10", status: "Needs Scheduling", riskLead: "Placeholder Risk Lead" },
      ],
    },
    {
      request: {
        requesterName: "Sample Requester",
        requesterEmail: "requester@example.com",
        clientName: "Example Client",
        projectName: "Project Eta",
        crmOpportunityNumber: "OPP-000007",
        bmcdContractValueRaw: "$40,000,000",
        bmcdContractValueNumeric: 40000000,
        businessLines: ["NES"],
        isEpcPrime: true,
        requestType: "Pre-Risk & Formal Risk Discussion",
        riskIdentificationStatus: "No",
        preRiskTargetDate: "2026-08-05",
        formalRiskTargetDate: "2026-08-25",
        status: "Missing Info",
        nextAction: "Confirm legal information",
        owner: "Coordinator",
      },
      triggerNumbers: [1, 16],
      attendees: [
        { role: "Project Manager", name: "Placeholder PM", isRequired: true, source: "seed" },
      ],
      meetings: [],
    },
  ];

  for (const sample of samples) {
    const isMajorOpportunity = sample.triggerNumbers.some((n) => n === 1 || n === 2);
    const businessLineClassification = classifyBusinessLine(
      sample.request.businessLines as string[],
    );
    const inserted = await db
      .insert(riskReviewRequestsTable)
      .values({ ...sample.request, isMajorOpportunity, businessLineClassification })
      .returning();
    const requestId = inserted[0].id;

    const triggerLinks = sample.triggerNumbers
      .map((n) => triggerByNumber.get(n))
      .filter((id): id is number => id != null)
      .map((triggerId) => ({ requestId, triggerId }));
    if (triggerLinks.length > 0) {
      await db.insert(requestRiskTriggersTable).values(triggerLinks);
    }

    if (sample.attendees.length > 0) {
      await db
        .insert(attendeesTable)
        .values(sample.attendees.map((a) => ({ ...a, requestId })));
    }

    if (sample.meetings.length > 0) {
      await db
        .insert(meetingsTable)
        .values(sample.meetings.map((m) => ({ ...m, requestId })));
    }
  }

  console.log(`Seed complete: ${samples.length} sample requests created.`);
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
