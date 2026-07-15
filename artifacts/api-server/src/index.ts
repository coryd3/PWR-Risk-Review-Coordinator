import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire);

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        role VARCHAR NOT NULL DEFAULT 'requester',
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS risk_review_requests (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        requester_name TEXT,
        requester_email TEXT,
        client_name TEXT,
        project_name TEXT,
        crm_opportunity_number TEXT,
        bmcd_contract_value_raw TEXT,
        bmcd_contract_value_numeric DOUBLE PRECISION,
        total_installed_cost_raw TEXT,
        total_installed_cost_numeric DOUBLE PRECISION,
        business_lines TEXT[] NOT NULL DEFAULT '{}',
        business_line_classification TEXT,
        contract_review_rvw_number TEXT,
        delivery_method TEXT,
        region TEXT,
        legal_missing_explanation TEXT,
        is_epc_prime BOOLEAN NOT NULL DEFAULT FALSE,
        is_major_opportunity BOOLEAN NOT NULL DEFAULT FALSE,
        request_type TEXT,
        risk_identification_status TEXT,
        risk_identification_date DATE,
        risk_identification_explanation TEXT,
        pre_risk_target_date DATE,
        formal_risk_target_date DATE,
        proposal_due_date DATE,
        formal_risk_discussion_date DATE,
        final_risk_target_date DATE,
        pre_risk_lead TEXT,
        formal_risk_lead TEXT,
        status TEXT NOT NULL DEFAULT 'New',
        next_action TEXT,
        owner TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS risk_triggers (
        id SERIAL PRIMARY KEY,
        trigger_number INTEGER NOT NULL,
        trigger_name TEXT NOT NULL,
        trigger_description TEXT,
        is_major_opportunity_trigger BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS request_risk_triggers (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES risk_review_requests(id) ON DELETE CASCADE,
        trigger_id INTEGER NOT NULL REFERENCES risk_triggers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attendees (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES risk_review_requests(id) ON DELETE CASCADE,
        name TEXT,
        email TEXT,
        role TEXT NOT NULL,
        attendee_type TEXT,
        source TEXT,
        is_required BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES risk_review_requests(id) ON DELETE CASCADE,
        meeting_type TEXT NOT NULL,
        target_date DATE,
        scheduled_start TIMESTAMPTZ,
        scheduled_end TIMESTAMPTZ,
        timezone TEXT DEFAULT 'America/Chicago',
        subject TEXT,
        body TEXT,
        teams_link TEXT,
        outlook_event_id TEXT,
        status TEXT NOT NULL DEFAULT 'Not Scheduled',
        risk_lead TEXT,
        rescheduled_count INTEGER NOT NULL DEFAULT 0,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS email_templates (
        id SERIAL PRIMARY KEY,
        template_name TEXT NOT NULL,
        template_type TEXT NOT NULL,
        applies_to_major BOOLEAN,
        applies_to_business_line TEXT,
        applies_to_request_type TEXT,
        subject_template TEXT NOT NULL,
        body_template TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS email_drafts (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES risk_review_requests(id) ON DELETE CASCADE,
        meeting_id INTEGER,
        template_id INTEGER,
        template_type TEXT,
        to_recipients TEXT NOT NULL DEFAULT '',
        cc_recipients TEXT NOT NULL DEFAULT '',
        from_recipients TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS rule_sets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        condition_json TEXT,
        output_json TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS status_history (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES risk_review_requests(id) ON DELETE CASCADE,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        changed_by TEXT,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES risk_review_requests(id) ON DELETE CASCADE,
        note_text TEXT NOT NULL,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        action TEXT NOT NULL,
        actor TEXT,
        detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS imported_tracker_rows (
        id SERIAL PRIMARY KEY,
        source_file TEXT,
        row_number INTEGER,
        row_hash TEXT NOT NULL UNIQUE,
        source_row TEXT NOT NULL,
        request_id INTEGER REFERENCES risk_review_requests(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error TEXT,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS usage_events (
        id SERIAL PRIMARY KEY,
        program TEXT NOT NULL,
        addin TEXT,
        version TEXT,
        usage TEXT NOT NULL,
        action TEXT NOT NULL,
        username TEXT,
        usage_unit INTEGER NOT NULL DEFAULT 1,
        minutes_per_unit INTEGER NOT NULL DEFAULT 0,
        minutes_saved INTEGER NOT NULL DEFAULT 0,
        entity_type TEXT,
        entity_id INTEGER,
        source TEXT NOT NULL DEFAULT 'app',
        forward_status TEXT NOT NULL DEFAULT 'disabled',
        forward_error TEXT,
        detail TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        tenant_id TEXT,
        client_id TEXT,
        client_secret TEXT,
        sender_address TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notification_subscribers (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Database migrations completed successfully");
  } catch (err) {
    logger.error({ err }, "Database migration failed (non-fatal, tables may already exist)");
  } finally {
    client.release();
  }
}

// Portability: prefer Databricks App port, then the platform PORT, then a local default.
const port = Number(
  process.env["DATABRICKS_APP_PORT"] || process.env["PORT"] || 3000,
);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid port value resolved: "${port}"`);
}

// Run migrations then start the server.
runMigrations().then(() => {
  app.listen(port, "0.0.0.0", (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
