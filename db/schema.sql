--
-- PostgreSQL database dump
--

\restrict ZhTaRQaM2VoEgIPXtXHhUAxpnzvuxAdDn3BkhdZOeUbdiuOUP0YQpNmCb9RhxN2

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendees (
    id integer NOT NULL,
    request_id integer NOT NULL,
    name text,
    email text,
    role text NOT NULL,
    attendee_type text,
    source text,
    is_required boolean DEFAULT true NOT NULL
);


--
-- Name: attendees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendees_id_seq OWNED BY public.attendees.id;


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id integer NOT NULL,
    entity_type text NOT NULL,
    entity_id integer,
    action text NOT NULL,
    actor text,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_events_id_seq OWNED BY public.audit_events.id;


--
-- Name: email_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_drafts (
    id integer NOT NULL,
    request_id integer NOT NULL,
    meeting_id integer,
    template_id integer,
    template_type text,
    to_recipients text DEFAULT ''::text NOT NULL,
    cc_recipients text DEFAULT ''::text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'Draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone
);


--
-- Name: email_drafts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_drafts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_drafts_id_seq OWNED BY public.email_drafts.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id integer NOT NULL,
    template_name text NOT NULL,
    template_type text NOT NULL,
    applies_to_major boolean,
    applies_to_business_line text,
    applies_to_request_type text,
    subject_template text NOT NULL,
    body_template text NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: imported_tracker_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imported_tracker_rows (
    id integer NOT NULL,
    source_row text NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    processed boolean DEFAULT false NOT NULL,
    source_file text,
    row_number integer,
    row_hash text NOT NULL,
    request_id integer,
    status text DEFAULT 'pending'::text NOT NULL,
    error text
);


--
-- Name: imported_tracker_rows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.imported_tracker_rows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: imported_tracker_rows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.imported_tracker_rows_id_seq OWNED BY public.imported_tracker_rows.id;


--
-- Name: meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meetings (
    id integer NOT NULL,
    request_id integer NOT NULL,
    meeting_type text NOT NULL,
    target_date date,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    timezone text DEFAULT 'America/Chicago'::text,
    subject text,
    body text,
    teams_link text,
    outlook_event_id text,
    status text DEFAULT 'Not Scheduled'::text NOT NULL,
    risk_lead text,
    rescheduled_count integer DEFAULT 0 NOT NULL,
    notes text
);


--
-- Name: meetings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.meetings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: meetings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.meetings_id_seq OWNED BY public.meetings.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    request_id integer NOT NULL,
    note_text text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: request_risk_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_risk_triggers (
    id integer NOT NULL,
    request_id integer NOT NULL,
    trigger_id integer NOT NULL
);


--
-- Name: request_risk_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.request_risk_triggers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: request_risk_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.request_risk_triggers_id_seq OWNED BY public.request_risk_triggers.id;


--
-- Name: risk_review_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_review_requests (
    id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    requester_name text,
    requester_email text,
    client_name text,
    project_name text,
    crm_opportunity_number text,
    bmcd_contract_value_raw text,
    bmcd_contract_value_numeric double precision,
    total_installed_cost_raw text,
    total_installed_cost_numeric double precision,
    business_lines text[] DEFAULT '{}'::text[] NOT NULL,
    business_line_classification text,
    contract_review_rvw_number text,
    is_epc_prime boolean DEFAULT false NOT NULL,
    is_major_opportunity boolean DEFAULT false NOT NULL,
    request_type text,
    risk_identification_status text,
    pre_risk_target_date date,
    formal_risk_target_date date,
    proposal_due_date date,
    formal_risk_discussion_date date,
    final_risk_target_date date,
    pre_risk_lead text,
    formal_risk_lead text,
    status text DEFAULT 'New'::text NOT NULL,
    next_action text,
    owner text,
    notes text
);


--
-- Name: risk_review_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.risk_review_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: risk_review_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.risk_review_requests_id_seq OWNED BY public.risk_review_requests.id;


