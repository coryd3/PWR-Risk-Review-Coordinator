CREATE TABLE "risk_review_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"requester_name" text,
	"requester_email" text,
	"client_name" text,
	"project_name" text,
	"crm_opportunity_number" text,
	"bmcd_contract_value_raw" text,
	"bmcd_contract_value_numeric" double precision,
	"total_installed_cost_raw" text,
	"total_installed_cost_numeric" double precision,
	"business_lines" text[] DEFAULT '{}' NOT NULL,
	"business_line_classification" text,
	"contract_review_rvw_number" text,
	"is_epc_prime" boolean DEFAULT false NOT NULL,
	"is_major_opportunity" boolean DEFAULT false NOT NULL,
	"request_type" text,
	"risk_identification_status" text,
	"pre_risk_target_date" date,
	"formal_risk_target_date" date,
	"proposal_due_date" date,
	"formal_risk_discussion_date" date,
	"final_risk_target_date" date,
	"pre_risk_lead" text,
	"formal_risk_lead" text,
	"status" text DEFAULT 'New' NOT NULL,
	"next_action" text,
	"owner" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "risk_triggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger_number" integer NOT NULL,
	"trigger_name" text NOT NULL,
	"trigger_description" text,
	"is_major_opportunity_trigger" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_risk_triggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"trigger_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"name" text,
	"email" text,
	"role" text NOT NULL,
	"attendee_type" text,
	"source" text,
	"is_required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"meeting_type" text NOT NULL,
	"target_date" date,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"timezone" text DEFAULT 'America/Chicago',
	"subject" text,
	"body" text,
	"teams_link" text,
	"outlook_event_id" text,
	"status" text DEFAULT 'Not Scheduled' NOT NULL,
	"risk_lead" text,
	"rescheduled_count" integer DEFAULT 0 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"template_type" text NOT NULL,
	"applies_to_major" boolean,
	"applies_to_business_line" text,
	"applies_to_request_type" text,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"meeting_id" integer,
	"template_id" integer,
	"template_type" text,
	"to_recipients" text DEFAULT '' NOT NULL,
	"cc_recipients" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"condition_json" text,
	"output_json" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"note_text" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"action" text NOT NULL,
	"actor" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_tracker_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_row" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "request_risk_triggers" ADD CONSTRAINT "request_risk_triggers_request_id_risk_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."risk_review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_risk_triggers" ADD CONSTRAINT "request_risk_triggers_trigger_id_risk_triggers_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."risk_triggers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_request_id_risk_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."risk_review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_request_id_risk_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."risk_review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_request_id_risk_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."risk_review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_request_id_risk_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."risk_review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_request_id_risk_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."risk_review_requests"("id") ON DELETE cascade ON UPDATE no action;