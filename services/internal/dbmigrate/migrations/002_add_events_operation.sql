-- +goose Up
ALTER TABLE events ADD COLUMN operation TEXT NOT NULL DEFAULT 'upsert';

-- +goose Down
ALTER TABLE events DROP COLUMN operation;
