---
name: Vite build requires PORT and BASE_PATH
description: Why the root build script injects placeholder PORT/BASE_PATH and excludes mockup-sandbox
---

# Vite scaffold hard-requires PORT and BASE_PATH at config load

The Replit artifact vite scaffolds (e.g. `artifacts/risk-coordinator/vite.config.ts`, `artifacts/mockup-sandbox/vite.config.ts`) throw at the **top level** of the config module if `process.env.PORT` (and BASE_PATH where used) is missing. This fires during `vite build`, not just `vite dev`, even though the port only matters for serving.

**Why:** running `pnpm run build` from a plain shell (no per-artifact PORT injected by the workflow system) crashes with "PORT environment variable is required".

**How to apply:**
- The root `build` script injects `BASE_PATH=/ PORT=3000` as placeholders so the build succeeds anywhere. The PORT value is irrelevant to build output.
- The root `build` script is scoped to the deployable product (`@workspace/risk-coordinator` + `@workspace/api-server`). `mockup-sandbox` is a Replit-canvas dev tool, not part of the shippable product, so it is intentionally excluded — building it would also demand PORT and produces nothing useful for deployment.

# Drizzle seed and tsc --build

`tsx` (used by `db:seed`) transpiles without typechecking, so a seed can run fine yet still break `pnpm run build` (which runs `tsc --build` via `typecheck:libs`). When seed sample arrays inject `requestId` at insert time, type them as `Omit<typeof table.$inferInsert, "requestId">[]` so the literals typecheck.
