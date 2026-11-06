-- +goose Up
-- Intentionally deletes all persisted Template Rules data.
-- Do not use CASCADE: unknown dependencies must fail loudly.
DROP TABLE IF EXISTS template_rules;

-- +goose Down
-- Restores the historical schema only. Deleted Rules rows are not recoverable.
CREATE TABLE template_rules (
  id               TEXT        NOT NULL PRIMARY KEY,
  pillar_id        TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  conditions       JSONB       NOT NULL,
  condition_groups JSONB,
  action           JSONB       NOT NULL,
  position         JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_tr_pillar FOREIGN KEY (pillar_id) REFERENCES template_pillars (id) ON DELETE CASCADE
);
CREATE INDEX template_rules_pillar_idx ON template_rules (pillar_id);
