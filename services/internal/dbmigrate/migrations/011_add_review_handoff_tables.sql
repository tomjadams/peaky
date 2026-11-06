-- +goose Up

-- One row per selected handoff practice (implement-maturity-score design
-- Decision 3; improvement-plans/REQ-005, REQ-006). Entity IDs are
-- deterministic from the (review, revision, question, practice) tuple so
-- concurrent clients converge on one synchronized row.
CREATE TABLE review_handoff_practices (
  id                   TEXT        NOT NULL PRIMARY KEY,
  review_id            TEXT        NOT NULL,
  template_revision_id TEXT        NOT NULL,  -- opaque identity, exact match only
  question_id          TEXT        NOT NULL,
  practice_id          TEXT        NOT NULL,  -- checklist item ID; = question_id for Yes/No (AC-016)
  order_key            TEXT        NOT NULL,
  snapshot             JSONB       NOT NULL,  -- immutable practice context captured at selection
  rationale            TEXT,
  selection_state      TEXT        NOT NULL,  -- 'selected' | 'removed'
  actor_id             TEXT        NOT NULL,
  occurred_at          TIMESTAMPTZ NOT NULL,
  updated_at           TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rhp_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT review_handoff_practices_identity_unique
    UNIQUE (review_id, template_revision_id, question_id, practice_id),
  CONSTRAINT review_handoff_practices_selection_state_check
    CHECK (selection_state IN ('selected', 'removed'))
);
CREATE INDEX review_handoff_practices_review_idx ON review_handoff_practices (review_id);

-- Append-only handoff association stream, one row per transition per
-- practice (improvement-plans/REQ-007, REQ-008). The current association is
-- resolved on read as the latest non-revoked transition (AC-032), never
-- stored as a mutable pointer.
CREATE TABLE review_handoff_associations (
  id                  TEXT        NOT NULL PRIMARY KEY,
  review_id           TEXT        NOT NULL,
  practice_entity_id  TEXT        NOT NULL,
  action              TEXT        NOT NULL,  -- 'associate' | 'replace' | 'revoke'
  provider            TEXT,                   -- external reference; NULL on revoke
  external_id         TEXT,                   -- external reference; NULL on revoke
  url                 TEXT,                   -- external reference; NULL on revoke
  prior_transition_id TEXT,
  actor_id            TEXT        NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_rha_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE,
  CONSTRAINT fk_rha_prior FOREIGN KEY (prior_transition_id) REFERENCES review_handoff_associations (id),
  CONSTRAINT review_handoff_associations_action_check
    CHECK (action IN ('associate', 'replace', 'revoke')),
  CONSTRAINT review_handoff_associations_reference_check CHECK (
    (action = 'revoke' AND provider IS NULL AND external_id IS NULL AND url IS NULL)
    OR
    (action IN ('associate', 'replace')
      AND provider IS NOT NULL AND external_id IS NOT NULL AND url IS NOT NULL)
  )
);
CREATE INDEX review_handoff_associations_practice_idx ON review_handoff_associations (practice_entity_id);
CREATE INDEX review_handoff_associations_review_idx   ON review_handoff_associations (review_id);
CREATE INDEX review_handoff_associations_prior_idx    ON review_handoff_associations (prior_transition_id);

-- +goose Down

DROP TABLE IF EXISTS review_handoff_associations;
DROP TABLE IF EXISTS review_handoff_practices;
