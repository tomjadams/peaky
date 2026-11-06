-- +goose Up

-- +goose StatementBegin
CREATE TABLE subjects (
  id         TEXT        NOT NULL PRIMARY KEY,
  type       TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT subjects_slug_unique UNIQUE (slug)
);
CREATE INDEX subjects_type_idx   ON subjects (type);
CREATE INDEX subjects_status_idx ON subjects (status);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE subject_component_links (
  id                TEXT        NOT NULL PRIMARY KEY,
  subject_id        TEXT        NOT NULL,
  component_id      TEXT        NOT NULL,
  relationship_type TEXT        NOT NULL DEFAULT 'contains',
  created_at        TIMESTAMPTZ NOT NULL,
  CONSTRAINT subject_component_links_unique UNIQUE (subject_id, component_id),
  CONSTRAINT fk_scl_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
);
CREATE INDEX subject_component_links_subject_idx ON subject_component_links (subject_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE templates (
  id           TEXT        NOT NULL PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'draft',
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ
);
CREATE INDEX templates_status_idx ON templates (status);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE template_versions (
  id                 TEXT        NOT NULL PRIMARY KEY,
  template_id        TEXT        NOT NULL,
  version_label      TEXT        NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'draft',
  created_at         TIMESTAMPTZ NOT NULL,
  published_at       TIMESTAMPTZ,
  CONSTRAINT fk_tv_template FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE
);
CREATE INDEX template_versions_template_idx ON template_versions (template_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE template_pillars (
  id                  TEXT        NOT NULL PRIMARY KEY,
  template_version_id TEXT        NOT NULL,
  slug                TEXT        NOT NULL,
  name                TEXT        NOT NULL,
  description         TEXT,
  order_key           TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_tp_version FOREIGN KEY (template_version_id) REFERENCES template_versions (id) ON DELETE CASCADE
);
CREATE INDEX template_pillars_template_version_idx ON template_pillars (template_version_id);
CREATE INDEX template_pillars_order_idx            ON template_pillars (order_key);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE template_questions (
  id                TEXT        NOT NULL PRIMARY KEY,
  pillar_id         TEXT        NOT NULL,
  order_key         TEXT        NOT NULL,
  text              TEXT        NOT NULL,
  type              TEXT        NOT NULL DEFAULT 'yes-no',
  risk_level        TEXT,
  importance        TEXT,
  checklist_items   JSONB,
  leading_practices JSONB,
  helpful_links     JSONB,
  created_at        TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_tq_pillar FOREIGN KEY (pillar_id) REFERENCES template_pillars (id) ON DELETE CASCADE
);
CREATE INDEX template_questions_pillar_idx ON template_questions (pillar_id);
CREATE INDEX template_questions_order_idx  ON template_questions (order_key);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE template_rules (
  id               TEXT        NOT NULL PRIMARY KEY,
  pillar_id        TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  conditions       JSONB       NOT NULL,
  condition_groups JSONB,
  action           JSONB       NOT NULL,
  position         JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_tr_pillar FOREIGN KEY (pillar_id) REFERENCES template_pillars (id) ON DELETE CASCADE
);
CREATE INDEX template_rules_pillar_idx ON template_rules (pillar_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE reviews (
  id         TEXT        NOT NULL PRIMARY KEY,
  subject_id TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_reviews_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
);
CREATE INDEX reviews_subject_idx ON reviews (subject_id);
CREATE INDEX reviews_status_idx  ON reviews (status);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE review_template_selections (
  id                  TEXT        NOT NULL PRIMARY KEY,
  review_id           TEXT        NOT NULL,
  template_version_id TEXT        NOT NULL,
  position            INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rts_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_template_selections_review_idx ON review_template_selections (review_id);
-- +goose StatementEnd

-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE review_note_state (
  id         TEXT        NOT NULL PRIMARY KEY,
  review_id  TEXT        NOT NULL,
  scope_type TEXT        NOT NULL,
  scope_id   TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rns_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_note_state_review_scope_idx ON review_note_state (review_id, scope_type, scope_id);
-- +goose StatementEnd

-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE review_score_state (
  id              TEXT        NOT NULL PRIMARY KEY,
  review_id       TEXT        NOT NULL,
  score_type      TEXT        NOT NULL,
  numeric_score   INTEGER,
  band            TEXT,
  score_breakdown JSONB,
  computed_at     TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rss_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_score_state_review_idx ON review_score_state (review_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE review_participants (
  id         TEXT        NOT NULL PRIMARY KEY,
  review_id  TEXT        NOT NULL,
  actor_id   TEXT        NOT NULL,
  role       TEXT        NOT NULL,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rp_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_participants_review_idx ON review_participants (review_id);
CREATE INDEX review_participants_actor_idx  ON review_participants (actor_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE events (
  id          TEXT        NOT NULL PRIMARY KEY,
  specversion TEXT        NOT NULL DEFAULT '1.0',
  dataschema  TEXT,
  review_id   TEXT,
  event_type  TEXT        NOT NULL,
  actor_type  TEXT        NOT NULL,
  actor_id    TEXT        NOT NULL,
  client_id   TEXT,
  data        JSONB,
  time        TIMESTAMPTZ NOT NULL,
  hlc         TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending',
  synced_at   TIMESTAMPTZ,
  source      TEXT        NOT NULL DEFAULT 'peaky.client',
  entity_type TEXT,
  entity_id   TEXT
);
CREATE INDEX events_review_idx      ON events (review_id);
CREATE INDEX events_time_idx        ON events (time);
CREATE INDEX events_status_idx      ON events (status);
CREATE INDEX events_entity_time_idx ON events (entity_type, time);
-- +goose StatementEnd

-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose StatementBegin
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
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE sync_cursors (
  actor_id     TEXT        NOT NULL PRIMARY KEY,
  cursor_value TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX sync_cursors_updated_at_idx ON sync_cursors (updated_at);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE field_versions (
  id          TEXT        NOT NULL PRIMARY KEY,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT        NOT NULL,
  field_name  TEXT        NOT NULL,
  value       JSONB,
  hlc         TEXT        NOT NULL,
  actor_id    TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT field_versions_entity_field_unique UNIQUE (entity_type, entity_id, field_name)
);
CREATE INDEX field_versions_entity_idx     ON field_versions (entity_type, entity_id);
CREATE INDEX field_versions_updated_at_idx ON field_versions (updated_at);
CREATE INDEX field_versions_actor_idx      ON field_versions (actor_id);
-- +goose StatementEnd

-- +goose Down

-- +goose StatementBegin
DROP TABLE IF EXISTS field_versions;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS sync_cursors;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS draft_answer_evidence;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS draft_answer_imports;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS events;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS review_participants;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS review_score_state;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS review_attachments;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS review_note_state;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS review_answer_state;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS review_template_selections;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS reviews;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS template_rules;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS template_questions;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS template_pillars;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS template_versions;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS templates;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS subject_component_links;
-- +goose StatementEnd
-- +goose StatementBegin
DROP TABLE IF EXISTS subjects;
-- +goose StatementEnd
