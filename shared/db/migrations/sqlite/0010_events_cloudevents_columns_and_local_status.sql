-- Add the missing CloudEvents v1.0.2 envelope columns and extend the status
-- enum with local so events flagged local in the catalog can be inserted
-- with status = local (excluded from any future event push).
--
-- Columns added:
--   specversion  TEXT NOT NULL DEFAULT 1.0     -- CloudEvents core
--   dataschema   TEXT (nullable)               -- URL to JSON Schema for data
--   client_id    TEXT (nullable)               -- browser session identifier
--
-- Status enum updated:
--   pending | synced | failed   ->   pending | synced | failed | local
--
-- SQLite cannot ALTER COLUMN to change a CHECK constraint, so we recreate the
-- table and copy data. Existing rows receive specversion=1.0 via DEFAULT and
-- NULL for dataschema/client_id.
CREATE TABLE events_new (
  id TEXT PRIMARY KEY,
  review_id TEXT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('user', 'integration', 'system')),
  actor_id TEXT NOT NULL,
  data TEXT,
  time TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed', 'local')),
  synced_at TEXT,
  source TEXT NOT NULL DEFAULT 'peaky.client' CHECK(source IN ('peaky.client', 'peaky.sync', 'peaky.system')),
  entity_type TEXT,
  entity_id TEXT,
  specversion TEXT NOT NULL DEFAULT '1.0',
  dataschema TEXT,
  client_id TEXT
);
--> statement-breakpoint
INSERT INTO events_new (id, review_id, event_type, actor_type, actor_id, data, time, status, synced_at, source, entity_type, entity_id)
  SELECT id, review_id, event_type, actor_type, actor_id, data, time, status, synced_at, source, entity_type, entity_id
  FROM events;
--> statement-breakpoint
DROP TABLE events;
--> statement-breakpoint
ALTER TABLE events_new RENAME TO events;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_review_idx ON events(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_time_idx ON events(time);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_entity_time_idx ON events(entity_type, time);
