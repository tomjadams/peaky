-- Add root_type / root_id to events for pull-scoping.
-- These nullable columns mirror the PostgreSQL columns added in goose migration 005.
-- The client does not populate them yet (push stamping is server-side);
-- they exist so the Drizzle schema and the SQLite table stay in sync.
ALTER TABLE events ADD COLUMN root_type TEXT;
--> statement-breakpoint
ALTER TABLE events ADD COLUMN root_id TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_root_idx ON events (root_type, root_id, time);
