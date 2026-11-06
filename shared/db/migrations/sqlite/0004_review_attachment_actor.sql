ALTER TABLE review_attachments ADD COLUMN created_by TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE review_attachments ADD COLUMN created_by_name TEXT NOT NULL DEFAULT '';
