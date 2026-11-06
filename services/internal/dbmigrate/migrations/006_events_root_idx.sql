-- +goose NO TRANSACTION
-- Build the root-type/root-id/time index concurrently to avoid locking
-- the hot events table. Split from 005 so the backfill + NOT NULL
-- enforcement commits before the index build starts.

-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS events_root_idx ON events (root_type, root_id, time);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS events_root_idx;
