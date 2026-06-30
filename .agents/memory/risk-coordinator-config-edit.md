---
name: Risk Coordinator config edit flow
description: How admin-editable config is wired through OpenAPI + orval codegen
---

The risk-coordinator frontend consumes only generated hooks from
`@workspace/api-client-react` (orval, react-query). The api-server validates with
generated zod bodies from `@workspace/api-zod`. Both are generated from
`lib/api-spec/openapi.yaml`.

**Rule:** To add a new endpoint (e.g. Admin edit), edit `openapi.yaml` (path + component
schema), run `pnpm --filter @workspace/api-spec run codegen`, THEN implement the
backend handler (importing the generated `*Body` zod) and the frontend (importing the
generated `use*` hook + `getList*QueryKey` for invalidation). Skipping codegen leaves
the hook/zod missing.

**Why:** Admin was read-only because the config router was GET-only and no update
hooks existed; adding view+edit required the full openapi → codegen → handler → UI chain.

**How to apply:** Config edit endpoints are `PUT /risk-triggers|/email-templates|/rule-sets/:id`.
