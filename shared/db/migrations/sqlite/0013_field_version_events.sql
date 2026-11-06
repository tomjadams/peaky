-- Split current field state from Recent Changes history.
--
-- field_versions returns to one row per entity/field for conflict resolution.
-- field_version_events keeps append-only audit rows for the feed and dedupes
-- local writes against their server echo by (event_id, field_name).

CREATE TABLE IF NOT EXISTS field_version_events (
  id             TEXT NOT NULL PRIMARY KEY,
  event_id       TEXT NOT NULL,
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
INSERT OR IGNORE INTO field_version_events (
  id, event_id, entity_type, entity_id, field_name, value, previous_value, hlc, actor_id, updated_at
)
SELECT
  id,
  COALESCE(event_id, id),
  entity_type,
  entity_id,
  field_name,
  value,
  previous_value,
  hlc,
  actor_id,
  updated_at
FROM field_versions;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS field_version_events_event_field_unique ON field_version_events(event_id, field_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_version_events_entity_idx ON field_version_events(entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_version_events_updated_at_idx ON field_version_events(updated_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_version_events_actor_idx ON field_version_events(actor_id);
--> statement-breakpoint
CREATE TABLE field_versions_current (
  id          TEXT NOT NULL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  field_name  TEXT NOT NULL,
  value       TEXT,
  hlc         TEXT NOT NULL,
  actor_id    TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO field_versions_current (
  id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at
)
SELECT
  fv.id,
  fv.entity_type,
  fv.entity_id,
  fv.field_name,
  fv.value,
  fv.hlc,
  fv.actor_id,
  fv.updated_at
FROM field_versions fv
WHERE fv.rowid = (
  SELECT newer.rowid
  FROM field_versions newer
  WHERE newer.entity_type = fv.entity_type
    AND newer.entity_id = fv.entity_id
    AND newer.field_name = fv.field_name
  ORDER BY newer.updated_at DESC, newer.rowid DESC
  LIMIT 1
);
--> statement-breakpoint
DROP TABLE field_versions;
--> statement-breakpoint
ALTER TABLE field_versions_current RENAME TO field_versions;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS field_versions_entity_field_unique ON field_versions(entity_type, entity_id, field_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_versions_entity_idx ON field_versions(entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_versions_updated_at_idx ON field_versions(updated_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS field_versions_actor_idx ON field_versions(actor_id);
