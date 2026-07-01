---
name: Subject-first identity binding for pre-added users
description: How OIDC sign-in must resolve/claim accounts so pre-added invites cannot be hijacked
---

Rule: When resolving a user at OIDC sign-in (the upsert on the auth callback / mobile token exchange), match by the verified OIDC **subject** first, not by email.

Ordered resolution:
1. Row with `id === sub` exists -> returning user. Refresh profile + stamp login, keep role. Only overwrite email if the new email is not already owned by a different row (otherwise keep the stored value) to avoid the unique-constraint 500.
2. Else an email row exists **and** `lastLoginAt IS NULL` (an unclaimed admin invite) -> claim it by setting `id = sub`, keep the pre-assigned role.
3. Else an email row exists but has already signed in (`lastLoginAt` not null) -> a distinct-subject / email-reuse collision. Do NOT inherit it. Create a fresh default-role account for this subject with `email = null`; log a warning.
4. Else brand-new: first-ever user => admin, everyone else => default (requester).

**Why:** Email-first matching lets a different signed-in subject inherit a pre-added elevated account just by presenting the same email (privilege escalation). Email is not a safe identity key — it can be unverified on non-Replit OIDC providers (portability requirement) and corporate addresses get reassigned to new people over time. Subject-first binding + claiming only unclaimed invites (`lastLoginAt` null) closes the hijack path without locking legitimate users out.

**How to apply:** Any change to the sign-in upsert must preserve this order and the "claim only when lastLoginAt IS NULL" invariant. Never auto-merge two distinct subjects onto one row. Pre-added invite rows have no FK children, so reassigning their PK `id` to the subject on claim is safe.
