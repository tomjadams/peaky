-- Rename domain_events to events to reflect its actual scope.
-- The table now stores domain events (user mutations) AND system events
-- (DB lifecycle, sync ops, OPFS), so the original name is misleading.
--
-- SQLite supports ALTER TABLE ... RENAME TO natively. Indexes are carried
-- over with the table but retain their original names; we drop and recreate
-- them so the prefix matches the new table name.
ALTER TABLE domain_events RENAME TO events;
--> statement-breakpoint
DROP INDEX IF EXISTS domain_events_review_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS domain_events_time_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS domain_events_status_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS domain_events_entity_time_idx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_review_idx ON events(review_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_time_idx ON events(time);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_entity_time_idx ON events(entity_type, time);
