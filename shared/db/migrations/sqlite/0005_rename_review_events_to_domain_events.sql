-- Recreate review_events as domain_events with nullable review_id
-- and new cross-domain columns (source, entity_type, entity_id).
-- review_id becomes nullable to support non-review domain events.
CREATE TABLE domain_events (
  id TEXT PRIMARY KEY,
  review_id TEXT REFERENCES reviews(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'integration', 'system')),
  actor_id TEXT NOT NULL,
  data TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
  synced_at TEXT,
  source TEXT NOT NULL DEFAULT 'local-first' CHECK(source IN ('local-first', 'remote', 'system')),
  entity_type TEXT,
  entity_id TEXT
);
--> statement-breakpoint
INSERT INTO domain_events (id, review_id, event_type, actor_type, actor_id, data, occurred_at, status, synced_at)
  SELECT id, review_id, event_type, actor_type, actor_id, data, occurred_at, status, synced_at
  FROM review_events;
--> statement-breakpoint
DROP TABLE review_events;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_review_idx ON domain_events(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_occurred_at_idx ON domain_events(occurred_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_status_idx ON domain_events(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS domain_events_entity_occurred_idx ON domain_events(entity_type, occurred_at);
