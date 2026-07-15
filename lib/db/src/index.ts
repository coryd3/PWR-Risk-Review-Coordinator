import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool;

if (process.env.DATABASE_URL) {
  // Local dev / Replit: use full connection string
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else if (process.env.PGHOST) {
  // Databricks Lakebase: pg reads PGHOST, PGPORT, PGDATABASE, PGUSER natively
  pool = new Pool({ ssl: { rejectUnauthorized: false } });
} else {
  throw new Error(
    "DATABASE_URL or PGHOST must be set. Did you forget to provision a database?",
  );
}

export { pool };
export const db = drizzle(pool, { schema });

export * from "./schema";
