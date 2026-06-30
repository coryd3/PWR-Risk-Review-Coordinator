// Outlook / Microsoft Graph client STUB.
// The MVP does NOT make real Microsoft Graph calls. This module exists so the
// rest of the app can be wired against a stable interface today and swapped for
// a real implementation later.
//
// TODO (future integration): construct an authenticated Microsoft Graph client
// using OAuth2 client credentials / delegated auth. Read credentials from env:
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
// Do NOT hardcode secrets.

export interface OutlookClientConfig {
  enabled: boolean;
}

export function getOutlookConfig(): OutlookClientConfig {
  return {
    enabled: process.env.ENABLE_OUTLOOK_INTEGRATION === "true",
  };
}

export function getOutlookClient(): never {
  // TODO (future integration): return an initialized Graph client.
  throw new Error(
    "Outlook/Microsoft Graph integration is not implemented in the MVP.",
  );
}