--
-- Name: risk_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_triggers (
    id integer NOT NULL,
    trigger_number integer NOT NULL,
    trigger_name text NOT NULL,
    trigger_description text,
    is_major_opportunity_trigger boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: risk_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.risk_triggers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: risk_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.risk_triggers_id_seq OWNED BY public.risk_triggers.id;


--
-- Name: rule_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rule_sets (
    id integer NOT NULL,
    name text NOT NULL,
    condition_json text,
    output_json text,
    priority integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: rule_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rule_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rule_sets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rule_sets_id_seq OWNED BY public.rule_sets.id;


--
-- Name: status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_history (
    id integer NOT NULL,
    request_id integer NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.status_history_id_seq OWNED BY public.status_history.id;


--
-- Name: usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_events (
    id integer NOT NULL,
    program text NOT NULL,
    addin text,
    version text,
    usage text NOT NULL,
    action text NOT NULL,
    username text,
    usage_unit integer DEFAULT 1 NOT NULL,
    minutes_per_unit integer DEFAULT 0 NOT NULL,
    minutes_saved integer DEFAULT 0 NOT NULL,
    entity_type text,
    entity_id integer,
    source text DEFAULT 'app'::text NOT NULL,
    forward_status text DEFAULT 'disabled'::text NOT NULL,
    forward_error text,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usage_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usage_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usage_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usage_events_id_seq OWNED BY public.usage_events.id;


--
-- Name: attendees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendees ALTER COLUMN id SET DEFAULT nextval('public.attendees_id_seq'::regclass);


--
-- Name: audit_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events ALTER COLUMN id SET DEFAULT nextval('public.audit_events_id_seq'::regclass);


--
-- Name: email_drafts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_drafts ALTER COLUMN id SET DEFAULT nextval('public.email_drafts_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: imported_tracker_rows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_tracker_rows ALTER COLUMN id SET DEFAULT nextval('public.imported_tracker_rows_id_seq'::regclass);


--
-- Name: meetings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings ALTER COLUMN id SET DEFAULT nextval('public.meetings_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: request_risk_triggers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_risk_triggers ALTER COLUMN id SET DEFAULT nextval('public.request_risk_triggers_id_seq'::regclass);


--
-- Name: risk_review_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_review_requests ALTER COLUMN id SET DEFAULT nextval('public.risk_review_requests_id_seq'::regclass);


--
-- Name: risk_triggers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_triggers ALTER COLUMN id SET DEFAULT nextval('public.risk_triggers_id_seq'::regclass);


--
-- Name: rule_sets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_sets ALTER COLUMN id SET DEFAULT nextval('public.rule_sets_id_seq'::regclass);


--
-- Name: status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history ALTER COLUMN id SET DEFAULT nextval('public.status_history_id_seq'::regclass);


--
-- Name: usage_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events ALTER COLUMN id SET DEFAULT nextval('public.usage_events_id_seq'::regclass);


--
-- Name: attendees attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: email_drafts email_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: imported_tracker_rows imported_tracker_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_tracker_rows
    ADD CONSTRAINT imported_tracker_rows_pkey PRIMARY KEY (id);


--
-- Name: imported_tracker_rows imported_tracker_rows_row_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_tracker_rows
    ADD CONSTRAINT imported_tracker_rows_row_hash_unique UNIQUE (row_hash);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: request_risk_triggers request_risk_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_risk_triggers
    ADD CONSTRAINT request_risk_triggers_pkey PRIMARY KEY (id);


--
-- Name: risk_review_requests risk_review_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_review_requests
    ADD CONSTRAINT risk_review_requests_pkey PRIMARY KEY (id);


--
-- Name: risk_triggers risk_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_triggers
    ADD CONSTRAINT risk_triggers_pkey PRIMARY KEY (id);


--
-- Name: rule_sets rule_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rule_sets
    ADD CONSTRAINT rule_sets_pkey PRIMARY KEY (id);


--
-- Name: status_history status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_pkey PRIMARY KEY (id);


--
-- Name: usage_events usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_events
    ADD CONSTRAINT usage_events_pkey PRIMARY KEY (id);


--
-- Name: attendees attendees_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendees
    ADD CONSTRAINT attendees_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE CASCADE;


--
-- Name: email_drafts email_drafts_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE CASCADE;


--
-- Name: imported_tracker_rows imported_tracker_rows_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_tracker_rows
    ADD CONSTRAINT imported_tracker_rows_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE SET NULL;


--
-- Name: meetings meetings_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meetings
    ADD CONSTRAINT meetings_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE CASCADE;


--
-- Name: notes notes_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE CASCADE;


--
-- Name: request_risk_triggers request_risk_triggers_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_risk_triggers
    ADD CONSTRAINT request_risk_triggers_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE CASCADE;


--
-- Name: request_risk_triggers request_risk_triggers_trigger_id_risk_triggers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_risk_triggers
    ADD CONSTRAINT request_risk_triggers_trigger_id_risk_triggers_id_fk FOREIGN KEY (trigger_id) REFERENCES public.risk_triggers(id) ON DELETE CASCADE;


--
-- Name: status_history status_history_request_id_risk_review_requests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_history
    ADD CONSTRAINT status_history_request_id_risk_review_requests_id_fk FOREIGN KEY (request_id) REFERENCES public.risk_review_requests(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ZhTaRQaM2VoEgIPXtXHhUAxpnzvuxAdDn3BkhdZOeUbdiuOUP0YQpNmCb9RhxN2

