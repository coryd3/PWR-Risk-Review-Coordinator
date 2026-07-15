import { defineConfig } from "drizzle-kit";
import path from "path";

// Support both DATABASE_URL (local dev) and PG* env vars (Databricks Lakebase)
const dbCredentials = process.env.DATABASE_URL
  ? { url: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST!,
      port: parseInt(process.env.PGPORT || "5432"),
      user: process.env.PGUSER!,
      password: process.env.PGPASSWORD || "",
      database: process.env.PGDATABASE!,
      ssl: true,
    };

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error("DATABASE_URL or PGHOST must be set.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "../../db/migrations"),
  dialect: "postgresql",
  dbCredentials,
});
