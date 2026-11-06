-- Rename 'occurred_at' to 'time' to align with CloudEvents v1.0.2 core attribute naming.
-- Also rename indexes to match the new column name.
-- SQLite does not support ALTER COLUMN, so we recreate the table.
CREATE TABLE domain_events_new (
  id TEXT PRIMARY KEY,
  review_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'integration', 'system')),
  actor_id TEXT NOT NULL,
  data TEXT,
  time TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
  synced_at TEXT,
  source TEXT NOT NULL DEFAULT 'peaky.client' CHECK(source IN ('peaky.client', 'peaky.sync', 'peaky.system')),
  entity_type TEXT,
  entity_id TEXT
);
--> statement-breakpoint
INSERT INTO domain_events_new (id, review_id, event_type, actor_type, actor_id, data, time, status, synced_at, source, entity_type, entity_id)
  SELECT id, review_id, event_type, actor_type, actor_id, data, occurred_at, status, synced_at, source, entity_type, entity_id
  FROM domain_events;
--> statement-breakpoint
DROP TABLE domain_events;
--> statement-breakpoint
ALTER TABLE domain_events_new RENAME TO domain_events;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_review_idx ON domain_events(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_time_idx ON domain_events(time);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_status_idx ON domain_events(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_entity_time_idx ON domain_events(entity_type, time);
