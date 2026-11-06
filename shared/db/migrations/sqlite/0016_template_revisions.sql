DELETE FROM local_outbox
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
--> statement-breakpoint
DELETE FROM pending_review_queue
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
DELETE FROM entitlement_snapshots;
--> statement-breakpoint
DELETE FROM draft_answer_evidence;
--> statement-breakpoint
DELETE FROM draft_answer_imports;
--> statement-breakpoint
DELETE FROM review_participants;
--> statement-breakpoint
DELETE FROM review_score_state;
--> statement-breakpoint
DELETE FROM review_attachments;
--> statement-breakpoint
DELETE FROM review_note_state;
--> statement-breakpoint
DELETE FROM review_answer_state;
--> statement-breakpoint
DELETE FROM review_template_selections;
--> statement-breakpoint
DELETE FROM reviews;
--> statement-breakpoint
DELETE FROM template_draft_imports;
--> statement-breakpoint
DELETE FROM template_draft_questions;
--> statement-breakpoint
DELETE FROM template_draft_pillars;
--> statement-breakpoint
DELETE FROM template_drafts;
--> statement-breakpoint
DELETE FROM template_questions;
--> statement-breakpoint
DELETE FROM template_pillars;
--> statement-breakpoint
DELETE FROM template_versions;
--> statement-breakpoint
DELETE FROM templates;
--> statement-breakpoint
DROP TABLE review_template_selections;
--> statement-breakpoint
DROP TABLE template_draft_imports;
--> statement-breakpoint
DROP TABLE template_draft_questions;
--> statement-breakpoint
DROP TABLE template_draft_pillars;
--> statement-breakpoint
DROP TABLE template_drafts;
--> statement-breakpoint
DROP TABLE template_questions;
--> statement-breakpoint
DROP TABLE template_pillars;
--> statement-breakpoint
DROP TABLE template_versions;
--> statement-breakpoint
DROP TABLE templates;
--> statement-breakpoint
CREATE TABLE templates (
  id                  TEXT NOT NULL PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
  owner_team_id       TEXT NOT NULL,
  created_by_actor_id TEXT NOT NULL,
  updated_by_actor_id TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX templates_status_idx ON templates(status);
--> statement-breakpoint
CREATE TABLE template_revisions (
  id                    TEXT NOT NULL PRIMARY KEY,
  template_id           TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'retired')),
  revision_number       INTEGER,
  revision_summary      TEXT,
  created_by_actor_id   TEXT NOT NULL,
  updated_by_actor_id   TEXT NOT NULL,
  published_by_actor_id TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  published_at          TEXT,
  CHECK(
    (status = 'draft' AND revision_number IS NULL AND published_at IS NULL AND published_by_actor_id IS NULL)
    OR
    (status IN ('published', 'retired') AND revision_number IS NOT NULL AND typeof(revision_number) = 'integer' AND revision_number > 0 AND published_at IS NOT NULL AND published_by_actor_id IS NOT NULL)
  ),
  CHECK(
    revision_summary IS NULL
    OR (length(trim(revision_summary)) >= 1 AND length(trim(revision_summary)) <= 120)
  )
);
--> statement-breakpoint
CREATE INDEX template_revisions_template_idx ON template_revisions(template_id);
--> statement-breakpoint
CREATE UNIQUE INDEX template_revisions_one_draft_idx
  ON template_revisions(template_id) WHERE status = 'draft';
--> statement-breakpoint
CREATE UNIQUE INDEX template_revisions_one_published_idx
  ON template_revisions(template_id) WHERE status = 'published';
--> statement-breakpoint
CREATE UNIQUE INDEX template_revisions_number_unique_idx
  ON template_revisions(template_id, revision_number) WHERE revision_number IS NOT NULL;
--> statement-breakpoint
CREATE TABLE template_pillars (
  id                   TEXT NOT NULL PRIMARY KEY,
  template_revision_id TEXT NOT NULL REFERENCES template_revisions(id) ON DELETE CASCADE,
  slug                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  description          TEXT,
  order_key            TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE(template_revision_id, slug)
);
--> statement-breakpoint
CREATE INDEX template_pillars_template_revision_idx ON template_pillars(template_revision_id);
--> statement-breakpoint
CREATE INDEX template_pillars_order_idx ON template_pillars(template_revision_id, order_key);
--> statement-breakpoint
CREATE TABLE template_questions (
  id                TEXT NOT NULL PRIMARY KEY,
  pillar_id         TEXT NOT NULL REFERENCES template_pillars(id) ON DELETE CASCADE,
  order_key         TEXT NOT NULL,
  text              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'yes-no' CHECK(type IN ('yes-no', 'checklist')),
  risk_level        TEXT CHECK(risk_level IS NULL OR risk_level IN ('critical', 'high', 'medium')),
  importance        TEXT,
  checklist_items   TEXT,
  leading_practices TEXT,
  helpful_links     TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX template_questions_pillar_idx ON template_questions(pillar_id);
--> statement-breakpoint
CREATE INDEX template_questions_order_idx ON template_questions(pillar_id, order_key);
--> statement-breakpoint
CREATE TABLE template_revision_imports (
  id                   TEXT NOT NULL PRIMARY KEY,
  template_revision_id TEXT NOT NULL REFERENCES template_revisions(id) ON DELETE CASCADE,
  source_type          TEXT NOT NULL CHECK(source_type IN ('markdown', 'json')),
  source_file          TEXT,
  imported_at          TEXT NOT NULL,
  conflicts            TEXT NOT NULL DEFAULT '[]',
  resolved             TEXT NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX template_revision_imports_revision_idx ON template_revision_imports(template_revision_id);
--> statement-breakpoint
CREATE TABLE review_template_selections (
  review_id            TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  template_revision_id TEXT NOT NULL REFERENCES template_revisions(id) ON DELETE RESTRICT,
  position             INTEGER NOT NULL CHECK(typeof(position) = 'integer' AND position BETWEEN 0 AND 2),
  created_at           TEXT NOT NULL,
  PRIMARY KEY(review_id, template_revision_id),
  UNIQUE(review_id, position)
);
