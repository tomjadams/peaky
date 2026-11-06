-- One schema-versioned maturity definition document per TemplateRevision
-- (maturity-score/REQ-009). NULL is the explicit no-definition state
-- (AC-060); pre-existing rows are intentionally not backfilled here — the
-- deterministic seed path attaches configured defaults instead.
-- The document is JSON text; shape validation lives in the domain codec, so
-- no enum-like CHECK applies and no table recreation is required.
ALTER TABLE template_revisions ADD COLUMN maturity_definition TEXT;
