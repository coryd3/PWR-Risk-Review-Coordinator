---
name: db-and-scripts-tooling
description: Non-obvious gotchas for changing the Drizzle schema and writing standalone scripts in this monorepo.
---

# Schema changes
- Apply schema changes with `pnpm --filter @workspace/db run push` (drizzle-kit push) and then regenerate the portable snapshot with `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > db/schema.sql`.
- `pnpm --filter @workspace/db run generate` is BROKEN: `drizzle.config.ts` sets `out` to an absolute path via `path.join(__dirname, ...)`, and drizzle-kit prepends `./` to the stored snapshot path, producing `.//home/...` (ENOENT). Don't rely on generate for incremental migrations.
- **Why:** runtime uses `push` (see root `db:migrate`), not the `db/migrations/*.sql` files, so a broken generate doesn't block the app — but you must hand-update `db/schema.sql` to keep the portable snapshot truthful.

# Standalone scripts in scripts/ package
- A script under `scripts/` that imports `@workspace/db` and drizzle operators (`eq`, etc.) needs BOTH as direct deps of `scripts/package.json` for ESM resolution: add `@workspace/db@workspace:*` and `drizzle-orm@catalog:`. Without the drizzle-orm direct dep, tsx throws ERR_MODULE_NOT_FOUND for `drizzle-orm`.
- Run scripts via `pnpm --filter @workspace/scripts exec tsx ./<file>.ts ...` (root-level `pnpm tsx` does NOT resolve).
- `installLanguagePackages` adds to the workspace ROOT and fails with ERR_PNPM_ADDING_TO_ROOT; install into a specific package with `pnpm --filter <pkg> add <dep>` instead.

# xlsx (SheetJS) in ESM
- The ESM build does NOT export `readFile`. Use `XLSX.read(fs.readFileSync(path), { cellDates: true })`, not `XLSX.readFile(path)`.
- `XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })` returns native types (Date for dates with `cellDates`, numbers, strings) which is convenient for normalization.
