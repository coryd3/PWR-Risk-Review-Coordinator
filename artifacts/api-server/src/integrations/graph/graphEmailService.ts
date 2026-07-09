// Microsoft Graph email sender using the OAuth2 client-credentials flow
// (service principal). Deliberately implemented with plain fetch so it has no
// Replit-specific or SDK dependencies and runs identically on any host.

export interface GraphCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  senderAddress: string;
}

export interface OutgoingEmail {
  to: string[];
  subject: string;
  bodyHtml: string;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function getGraphAccessToken(
  creds: GraphCredentials,
): Promise<string> {
  const url = `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Graph token request failed (${res.status}): ${json.error_description ?? json.error ?? "unknown error"}`,
    );
  }
  return json.access_token;
}

// Sends a single email as the configured sender via Graph sendMail. Throws on
// failure so callers can decide how to surface the error.
export async function sendGraphEmail(
  creds: GraphCredentials,
  email: OutgoingEmail,
): Promise<void> {
  if (email.to.length === 0) return;
  const token = await getGraphAccessToken(creds);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(creds.senderAddress)}/sendMail`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: email.subject,
        body: { contentType: "HTML", content: email.bodyHtml },
        toRecipients: email.to.map((address) => ({
          emailAddress: { address },
        })),
      },
      saveToSentItems: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${text}`);
  }
}
