-- Remove 'low' from question severity levels.
-- Existing 'low' values are promoted to 'medium' (not null) per product decision.
-- Supported severity values after migration: critical, high, medium.
--
-- Two tables affected:
--   template_questions         (risk_level nullable, no default)
--   template_draft_questions  (risk_level NOT NULL DEFAULT 'medium')
--
-- SQLite cannot ALTER COLUMN to change a CHECK constraint, so we recreate
-- both tables and copy data. Existing rows with risk_level = 'low' receive
-- 'medium' via the INSERT ... SELECT CASE expression.

-- template_questions
CREATE TABLE template_questions_new (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL REFERENCES template_pillars(id) ON DELETE CASCADE,
  order_key TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'yes-no' CHECK(type IN ('yes-no', 'checklist')),
  risk_level TEXT CHECK(risk_level IN ('critical', 'high', 'medium')),
  importance TEXT,
  checklist_items TEXT,
  leading_practices TEXT,
  helpful_links TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO template_questions_new (id, pillar_id, order_key, text, type, risk_level, importance, checklist_items, leading_practices, helpful_links, created_at, updated_at)
  SELECT id, pillar_id, order_key, text, type,
    CASE WHEN risk_level = 'low' THEN 'medium' ELSE risk_level END,
    importance, checklist_items, leading_practices, helpful_links, created_at, updated_at
  FROM template_questions;
--> statement-breakpoint
DROP TABLE template_questions;
--> statement-breakpoint
ALTER TABLE template_questions_new RENAME TO template_questions;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_questions_pillar_idx ON template_questions(pillar_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_questions_order_idx ON template_questions(order_key);

-- template_draft_questions
CREATE TABLE template_draft_questions_new (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES template_drafts(id) ON DELETE CASCADE,
  pillar_id TEXT NOT NULL,
  order_key TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'yes-no' CHECK(type IN ('yes-no', 'checklist')),
  text TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK(risk_level IN ('critical', 'high', 'medium')),
  importance TEXT DEFAULT '',
  checklist_items TEXT DEFAULT '[]',
  leading_practices TEXT DEFAULT '[]',
  helpful_links TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO template_draft_questions_new (id, draft_id, pillar_id, order_key, type, text, risk_level, importance, checklist_items, leading_practices, helpful_links, created_at, updated_at)
  SELECT id, draft_id, pillar_id, order_key, type, text,
    CASE WHEN risk_level = 'low' THEN 'medium' ELSE risk_level END,
    importance, checklist_items, leading_practices, helpful_links, created_at, updated_at
  FROM template_draft_questions;
--> statement-breakpoint
DROP TABLE template_draft_questions;
--> statement-breakpoint
ALTER TABLE template_draft_questions_new RENAME TO template_draft_questions;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_questions_draft_idx ON template_draft_questions(draft_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_questions_pillar_idx ON template_draft_questions(pillar_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS template_draft_questions_order_idx ON template_draft_questions(pillar_id, order_key);
