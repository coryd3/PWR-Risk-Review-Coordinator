---
name: Replit Auth login inside embedded preview iframe
description: Why OIDC sign-in fails ("invalid auth request") in the workspace preview/canvas iframe and how login() handles it.
---

# OIDC login cannot complete inside an embedded iframe

Clicking "Sign in" inside the Replit workspace preview pane or canvas iframe
surfaces "invalid auth request" from the Replit OIDC provider, even though the
server-side flow is correct (a `curl` of `/api/login` through the dev domain
returns a 303 to the `/oidc/login` interaction page, not an error).

**Why:** the OIDC provider sets `_oidc_interaction` cookies as `SameSite=None`
(third-party) and serves the login page with `frame-ancestors 'self'
https://*.replit.dev`. Browsers block third-party cookies and cross-origin
framing inside the embedded preview, so the interaction can't be established.

**How to apply:** `useAuth().login()` in `lib/replit-auth-web` detects framing
(`window.self !== window.top`) and opens `/api/login` in a top-level tab
(`window.open(url, "_blank", "noopener")`) instead of navigating the iframe.
When debugging auth, test in a standalone browser tab, not the preview iframe.
A working `curl` to `/api/login` proves the server config is fine; a browser
"invalid auth request" then points at the iframe context, not the code.
