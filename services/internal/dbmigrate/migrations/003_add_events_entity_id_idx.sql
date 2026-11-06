-- +goose NO TRANSACTION
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.

-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS events_entity_id_idx ON events (entity_id);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS events_entity_id_idx;
