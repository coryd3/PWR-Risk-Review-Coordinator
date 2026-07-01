---
name: RBAC session role freshness
description: Why the authenticated role is re-read from the DB on every request instead of trusting the session copy.
---

# Role is resolved from DB per request, not from the session

`authMiddleware` embeds a user snapshot in the session, but the role is
re-fetched from `usersTable` on every authenticated request and overrides the
session copy.

**Why:** sessions live up to 7 days. If an admin demotes a user, a role pinned
to the session would let the demoted user keep privileges until logout/expiry —
so "admin changes role" would not be enforced in practice. Re-reading makes role
changes take effect on the next request.

**How to apply:** never trust `session.user.role` for authorization. If the user
row is gone, treat the request as unauthenticated (clear session). The lookup is
a PK read — cheap. The same principle applies to any future per-request
privilege check.

# First-user-becomes-admin must be atomic

The "first user to sign in = admin" bootstrap does count(*) then insert. This is
wrapped in a transaction guarded by `pg_advisory_xact_lock(918273645)` so
concurrent first sign-ins cannot each read count 0 and all become admin.

**How to apply:** any "first/only one wins" bootstrap over a table needs a
lock (advisory or row), not a bare read-then-write.
