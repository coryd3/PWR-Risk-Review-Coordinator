// Outlook email service STUB. Draft/preview-only in the MVP.
// Real email draft creation / sending is a FUTURE integration.

export interface EmailDraftInput {
  toRecipients: string;
  ccRecipients: string;
  subject: string;
  body: string;
}

// TODO (future integration): create a real Outlook draft via Microsoft Graph.
export async function createEmailDraft(
  _input: EmailDraftInput,
): Promise<never> {
  throw new Error("createEmailDraft: Not implemented in MVP.");
}

// TODO (future integration): send mail via Microsoft Graph. The MVP never sends.
export async function sendEmail(): Promise<never> {
  throw new Error("sendEmail: Not implemented in MVP.");
}
