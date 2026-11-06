-- Rename domain_events.source enum values to match the peaky.* naming convention.
-- Previous values: 'local-first', 'remote', 'system'
-- New values:      'peaky.client', 'peaky.sync', 'peaky.system'
--
-- SQLite does not support ALTER COLUMN or DROP CONSTRAINT, so we recreate the table,
-- backfill the renamed values, and drop the old table.
CREATE TABLE domain_events_new (
  id TEXT PRIMARY KEY,
  review_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'integration', 'system')),
  actor_id TEXT NOT NULL,
  data TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
  synced_at TEXT,
  source TEXT NOT NULL DEFAULT 'peaky.client' CHECK(source IN ('peaky.client', 'peaky.sync', 'peaky.system')),
  entity_type TEXT,
  entity_id TEXT
);
--> statement-breakpoint
INSERT INTO domain_events_new
  SELECT
    id,
    review_id,
    event_type,
    actor_type,
    actor_id,
    data,
    occurred_at,
    status,
    synced_at,
    CASE source
      WHEN 'local-first' THEN 'peaky.client'
      WHEN 'remote'      THEN 'peaky.sync'
      WHEN 'system'      THEN 'peaky.system'
      ELSE source
    END,
    entity_type,
    entity_id
  FROM domain_events;
--> statement-breakpoint
DROP TABLE domain_events;
--> statement-breakpoint
ALTER TABLE domain_events_new RENAME TO domain_events;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_review_idx ON domain_events(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_occurred_at_idx ON domain_events(occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_status_idx ON domain_events(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_entity_occurred_idx ON domain_events(entity_type, occurred_at);
