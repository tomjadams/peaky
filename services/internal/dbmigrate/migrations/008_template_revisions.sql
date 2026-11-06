-- +goose Up

DELETE FROM field_version_events
WHERE entity_type IN (
  'review',
  'review_checkpoint',
  'review_answer',
  'review_note',
  'review_attachment',
  'template',
  'template_version',
  'template_pillar',
  'template_question',
  'template_draft',
  'template_draft_pillar',
  'template_draft_question'
);

DELETE FROM field_versions
WHERE entity_type IN (
  'review',
  'review_checkpoint',
  'review_answer',
  'review_note',
  'review_attachment',
  'template',
  'template_version',
  'template_pillar',
  'template_question',
  'template_draft',
  'template_draft_pillar',
  'template_draft_question'
);

DELETE FROM events
WHERE review_id IS NOT NULL
   OR entity_type IN (
     'review',
     'review_checkpoint',
     'review_answer',
     'review_note',
     'review_attachment',
     'template',
     'template_version',
     'template_pillar',
     'template_question',
     'template_draft',
     'template_draft_pillar',
     'template_draft_question'
   )
   OR event_type IN (
     'ReviewAnswerRecorded.v1',
     'ReviewCheckpointSaved.v1',
     'ReviewNoteRecorded.v1',
     'ReviewNoteDeleted.v1',
     'ReviewAttachmentUploaded.v1',
     'ReviewAttachmentDeleted.v1',
     'ReviewProgressUpdated.v1',
     'ReviewCreated.v1',
     'ReviewArchived.v1',
     'ReviewRestored.v1',
     'ReviewDeleted.v1',
     'TemplateDraftCreated.v1',
     'TemplateDraftUpdated.v1',
     'TemplateDraftDeleted.v1',
     'TemplatePublished.v1',
     'TemplateImported.v1',
     'TemplatePillarCreated.v1',
     'TemplatePillarUpdated.v1',
     'TemplatePillarDeleted.v1',
     'TemplateQuestionCreated.v1',
     'TemplateQuestionUpdated.v1',
     'TemplateQuestionDeleted.v1'
   );

DELETE FROM draft_answer_evidence;
DELETE FROM draft_answer_imports;
DELETE FROM review_participants;
DELETE FROM review_score_state;
DELETE FROM review_attachments;
DELETE FROM review_note_state;
DELETE FROM review_answer_state;
DELETE FROM review_template_selections;
DELETE FROM reviews;

DELETE FROM template_questions;
DELETE FROM template_pillars;
DELETE FROM template_versions;
DELETE FROM templates;

DROP TABLE review_template_selections;
DROP TABLE template_questions;
DROP TABLE template_pillars;
DROP TABLE template_versions;
DROP TABLE templates;

CREATE TABLE templates (
  id                  TEXT        NOT NULL PRIMARY KEY,
  name                TEXT        NOT NULL,
  description         TEXT        NOT NULL,
  status              TEXT        NOT NULL DEFAULT 'active',
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
  status                TEXT        NOT NULL DEFAULT 'draft',
  revision_number       INTEGER,
  revision_summary      TEXT,
  created_by_actor_id   TEXT        NOT NULL,
  updated_by_actor_id   TEXT        NOT NULL,
  published_by_actor_id TEXT,
  created_at            TIMESTAMPTZ NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL,
  published_at          TIMESTAMPTZ,
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
  type              TEXT        NOT NULL DEFAULT 'yes-no',
  risk_level        TEXT,
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

CREATE TABLE review_template_selections (
  review_id            TEXT        NOT NULL,
  template_revision_id TEXT        NOT NULL,
  position             INTEGER     NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (review_id, template_revision_id),
  CONSTRAINT review_template_selections_review_position_unique UNIQUE (review_id, position),
  CONSTRAINT review_template_selections_position_check CHECK (position BETWEEN 0 AND 2),
  CONSTRAINT fk_rts_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_rts_revision FOREIGN KEY (template_revision_id) REFERENCES template_revisions (id) ON DELETE RESTRICT
);

-- +goose Down

DELETE FROM field_version_events
WHERE entity_type IN (
  'review',
  'review_checkpoint',
  'review_answer',
  'review_note',
  'review_attachment',
  'template',
  'template_version',
  'template_pillar',
  'template_question',
  'template_draft',
  'template_draft_pillar',
  'template_draft_question'
);

DELETE FROM field_versions
WHERE entity_type IN (
  'review',
  'review_checkpoint',
  'review_answer',
  'review_note',
  'review_attachment',
  'template',
  'template_version',
  'template_pillar',
  'template_question',
  'template_draft',
  'template_draft_pillar',
  'template_draft_question'
);

DELETE FROM events
WHERE review_id IS NOT NULL
   OR entity_type IN (
     'review',
     'review_checkpoint',
     'review_answer',
     'review_note',
     'review_attachment',
     'template',
     'template_version',
     'template_pillar',
     'template_question',
     'template_draft',
     'template_draft_pillar',
     'template_draft_question'
   )
   OR event_type IN (
     'ReviewAnswerRecorded.v1',
     'ReviewCheckpointSaved.v1',
     'ReviewNoteRecorded.v1',
     'ReviewNoteDeleted.v1',
     'ReviewAttachmentUploaded.v1',
     'ReviewAttachmentDeleted.v1',
     'ReviewProgressUpdated.v1',
     'ReviewCreated.v1',
     'ReviewArchived.v1',
     'ReviewRestored.v1',
     'ReviewDeleted.v1',
     'TemplateDraftCreated.v1',
     'TemplateDraftUpdated.v1',
     'TemplateDraftDeleted.v1',
     'TemplatePublished.v1',
     'TemplateImported.v1',
     'TemplatePillarCreated.v1',
     'TemplatePillarUpdated.v1',
     'TemplatePillarDeleted.v1',
     'TemplateQuestionCreated.v1',
     'TemplateQuestionUpdated.v1',
     'TemplateQuestionDeleted.v1'
   );

DELETE FROM draft_answer_evidence;
DELETE FROM draft_answer_imports;
DELETE FROM review_participants;
DELETE FROM review_score_state;
DELETE FROM review_attachments;
DELETE FROM review_note_state;
DELETE FROM review_answer_state;
DELETE FROM review_template_selections;
DELETE FROM reviews;

DELETE FROM template_questions;
DELETE FROM template_pillars;
DELETE FROM template_revisions;
DELETE FROM templates;

DROP TABLE review_template_selections;
DROP TABLE template_questions;
DROP TABLE template_pillars;
DROP TABLE template_revisions;
DROP TABLE templates;

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

CREATE TABLE review_template_selections (
  id                  TEXT        NOT NULL PRIMARY KEY,
  review_id           TEXT        NOT NULL,
  template_version_id TEXT        NOT NULL,
  position            INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rts_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
);
CREATE INDEX review_template_selections_review_idx ON review_template_selections (review_id);
