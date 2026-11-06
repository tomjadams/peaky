-- Append-only Advisor maturity override stream, keyed by Review and
-- templateRevisionId (maturity-score/REQ-016). Rows are never updated or
-- deleted; the effective override is resolved on read as the latest
-- non-revoked transition (AC-031). The action enum and the
-- revoke-carries-no-value invariant are enforced by CHECK constraints, so any
-- future change to the action enum requires a table-recreation migration per
-- the SQLite enum rule in AGENTS.md.
CREATE TABLE review_maturity_overrides (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  template_revision_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reviewed_percent INTEGER,
  reviewed_stage INTEGER,
  explanation TEXT,
  evidence TEXT,
  prior_transition_id TEXT REFERENCES review_maturity_overrides(id),
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  CONSTRAINT review_maturity_overrides_action_check CHECK (action IN ('create', 'supersede', 'revoke')),
  CONSTRAINT review_maturity_overrides_value_check CHECK (
    (action = 'revoke' AND reviewed_percent IS NULL AND reviewed_stage IS NULL)
    OR
    (action IN ('create', 'supersede')
      AND reviewed_percent IS NOT NULL AND reviewed_percent BETWEEN 0 AND 100
      AND reviewed_stage IS NOT NULL AND reviewed_stage BETWEEN 1 AND 5)
  )
);
--> statement-breakpoint
CREATE INDEX review_maturity_overrides_review_revision_idx
  ON review_maturity_overrides (review_id, template_revision_id);
--> statement-breakpoint
CREATE INDEX review_maturity_overrides_prior_idx
  ON review_maturity_overrides (prior_transition_id);
