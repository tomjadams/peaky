-- +goose Up
CREATE TABLE field_version_events (
  id          TEXT        NOT NULL PRIMARY KEY,
  event_id    TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT        NOT NULL,
  field_name  TEXT        NOT NULL,
  value       JSONB,
  previous_value JSONB,
  hlc         TEXT        NOT NULL,
  actor_id    TEXT        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT field_version_events_event_field_unique UNIQUE (event_id, field_name),
  CONSTRAINT fk_field_version_events_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX field_version_events_entity_idx     ON field_version_events (entity_type, entity_id);
CREATE INDEX field_version_events_updated_at_idx ON field_version_events (updated_at);
CREATE INDEX field_version_events_actor_idx      ON field_version_events (actor_id);

-- +goose Down
DROP TABLE IF EXISTS field_version_events;
