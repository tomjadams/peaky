-- Sync engine schema migration.
--
-- Consolidates the following changes into a single migration:
--   • local_outbox: payload → fields (structured array for HLC sync)
--   • field_versions: local HLC change tracking + before/after diffs
--   • events: HLC column for causal ordering

-- ── 1. local_outbox: recreate with fields (replacing payload) ─────────────
--
-- SQLite cannot ALTER COLUMN, so we recreate the table. The final schema
-- has fields NOT NULL DEFAULT '[]' so the sync contract is never ambiguous.

CREATE TABLE local_outbox_new (
  id          TEXT    NOT NULL PRIMARY KEY,
  actor_id    TEXT,
  entity_type TEXT    NOT NULL,
  entity_id   TEXT    NOT NULL,
  operation   TEXT    NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'upsert')),
  fields      TEXT    NOT NULL DEFAULT '[]',
  created_at  TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL,
  last_error  TEXT,
  synced_at   TEXT
);
--> statement-breakpoint
INSERT INTO local_outbox_new (id, actor_id, entity_type, entity_id, operation, fields, created_at, status, retry_count, updated_at, last_error, synced_at)
  SELECT id, actor_id, entity_type, entity_id, operation, COALESCE(payload, '[]'), created_at, status, retry_count, updated_at, last_error, synced_at
  FROM local_outbox;
--> statement-breakpoint
DROP TABLE local_outbox;
--> statement-breakpoint
ALTER TABLE local_outbox_new RENAME TO local_outbox;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS local_outbox_actor_status_idx ON local_outbox(actor_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS local_outbox_entity_idx ON local_outbox(entity_type, entity_id);

-- ── 2. field_versions: HLC change tracking with full edit history ─────────
--
-- Each distinct change is a new row (versioned insert) so the Recent Changes
-- feed can show the full transition history (e.g. "new → 2/4" then "2/4 → 0/4").
-- The event_id column provides idempotency: the same pulled event won't
-- create a duplicate row. The 5s editing-window logic is applied at insert
-- time by reading the latest existing row for the entity/field.

CREATE TABLE IF NOT EXISTS field_versions (
  id             TEXT NOT NULL PRIMARY KEY,
  event_id       TEXT,
  entity_type    TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  field_name     TEXT NOT NULL,
  value          TEXT,
  previous_value TEXT,
  hlc            TEXT NOT NULL,
  actor_id       TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_versions_entity_idx ON field_versions(entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_versions_updated_at_idx ON field_versions(updated_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_versions_actor_idx ON field_versions(actor_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS field_versions_event_id_idx ON field_versions(event_id);

-- ── 3. events: add HLC column for causal ordering ─────────────────────────

ALTER TABLE events ADD COLUMN hlc TEXT;
