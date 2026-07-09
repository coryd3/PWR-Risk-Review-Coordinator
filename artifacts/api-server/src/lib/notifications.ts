// New-request email notifications. Sending is dormant until an admin enables
// email settings and provides Microsoft Graph service-principal credentials in
// the Admin console, so the app works without any email configuration.
import { eq } from "drizzle-orm";
import {
  db,
  emailSettingsTable,
  notificationSubscribersTable,
  type EmailSettingsRow,
  type RiskReviewRequestRow,
} from "@workspace/db";
import {
  sendGraphEmail,
  type GraphCredentials,
} from "../integrations/graph/graphEmailService";
import { recordAuditDirect } from "./audit";

export async function getEmailSettingsRow(): Promise<EmailSettingsRow | null> {
  const rows = await db.select().from(emailSettingsTable).limit(1);
  return rows[0] ?? null;
}

export function toCredentials(
  row: EmailSettingsRow | null,
): GraphCredentials | null {
  if (!row || !row.enabled) return null;
  const { tenantId, clientId, clientSecret, senderAddress } = row;
  if (!tenantId || !clientId || !clientSecret || !senderAddress) return null;
  return { tenantId, clientId, clientSecret, senderAddress };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildNewRequestEmail(request: RiskReviewRequestRow): {
  subject: string;
  bodyHtml: string;
} {
  const project = request.projectName ?? "Unnamed project";
  const rows: [string, string | null][] = [
    ["Project", request.projectName],
    ["Client", request.clientName],
    ["Requester", request.requesterName],
    ["Requester Email", request.requesterEmail],
    ["Request Type", request.requestType],
    ["Delivery Method", request.deliveryMethod],
    ["Region", request.region],
    ["CRM Opportunity #", request.crmOpportunityNumber],
    ["BMcD Contract Value", request.bmcdContractValueRaw],
    ["Status", request.status],
  ];
  const table = rows
    .filter(([, v]) => v != null && v.trim() !== "")
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555;">${escapeHtml(label)}</td><td style="padding:4px 0;">${escapeHtml(value as string)}</td></tr>`,
    )
    .join("");
  const baseUrl = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  const link = baseUrl
    ? `<p><a href="${baseUrl}/requests/${request.id}">Open request #${request.id}</a></p>`
    : `<p>Request ID: ${request.id}</p>`;
  return {
    subject: `New Risk Review Request: ${project}`,
    bodyHtml: `<p>A new risk review request has been submitted.</p><table>${table}</table>${link}<p>This notification was sent automatically by the PWR Risk Review Coordinator.</p>`,
  };
}

// Fire-and-forget notification for a newly created request. Never throws: any
// failure is logged and audited so request creation is never blocked by email.
export async function notifyNewRequest(
  request: RiskReviewRequestRow,
): Promise<void> {
  try {
    const settings = await getEmailSettingsRow();
    const creds = toCredentials(settings);
    if (!creds) return;

    const subscribers = await db
      .select()
      .from(notificationSubscribersTable)
      .where(eq(notificationSubscribersTable.active, true));
    const to = [...new Set(subscribers.map((s) => s.email.trim()).filter(Boolean))];
    if (to.length === 0) return;

    const { subject, bodyHtml } = buildNewRequestEmail(request);
    await sendGraphEmail(creds, { to, subject, bodyHtml });
    await recordAuditDirect({
      entityType: "request",
      entityId: request.id,
      action: "notification_sent",
      detail: { recipients: to.length },
    });
  } catch (err) {
    console.error(
      `[notifications] Failed to send new-request notification for request ${request.id}:`,
      err,
    );
    await recordAuditDirect({
      entityType: "request",
      entityId: request.id,
      action: "notification_failed",
      detail: { error: err instanceof Error ? err.message : String(err) },
    }).catch(() => undefined);
  }
}
