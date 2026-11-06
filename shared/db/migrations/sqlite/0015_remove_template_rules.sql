-- Intentionally delete all persisted Template Rules data.
-- Templates, versions, pillars, questions, drafts, draft pillars, and draft
-- questions remain unchanged.
DROP TABLE IF EXISTS template_draft_rules;
--> statement-breakpoint
DROP TABLE IF EXISTS template_rules;
