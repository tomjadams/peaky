-- Device-local handoff lifecycle. The synchronized practice identity and
-- ordinary field payload stay unchanged; local_handoff_id only records which
-- local sequence first claimed a practice on this device.
CREATE TABLE local_review_handoffs (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  completed_at TEXT,
  completion_mode TEXT,
  completed_by TEXT,
  note TEXT,
  selected_practice_ids TEXT NOT NULL DEFAULT '[]',
  unresolved_count INTEGER,
  CONSTRAINT local_review_handoffs_id_shape_check CHECK (
    id = 'review_handoff:' || review_id || '/' || sequence
  ),
  CONSTRAINT local_review_handoffs_sequence_check CHECK (
    typeof(sequence) = 'integer' AND sequence >= 1
  ),
  CONSTRAINT local_review_handoffs_status_check CHECK (
    status IN ('active', 'completed')
  ),
  CONSTRAINT local_review_handoffs_selected_practice_ids_check CHECK (
    json_valid(selected_practice_ids)
    AND json_type(selected_practice_ids) = 'array'
  ),
  CONSTRAINT local_review_handoffs_completion_check CHECK (
    (status = 'active'
      AND completed_at IS NULL
      AND completion_mode IS NULL
      AND completed_by IS NULL
      AND note IS NULL
      AND unresolved_count IS NULL)
    OR
    (status = 'completed'
      AND completed_at IS NOT NULL
      AND datetime(completed_at) IS NOT NULL
      AND completed_at >= created_at
      AND completion_mode IN ('auto', 'manual')
      AND completed_by IS NOT NULL
      AND length(completed_by) > 0
      AND typeof(unresolved_count) = 'integer'
      AND unresolved_count >= 0
      AND unresolved_count <= json_array_length(selected_practice_ids)
      AND (note IS NULL
        OR (completion_mode = 'manual'
          AND length(trim(note)) BETWEEN 1 AND 2000))
      AND (completion_mode = 'manual'
        OR (unresolved_count = 0
          AND json_array_length(selected_practice_ids) > 0
          AND note IS NULL))
      AND (unresolved_count = 0 OR note IS NOT NULL))
  ),
  CONSTRAINT local_review_handoffs_actor_shape_check CHECK (
    length(created_by) > 0 AND datetime(created_at) IS NOT NULL
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX local_review_handoffs_review_sequence_unique
  ON local_review_handoffs (review_id, sequence);
--> statement-breakpoint
CREATE UNIQUE INDEX local_review_handoffs_active_review_unique
  ON local_review_handoffs (review_id)
  WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX local_review_handoffs_review_idx
  ON local_review_handoffs (review_id);
--> statement-breakpoint
-- Existing synchronized rows predate local lifecycle ownership. Keep every row,
-- including removed rows, together in sequence 1 and use the earliest selection
-- timestamp and its actor as creation provenance.
INSERT INTO local_review_handoffs (
  id,
  review_id,
  sequence,
  status,
  created_at,
  created_by,
  completed_at,
  completion_mode,
  completed_by,
  note,
  selected_practice_ids,
  unresolved_count
)
SELECT
  'review_handoff:' || practices.review_id || '/1',
  practices.review_id,
  1,
  'active',
  MIN(practices.occurred_at),
  (
    SELECT earliest.actor_id
    FROM review_handoff_practices AS earliest
    WHERE earliest.review_id = practices.review_id
    ORDER BY earliest.occurred_at, earliest.id
    LIMIT 1
  ),
  NULL,
  NULL,
  NULL,
  NULL,
  '[]',
  NULL
FROM review_handoff_practices AS practices
GROUP BY practices.review_id;
--> statement-breakpoint
ALTER TABLE review_handoff_practices
  RENAME TO review_handoff_practices__pre_local_lifecycle;
--> statement-breakpoint
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
  local_handoff_id TEXT,
  actor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT review_handoff_practices_selection_state_check
    CHECK (selection_state IN ('selected', 'removed'))
);
--> statement-breakpoint
INSERT INTO review_handoff_practices (
  id,
  review_id,
  template_revision_id,
  question_id,
  practice_id,
  order_key,
  snapshot,
  rationale,
  selection_state,
  local_handoff_id,
  actor_id,
  occurred_at,
  updated_at
)
SELECT
  id,
  review_id,
  template_revision_id,
  question_id,
  practice_id,
  order_key,
  snapshot,
  rationale,
  selection_state,
  'review_handoff:' || review_id || '/1',
  actor_id,
  occurred_at,
  updated_at
FROM review_handoff_practices__pre_local_lifecycle;
--> statement-breakpoint
DROP TABLE review_handoff_practices__pre_local_lifecycle;
--> statement-breakpoint
CREATE UNIQUE INDEX review_handoff_practices_identity_unique
  ON review_handoff_practices
  (review_id, template_revision_id, question_id, practice_id);
--> statement-breakpoint
CREATE INDEX review_handoff_practices_review_idx
  ON review_handoff_practices (review_id);
--> statement-breakpoint
CREATE INDEX review_handoff_practices_local_handoff_idx
  ON review_handoff_practices (local_handoff_id);
