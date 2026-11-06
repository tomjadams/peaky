-- +goose Up

-- Append-only Advisor maturity override stream, keyed by Review and
-- template_revision_id (maturity-score/REQ-016). Rows are never updated or
-- deleted; the effective override is resolved on read as the latest
-- non-revoked transition (AC-031), never stored as a mutable pointer.
CREATE TABLE review_maturity_overrides (
  id                   TEXT        NOT NULL PRIMARY KEY,
  review_id            TEXT        NOT NULL,
  template_revision_id TEXT        NOT NULL,  -- opaque identity, exact match only
  action               TEXT        NOT NULL,  -- 'create' | 'supersede' | 'revoke'
  reviewed_percent     INTEGER,               -- reviewed value; NULL on revoke
  reviewed_stage       INTEGER,               -- reviewed value; NULL on revoke
  explanation          TEXT,
  evidence             JSONB,                 -- array of evidence identifiers
  prior_transition_id  TEXT,
  actor_id             TEXT        NOT NULL,
  occurred_at          TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rmo_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_rmo_prior FOREIGN KEY (prior_transition_id) REFERENCES review_maturity_overrides (id),
  CONSTRAINT review_maturity_overrides_action_check CHECK (action IN ('create', 'supersede', 'revoke')),
  CONSTRAINT review_maturity_overrides_value_check CHECK (
    (action = 'revoke' AND reviewed_percent IS NULL AND reviewed_stage IS NULL)
    OR
    (action IN ('create', 'supersede')
      AND reviewed_percent IS NOT NULL AND reviewed_percent BETWEEN 0 AND 100
      AND reviewed_stage IS NOT NULL AND reviewed_stage BETWEEN 1 AND 5)
  )
);
CREATE INDEX review_maturity_overrides_review_revision_idx ON review_maturity_overrides (review_id, template_revision_id);
CREATE INDEX review_maturity_overrides_prior_idx           ON review_maturity_overrides (prior_transition_id);

-- +goose Down

DROP TABLE IF EXISTS review_maturity_overrides;
