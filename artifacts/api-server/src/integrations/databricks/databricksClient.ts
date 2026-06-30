// Databricks integration — STUB (Not implemented in MVP) / "Future Integration".
//
// Placeholder for a future Databricks App deployment. The app already runs as a
// single portable Node process (see docs/databricks-deployment-notes.md); this
// module is where Databricks-specific runtime helpers (workspace identity,
// secret scopes, SQL warehouse access, Unity Catalog lookups, etc.) would live.
//
// Nothing here performs real calls in the MVP.

export interface DatabricksRuntimeInfo {
  isDatabricks: boolean;
  appPort: number | null;
}

// Read-only helper: detect whether we are running inside a Databricks App.
// Safe to call in any environment (does not throw, makes no external calls).
export function getDatabricksRuntimeInfo(): DatabricksRuntimeInfo {
  const rawPort = process.env["DATABRICKS_APP_PORT"];
  return {
    isDatabricks: Boolean(rawPort),
    appPort: rawPort ? Number(rawPort) : null,
  };
}

// Any real Databricks-backed operation is intentionally unimplemented in the MVP.
export function getDatabricksSecret(_scope: string, _key: string): never {
  throw new Error(
    "Databricks integration is not implemented in the MVP (Future Integration).",
  );
}
