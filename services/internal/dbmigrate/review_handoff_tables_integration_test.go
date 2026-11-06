//go:build integration

package dbmigrate

import (
	"context"
	"database/sql"
	"testing"

	"github.com/peaky-team/peaky/services/internal/testhelper"
)

const reviewHandoffMigrationVersion int64 = 11

// review_handoff_practices and review_handoff_associations are the
// provider-neutral handoff review children (improvement-plans/REQ-006,
// REQ-008): practice rows carry order/snapshot/rationale/selection state,
// association transitions are append-only with a self-referential prior
// pointer, and action/reference invariants are enforced by CHECK
// constraints.
func TestReviewHandoffTables(t *testing.T) {
	t.Run("fresh desired schema", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		assertReviewHandoffTables(t, ctx, db)
	})

	t.Run("Goose upgrade path", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		resetPostgresSchema(t, ctx, db)
		provider := newTemplateRevisionMigrationProvider(t, db)
		defer func() { _ = provider.Close() }()

		if _, err := provider.UpTo(ctx, maturityOverrideMigrationVersion); err != nil {
			t.Fatalf("apply migrations through 010: %v", err)
		}
		if postgresRelationExists(t, ctx, db, "review_handoff_practices") {
			t.Fatal("review_handoff_practices exists before migration 011")
		}

		if _, err := provider.UpTo(ctx, reviewHandoffMigrationVersion); err != nil {
			t.Fatalf("apply migration 011: %v", err)
		}
		assertReviewHandoffTables(t, ctx, db)

		if _, err := provider.Down(ctx); err != nil {
			t.Fatalf("rollback migration 011: %v", err)
		}
		if postgresRelationExists(t, ctx, db, "review_handoff_practices") {
			t.Fatal("review_handoff_practices still exists after Down")
		}
		if postgresRelationExists(t, ctx, db, "review_handoff_associations") {
			t.Fatal("review_handoff_associations still exists after Down")
		}
	})
}

func assertReviewHandoffTables(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	mustExecPostgres(t, ctx, db, `
INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
VALUES ('subject-handoff', 'team', 'Platform', 'platform', 'active', $1, $1)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
VALUES ('review-handoff', 'subject-handoff', 'Review', 'in-progress', $1, $1)`, templateRevisionTestTime)

	practiceID := "review_handoff_practice:review-handoff/rev-a/q-1/cl-1"
	mustExecPostgres(t, ctx, db, `
INSERT INTO review_handoff_practices (
  id, review_id, template_revision_id, question_id, practice_id, order_key,
  snapshot, selection_state, actor_id, occurred_at, updated_at
) VALUES ($1, 'review-handoff', 'rev-a', 'q-1', 'cl-1', 'a0',
  '{"title":"Enable branch protection"}'::jsonb, 'selected', 'actor-1', $2, $2)`,
		practiceID, templateRevisionTestTime)

	// Append-only associate → replace stream round-trips (AC-032).
	mustExecPostgres(t, ctx, db, `
INSERT INTO review_handoff_associations (
  id, review_id, practice_entity_id, action, provider, external_id, url,
  prior_transition_id, actor_id, occurred_at
) VALUES
  ('assoc-1', 'review-handoff', $1, 'associate', 'jira', 'ORR-1',
   'https://tracker.example/ORR-1', NULL, 'actor-1', $2),
  ('assoc-2', 'review-handoff', $1, 'replace', 'gitlab', 'rtf#9',
   'https://gitlab.example/rtf/-/issues/9', 'assoc-1', 'actor-2', $2)`,
		practiceID, templateRevisionTestTime)

	if got := postgresRowCount(t, ctx, db, "review_handoff_associations"); got != 2 {
		t.Fatalf("association transitions = %d, want 2 (append-only history)", got)
	}

	// The selection_state CHECK rejects an unknown state.
	assertPostgresErrorCode(t, "23514", func() error {
		_, err := db.ExecContext(ctx, `
INSERT INTO review_handoff_practices (
  id, review_id, template_revision_id, question_id, practice_id, order_key,
  snapshot, selection_state, actor_id, occurred_at, updated_at
) VALUES ('review_handoff_practice:review-handoff/rev-a/q-1/cl-2',
  'review-handoff', 'rev-a', 'q-1', 'cl-2', 'a1', '{}'::jsonb, 'pending',
  'actor-1', $1, $1)`, templateRevisionTestTime)
		return err
	})

	// The action CHECK rejects a value outside the transition vocabulary.
	assertPostgresErrorCode(t, "23514", func() error {
		_, err := db.ExecContext(ctx, `
INSERT INTO review_handoff_associations (
  id, review_id, practice_entity_id, action, provider, external_id, url,
  actor_id, occurred_at
) VALUES ('assoc-bad-action', 'review-handoff', $1, 'delete', 'jira',
  'ORR-2', 'https://tracker.example/ORR-2', 'actor-1', $2)`,
			practiceID, templateRevisionTestTime)
		return err
	})

	// The reference CHECK rejects an associate without a complete reference.
	assertPostgresErrorCode(t, "23514", func() error {
		_, err := db.ExecContext(ctx, `
INSERT INTO review_handoff_associations (
  id, review_id, practice_entity_id, action, actor_id, occurred_at
) VALUES ('assoc-bad', 'review-handoff', $1, 'associate', 'actor-1', $2)`,
			practiceID, templateRevisionTestTime)
		return err
	})

	// Handoff children cascade with their owning Review.
	if _, err := db.ExecContext(ctx, `DELETE FROM reviews WHERE id = 'review-handoff'`); err != nil {
		t.Fatalf("delete owning review: %v", err)
	}
	if got := postgresRowCount(t, ctx, db, "review_handoff_practices"); got != 0 {
		t.Fatalf("practice rows after review delete = %d, want 0", got)
	}
	if got := postgresRowCount(t, ctx, db, "review_handoff_associations"); got != 0 {
		t.Fatalf("association rows after review delete = %d, want 0", got)
	}
}
