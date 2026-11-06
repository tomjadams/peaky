-- One row per selected handoff practice (implement-maturity-score design
-- Decision 3; improvement-plans/REQ-005, REQ-006). Entity IDs are
-- deterministic from the (review_id, template_revision_id, question_id,
-- practice_id) tuple so concurrent clients converge on one synchronized
-- row; the identity unique index asserts that invariant at the database
-- boundary. The selection_state enum is CHECK-constrained, so any future
-- change to the handoffSelectionState enum requires a table-recreation
-- migration per the SQLite enum rule in AGENTS.md.
CREATE TABLE review_handoff_practices (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  template_revision_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  order_key TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  rationale TEXT,
  selection_state TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT review_handoff_practices_selection_state_check
    CHECK (selection_state IN ('selected', 'removed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX review_handoff_practices_identity_unique
  ON review_handoff_practices
  (review_id, template_revision_id, question_id, practice_id);
--> statement-breakpoint
CREATE INDEX review_handoff_practices_review_idx
  ON review_handoff_practices (review_id);
