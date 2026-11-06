-- +goose Up

-- One schema-versioned maturity definition document per TemplateRevision
-- (maturity-score/REQ-009); NULL is the explicit no-definition state (AC-060).
-- Existing rows are intentionally not backfilled here — the deterministic
-- seed path attaches configured defaults instead.
ALTER TABLE template_revisions ADD COLUMN maturity_definition JSONB;

-- +goose Down

ALTER TABLE template_revisions DROP COLUMN maturity_definition;
