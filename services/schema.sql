-- Peaky server schema — PostgreSQL 17
-- Single source of truth: codegen script reads this to emit shared/db/schema/*.ts
-- Goose migrations must produce an identical result when applied to an empty DB.
--
-- Rules:
--   Mapped types for codegen: TEXT, INTEGER, TIMESTAMPTZ, JSONB, BOOLEAN
--   TEXT  → Drizzle text()     (covers VARCHAR/TEXT/TIMESTAMPTZ/JSONB — SQLite stores as text)
--   INTEGER → Drizzle integer() (covers INT/BOOLEAN)
--   No views, stored procedures, or triggers — server-only objects live in migrations only
--   field_versions is sync-eligible (pulled to client for change feed)
--
-- LISTEN/NOTIFY:
--   PostgreSQL LISTEN/NOTIFY is the pub-sub primitive for the future SSE/WS fan-out service.
--   Triggers on events and field_versions will NOTIFY 'sync_changes' so the WS service can
--   push diffs to connected clients without polling. Triggers live in migrations (not here).

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------

CREATE TABLE subjects (
  id         TEXT        NOT NULL PRIMARY KEY,
  type       TEXT        NOT NULL,  -- 'team' | 'product' | 'organization'
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'archived'
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT subjects_slug_unique UNIQUE (slug)
);
CREATE INDEX subjects_type_idx   ON subjects (type);
CREATE INDEX subjects_status_idx ON subjects (status);

CREATE TABLE subject_component_links (
  id                TEXT        NOT NULL PRIMARY KEY,
  subject_id        TEXT        NOT NULL,
  component_id      TEXT        NOT NULL,
  relationship_type TEXT        NOT NULL DEFAULT 'contains',
  created_at        TIMESTAMPTZ NOT NULL,
  CONSTRAINT subject_component_links_unique    UNIQUE (subject_id, component_id),
  CONSTRAINT fk_scl_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
);
CREATE INDEX subject_component_links_subject_idx ON subject_component_links (subject_id);

-- ---------------------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------------------

CREATE TABLE templates (
  id                  TEXT        NOT NULL PRIMARY KEY,
  name                TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'active',  -- 'active' | 'archived'
  owner_team_id       TEXT        NOT NULL,
  created_by_actor_id TEXT        NOT NULL,
  updated_by_actor_id TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT templates_status_check CHECK (status IN ('active', 'archived'))
);
CREATE INDEX templates_status_idx ON templates (status);

CREATE TABLE template_revisions (
  id                    TEXT        NOT NULL PRIMARY KEY,
  template_id           TEXT        NOT NULL,
  name                  TEXT        NOT NULL,
  description           TEXT        NOT NULL,
  status                TEXT        NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'retired'
  revision_number       INTEGER,
  revision_summary      TEXT,
  created_by_actor_id   TEXT        NOT NULL,
  updated_by_actor_id   TEXT        NOT NULL,
  published_by_actor_id TEXT,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL,
  published_at          TIMESTAMPTZ,
  -- One schema-versioned maturity definition document per Revision
  -- (maturity-score/REQ-009); NULL is the explicit no-definition state (AC-060).
  maturity_definition   JSONB,
  CONSTRAINT template_revisions_status_check CHECK (status IN ('draft', 'published', 'retired')),
  CONSTRAINT template_revisions_publication_check CHECK (
    (status = 'draft' AND revision_number IS NULL AND published_at IS NULL AND published_by_actor_id IS NULL)
    OR
    (status IN ('published', 'retired') AND revision_number IS NOT NULL AND revision_number > 0 AND published_at IS NOT NULL AND published_by_actor_id IS NOT NULL)
  ),
  CONSTRAINT template_revisions_summary_check CHECK (
    revision_summary IS NULL OR char_length(btrim(revision_summary)) BETWEEN 1 AND 120
  ),
  CONSTRAINT fk_tr_template FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
);
CREATE INDEX template_revisions_template_idx ON template_revisions (template_id);
CREATE UNIQUE INDEX template_revisions_one_draft_idx
  ON template_revisions (template_id) WHERE status = 'draft';
CREATE UNIQUE INDEX template_revisions_one_published_idx
  ON template_revisions (template_id) WHERE status = 'published';
CREATE UNIQUE INDEX template_revisions_number_unique_idx
  ON template_revisions (template_id, revision_number) WHERE revision_number IS NOT NULL;

CREATE TABLE template_pillars (
  id                   TEXT        NOT NULL PRIMARY KEY,
  template_revision_id TEXT        NOT NULL,
  slug                 TEXT        NOT NULL,
  name                 TEXT        NOT NULL,
  description          TEXT,
  order_key            TEXT        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL,
  CONSTRAINT template_pillars_revision_slug_unique UNIQUE (template_revision_id, slug),
  CONSTRAINT fk_tp_revision FOREIGN KEY (template_revision_id) REFERENCES template_revisions (id) ON DELETE CASCADE
);
CREATE INDEX template_pillars_template_revision_idx ON template_pillars (template_revision_id);
CREATE INDEX template_pillars_order_idx             ON template_pillars (template_revision_id, order_key);

CREATE TABLE template_questions (
  id                TEXT        NOT NULL PRIMARY KEY,
  pillar_id         TEXT        NOT NULL,
  order_key         TEXT        NOT NULL,
  text              TEXT        NOT NULL,
  type              TEXT        NOT NULL DEFAULT 'yes-no',  -- 'yes-no' | 'checklist'
  risk_level        TEXT,                                    -- 'critical' | 'high' | 'medium'
  importance        TEXT,
  checklist_items   JSONB,
  leading_practices JSONB,
  helpful_links     JSONB,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  CONSTRAINT template_questions_type_check CHECK (type IN ('yes-no', 'checklist')),
  CONSTRAINT template_questions_risk_level_check CHECK (risk_level IS NULL OR risk_level IN ('critical', 'high', 'medium')),
  CONSTRAINT fk_tq_pillar FOREIGN KEY (pillar_id) REFERENCES template_pillars (id) ON DELETE CASCADE
);
CREATE INDEX template_questions_pillar_idx ON template_questions (pillar_id);
CREATE INDEX template_questions_order_idx  ON template_questions (pillar_id, order_key);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

CREATE TABLE reviews (
  id         TEXT        NOT NULL PRIMARY KEY,
  subject_id TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'draft',  -- 'draft' | 'in-progress' | 'completed' | 'archived'
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_reviews_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
);
CREATE INDEX reviews_subject_idx ON reviews (subject_id);
CREATE INDEX reviews_status_idx  ON reviews (status);

CREATE TABLE review_template_selections (
  review_id            TEXT        NOT NULL,
  template_revision_id TEXT        NOT NULL,
  position             INTEGER     NOT NULL,  -- 0 | 1 | 2
  created_at           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (review_id, template_revision_id),
  CONSTRAINT review_template_selections_review_position_unique UNIQUE (review_id, position),
  CONSTRAINT review_template_selections_position_check CHECK (position BETWEEN 0 AND 2),
  CONSTRAINT fk_rts_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_rts_revision FOREIGN KEY (template_revision_id) REFERENCES template_revisions (id) ON DELETE RESTRICT
);

CREATE TABLE review_answer_state (
  id              TEXT        NOT NULL PRIMARY KEY,
  review_id       TEXT        NOT NULL,
  question_id     TEXT        NOT NULL,
  answer          JSONB,
  na_reason       JSONB,
  item_na_reasons JSONB,
  updated_at      TIMESTAMPTZ NOT NULL,
  CONSTRAINT review_answer_state_review_question_unique UNIQUE (review_id, question_id),
  CONSTRAINT fk_ras_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_answer_state_review_question_idx ON review_answer_state (review_id, question_id);

CREATE TABLE review_note_state (
  id         TEXT        NOT NULL PRIMARY KEY,
  review_id  TEXT        NOT NULL,
  scope_type TEXT        NOT NULL,  -- 'review' | 'pillar' | 'question'
  scope_id   TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rns_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_note_state_review_scope_idx ON review_note_state (review_id, scope_type, scope_id);

CREATE TABLE review_attachments (
  id              TEXT        NOT NULL PRIMARY KEY,
  review_id       TEXT        NOT NULL,
  scope_type      TEXT        NOT NULL,
  scope_id        TEXT        NOT NULL,
  filename        TEXT        NOT NULL,
  object_key      TEXT        NOT NULL,
  mime_type       TEXT,
  size            INTEGER,
  created_by      TEXT        NOT NULL DEFAULT '',
  created_by_name TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_ra_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_attachments_review_idx ON review_attachments (review_id);

CREATE TABLE review_score_state (
  id              TEXT        NOT NULL PRIMARY KEY,
  review_id       TEXT        NOT NULL,
  score_type      TEXT        NOT NULL,  -- 'readiness' | 'maturity'
  numeric_score   INTEGER,
  band            TEXT,
  score_breakdown JSONB,
  computed_at     TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rss_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_score_state_review_idx ON review_score_state (review_id);

CREATE TABLE review_participants (
  id         TEXT        NOT NULL PRIMARY KEY,
  review_id  TEXT        NOT NULL,
  actor_id   TEXT        NOT NULL,
  role       TEXT        NOT NULL,  -- 'assessor' | 'reviewer'
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rp_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_participants_review_idx ON review_participants (review_id);
CREATE INDEX review_participants_actor_idx  ON review_participants (actor_id);

-- Append-only Advisor maturity override stream, keyed by Review and
-- template_revision_id (maturity-score/REQ-016). Rows are never updated or
-- deleted; the effective override is resolved on read as the latest
-- non-revoked transition (AC-031), never stored as a mutable pointer.
CREATE TABLE review_maturity_overrides (
  id                   TEXT        NOT NULL PRIMARY KEY,
  review_id            TEXT        NOT NULL,
  template_revision_id TEXT        NOT NULL,  -- opaque identity, exact match only
  action               TEXT        NOT NULL,  -- 'create' | 'supersede' | 'revoke'
  reviewed_percent     INTEGER,               -- reviewed value; NULL on revoke
  reviewed_stage       INTEGER,               -- reviewed value; NULL on revoke
  explanation          TEXT,
  evidence             JSONB,                 -- array of evidence identifiers
  prior_transition_id  TEXT,
  actor_id             TEXT        NOT NULL,
  occurred_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rmo_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_rmo_prior FOREIGN KEY (prior_transition_id) REFERENCES review_maturity_overrides (id),
  CONSTRAINT review_maturity_overrides_action_check CHECK (action IN ('create', 'supersede', 'revoke')),
  CONSTRAINT review_maturity_overrides_value_check CHECK (
    (action = 'revoke' AND reviewed_percent IS NULL AND reviewed_stage IS NULL)
    OR
    (action IN ('create', 'supersede')
      AND reviewed_percent IS NOT NULL AND reviewed_percent BETWEEN 0 AND 100
      AND reviewed_stage IS NOT NULL AND reviewed_stage BETWEEN 1 AND 5)
  )
);
CREATE INDEX review_maturity_overrides_review_revision_idx ON review_maturity_overrides (review_id, template_revision_id);
CREATE INDEX review_maturity_overrides_prior_idx           ON review_maturity_overrides (prior_transition_id);

-- One row per selected handoff practice (implement-maturity-score design
-- Decision 3; improvement-plans/REQ-005, REQ-006). Entity IDs are
-- deterministic from the (review, revision, question, practice) tuple so
-- concurrent clients converge on one synchronized row. Order key, rationale,
-- and selection state move by ordinary field-level HLC writes.
CREATE TABLE review_handoff_practices (
  id                   TEXT        NOT NULL PRIMARY KEY,
  review_id            TEXT        NOT NULL,
  template_revision_id TEXT        NOT NULL,  -- opaque identity, exact match only
  question_id          TEXT        NOT NULL,
  practice_id          TEXT        NOT NULL,  -- checklist item ID; = question_id for Yes/No (AC-016)
  order_key            TEXT        NOT NULL,
  snapshot             JSONB       NOT NULL,  -- immutable practice context captured at selection
  rationale            TEXT,
  selection_state      TEXT        NOT NULL,  -- 'selected' | 'removed'
  actor_id             TEXT        NOT NULL,
  occurred_at          TIMESTAMPTZ NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rhp_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT review_handoff_practices_identity_unique
    UNIQUE (review_id, template_revision_id, question_id, practice_id),
  CONSTRAINT review_handoff_practices_selection_state_check
    CHECK (selection_state IN ('selected', 'removed'))
);
CREATE INDEX review_handoff_practices_review_idx ON review_handoff_practices (review_id);

-- Append-only handoff association stream, one row per transition per
-- practice (improvement-plans/REQ-007, REQ-008). Rows are never updated or
-- deleted; the current association is resolved on read as the latest
-- non-revoked transition (AC-032), never stored as a mutable pointer.
-- practice_entity_id carries the deterministic practice row ID without a
-- foreign key so sync can apply a transition before its practice row arrives.
CREATE TABLE review_handoff_associations (
  id                  TEXT        NOT NULL PRIMARY KEY,
  review_id           TEXT        NOT NULL,
  practice_entity_id  TEXT        NOT NULL,
  action              TEXT        NOT NULL,  -- 'associate' | 'replace' | 'revoke'
  provider            TEXT,                   -- external reference; NULL on revoke
  external_id         TEXT,                   -- external reference; NULL on revoke
  url                 TEXT,                   -- external reference; NULL on revoke
  prior_transition_id TEXT,
  actor_id            TEXT        NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rha_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_rha_prior FOREIGN KEY (prior_transition_id) REFERENCES review_handoff_associations (id),
  CONSTRAINT review_handoff_associations_action_check
    CHECK (action IN ('associate', 'replace', 'revoke')),
  CONSTRAINT review_handoff_associations_reference_check CHECK (
    (action = 'revoke' AND provider IS NULL AND external_id IS NULL AND url IS NULL)
    OR
    (action IN ('associate', 'replace')
      AND provider IS NOT NULL AND external_id IS NOT NULL AND url IS NOT NULL)
  )
);
CREATE INDEX review_handoff_associations_practice_idx ON review_handoff_associations (practice_entity_id);
CREATE INDEX review_handoff_associations_review_idx   ON review_handoff_associations (review_id);
CREATE INDEX review_handoff_associations_prior_idx    ON review_handoff_associations (prior_transition_id);

-- ---------------------------------------------------------------------------
-- events  (append-only audit log — CloudEvents v1.0.2 envelope)
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id          TEXT        NOT NULL PRIMARY KEY,
  specversion TEXT        NOT NULL DEFAULT '1.0',
  dataschema  TEXT,
  review_id   TEXT,                   -- nullable: events survive review deletion
  event_type  TEXT        NOT NULL,
  actor_type  TEXT        NOT NULL,   -- 'user' | 'integration' | 'system'
  actor_id    TEXT        NOT NULL,
  client_id   TEXT,
  data        JSONB,
  time        TIMESTAMPTZ NOT NULL,
  hlc         TEXT,                   -- HLC for causal ordering: 'wallclock:counter'
  status      TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'synced' | 'failed' | 'local'
  synced_at   TIMESTAMPTZ,
  source      TEXT        NOT NULL DEFAULT 'peaky.client',  -- 'peaky.client' | 'peaky.sync' | 'peaky.system'
  entity_type TEXT,
  entity_id   TEXT,
  operation   TEXT        NOT NULL DEFAULT 'upsert',  -- 'upsert' | 'delete'
  root_type   TEXT        NOT NULL,    -- resolved root entity type (review, product, template_draft, ...)
  root_id     TEXT        NOT NULL     -- resolved root entity id (self for roots; prefix for children)
);
CREATE INDEX events_review_idx        ON events (review_id);
CREATE INDEX events_time_idx          ON events (time);
CREATE INDEX events_status_idx        ON events (status);
CREATE INDEX events_entity_time_idx   ON events (entity_type, time);
CREATE INDEX events_entity_id_idx     ON events (entity_id);
CREATE INDEX events_root_idx          ON events (root_type, root_id, time);

-- draft_answer_imports: provenance tracking for machine-generated answers
CREATE TABLE draft_answer_imports (
  id          TEXT        NOT NULL PRIMARY KEY,
  review_id   TEXT        NOT NULL,
  source      TEXT        NOT NULL,
  run_id      TEXT,
  imported_at TIMESTAMPTZ NOT NULL,
  actor_id    TEXT        NOT NULL,
  CONSTRAINT fk_dai_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX draft_answer_imports_review_idx ON draft_answer_imports (review_id);
CREATE INDEX draft_answer_imports_source_idx ON draft_answer_imports (source);

CREATE TABLE draft_answer_evidence (
  id          TEXT NOT NULL PRIMARY KEY,
  import_id   TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer      TEXT,
  confidence  TEXT,
  evidence    TEXT,
  CONSTRAINT fk_dae_import FOREIGN KEY (import_id) REFERENCES draft_answer_imports (id) ON DELETE CASCADE
);
CREATE INDEX draft_answer_evidence_import_idx   ON draft_answer_evidence (import_id);
CREATE INDEX draft_answer_evidence_question_idx ON draft_answer_evidence (question_id);

-- ---------------------------------------------------------------------------
-- sync_cursors  (server-side cursor tracking per actor)
-- ---------------------------------------------------------------------------

CREATE TABLE sync_cursors (
  actor_id     TEXT        NOT NULL PRIMARY KEY,
  cursor_value TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX sync_cursors_updated_at_idx ON sync_cursors (updated_at);

-- ---------------------------------------------------------------------------
-- field_versions  (sync-eligible: pulled to client for change feed)
-- Per-field HLC stamps enabling field-level conflict resolution.
-- actor_id stored separately so hlc can be just 'wallclock:counter' (~18 bytes).
-- ---------------------------------------------------------------------------

CREATE TABLE field_versions (
  id          TEXT        NOT NULL PRIMARY KEY,
  entity_type TEXT        NOT NULL,  -- 'review_answer' | 'review_note' | 'review' | etc.
  entity_id   TEXT        NOT NULL,
  field_name  TEXT        NOT NULL,
  value       JSONB,
  hlc         TEXT        NOT NULL,  -- 'wallclock:counter' — actor stored separately
  actor_id    TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT field_versions_entity_field_unique UNIQUE (entity_type, entity_id, field_name)
);
CREATE INDEX field_versions_entity_idx    ON field_versions (entity_type, entity_id);
CREATE INDEX field_versions_updated_at_idx ON field_versions (updated_at);
CREATE INDEX field_versions_actor_idx     ON field_versions (actor_id);

-- ---------------------------------------------------------------------------
-- field_version_events  (append-only history for per-event pull payloads)
-- ---------------------------------------------------------------------------

CREATE TABLE field_version_events (
  id          TEXT        NOT NULL PRIMARY KEY,
  event_id    TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT        NOT NULL,
  field_name  TEXT        NOT NULL,
  value       JSONB,
  previous_value JSONB,
  hlc         TEXT        NOT NULL,  -- wire HLC: 'wallclock:counter:actorId'
  actor_id    TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT field_version_events_event_field_unique UNIQUE (event_id, field_name),
  CONSTRAINT fk_field_version_events_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX field_version_events_entity_idx     ON field_version_events (entity_type, entity_id);
CREATE INDEX field_version_events_updated_at_idx ON field_version_events (updated_at);
CREATE INDEX field_version_events_actor_idx      ON field_version_events (actor_id);
