---
name: TS project references need rebuild
description: Why api-server typecheck fails with "no exported member" from @workspace/db after schema edits
---
This monorepo uses TypeScript project references with composite + emitDeclarationOnly libs.
Consuming packages (e.g. artifacts/api-server) resolve workspace deps through the lib's
emitted `dist/*.d.ts`, NOT its `src`. So after you add/edit files in `lib/db/src/schema`
or `lib/api-zod/src`, the consumer keeps seeing the OLD declarations until you rebuild.

**Rule:** after changing a referenced composite lib, rebuild its declarations before trusting
a consumer typecheck: `npx tsc --build lib/db lib/api-zod` (or `pnpm -r run build`).

**Why:** the lib `tsconfig.json` sets `composite:true` + `emitDeclarationOnly:true` with
`outDir: dist`. The dist `.d.ts` is the type surface other packages import.

**How to apply:** any time a schema/zod edit is followed by a TS2305 "has no exported member"
in api-server, rebuild the referenced lib(s) first — it is almost never a real code error.
