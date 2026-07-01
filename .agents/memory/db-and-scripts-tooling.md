---
name: db-and-scripts-tooling
description: Non-obvious gotchas for changing the Drizzle schema and writing standalone scripts in this monorepo.
---

# Schema changes
- Apply schema changes with `pnpm --filter @workspace/db run push` (drizzle-kit push) and then regenerate the portable snapshot with `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > db/schema.sql`.
- The dev DB can silently drift from the Drizzle schema (e.g. `imported_tracker_rows` existed with only 4 of its 10 columns), surfacing as runtime "Failed query: select ... $1" errors from the API, not a startup error. If a table's query fails, diff `information_schema.columns` against the schema file and run `pnpm run db:migrate` (push) to reconcile.
- `pnpm --filter @workspace/db run generate` is BROKEN: `drizzle.config.ts` sets `out` to an absolute path via `path.join(__dirname, ...)`, and drizzle-kit prepends `./` to the stored snapshot path, producing `.//home/...` (ENOENT). Don't rely on generate for incremental migrations.
- **Why:** runtime uses `push` (see root `db:migrate`), not the `db/migrations/*.sql` files, so a broken generate doesn't block the app — but you must hand-update `db/schema.sql` to keep the portable snapshot truthful.

# Standalone scripts in scripts/ package
- A script under `scripts/` that imports `@workspace/db` and drizzle operators (`eq`, etc.) needs BOTH as direct deps of `scripts/package.json` for ESM resolution: add `@workspace/db@workspace:*` and `drizzle-orm@catalog:`. Without the drizzle-orm direct dep, tsx throws ERR_MODULE_NOT_FOUND for `drizzle-orm`.
- Run scripts via `pnpm --filter @workspace/scripts exec tsx ./<file>.ts ...` (root-level `pnpm tsx` does NOT resolve).
- `installLanguagePackages` adds to the workspace ROOT and fails with ERR_PNPM_ADDING_TO_ROOT; install into a specific package with `pnpm --filter <pkg> add <dep>` instead.

# xlsx (SheetJS) in ESM
- The ESM build does NOT export `readFile`. Use `XLSX.read(fs.readFileSync(path), { cellDates: true })`, not `XLSX.readFile(path)`.
- `XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })` returns native types (Date for dates with `cellDates`, numbers, strings) which is convenient for normalization.
- The ESM build ALSO does not expose `XLSX.SSF`, so any Excel numeric-serial date fallback (`XLSX.SSF?.parse_date_code`) silently no-ops (returns null). Rely on `cellDates: true` giving Date objects instead; do not depend on serial parsing.
- `sheet_to_json` drops fully-blank trailing rows entirely, so a CSV's empty last line never reaches row-level code — test blank-row handling at the unit level, not via a fixture.
- xlsx must be a direct dep of the package and actually installed; a stale lockfile can leave it declared-but-missing (`ERR_MODULE_NOT_FOUND: xlsx`) until `pnpm --filter <pkg> install`.

# Running unit tests in the scripts package
- Tests use Node's built-in runner via tsx: `node --import tsx --test "lib/**/*.test.ts"`. Plain `node --test` can't resolve `@workspace/*`/`xlsx`; the tsx loader is required.
- Keep pure parsing/decision logic DB-free (inject db lookups) so it can be unit-tested with in-memory fakes and no DATABASE_URL. Only `import type` from `@workspace/db` in those modules — a value import triggers the Pool + DATABASE_URL check at load.
