-- Append-only handoff association stream, one row per transition per
-- practice (improvement-plans/REQ-007, REQ-008). Rows are never updated or
-- deleted; the current association is resolved on read as the latest
-- non-revoked transition (AC-032). practice_entity_id carries the
-- deterministic practice row ID without a foreign key so sync can apply a
-- transition before its practice row arrives. The action enum and the
-- revoke-carries-no-reference invariant are CHECK-constrained; any future
-- change to the handoffAssociationAction enum requires a table-recreation
-- migration per the SQLite enum rule in AGENTS.md.
CREATE TABLE review_handoff_associations (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  practice_entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  provider TEXT,
  external_id TEXT,
  url TEXT,
  prior_transition_id TEXT REFERENCES review_handoff_associations(id),
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  CONSTRAINT review_handoff_associations_action_check
    CHECK (action IN ('associate', 'replace', 'revoke')),
  CONSTRAINT review_handoff_associations_reference_check CHECK (
    (action = 'revoke' AND provider IS NULL AND external_id IS NULL AND url IS NULL)
    OR
    (action IN ('associate', 'replace')
      AND provider IS NOT NULL AND external_id IS NOT NULL AND url IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX review_handoff_associations_practice_idx
  ON review_handoff_associations (practice_entity_id);
--> statement-breakpoint
CREATE INDEX review_handoff_associations_review_idx
  ON review_handoff_associations (review_id);
--> statement-breakpoint
CREATE INDEX review_handoff_associations_prior_idx
  ON review_handoff_associations (prior_transition_id);
