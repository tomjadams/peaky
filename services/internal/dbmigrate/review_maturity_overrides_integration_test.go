//go:build integration

package dbmigrate

import (
	"context"
	"database/sql"
	"testing"

	"github.com/peaky-team/peaky/services/internal/testhelper"
)

const maturityOverrideMigrationVersion int64 = 10

// review_maturity_overrides is the append-only Advisor override stream keyed
// by Review and template_revision_id (maturity-score/REQ-016): rows are never
// updated or deleted, the effective override resolves on read as the latest
// non-revoked transition (AC-031), and the action enum plus the
// revoke-carries-no-value invariant are enforced by CHECK constraints.
func TestReviewMaturityOverridesTable(t *testing.T) {
	t.Run("fresh desired schema", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		assertMaturityOverrideTable(t, ctx, db)
	})

	t.Run("Goose upgrade path", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		resetPostgresSchema(t, ctx, db)
		provider := newTemplateRevisionMigrationProvider(t, db)
		defer func() { _ = provider.Close() }()

		if _, err := provider.UpTo(ctx, maturityDefinitionMigrationVersion); err != nil {
			t.Fatalf("apply migrations through 009: %v", err)
		}
		if postgresRelationExists(t, ctx, db, "review_maturity_overrides") {
			t.Fatal("review_maturity_overrides exists before migration 010")
		}

		if _, err := provider.UpTo(ctx, maturityOverrideMigrationVersion); err != nil {
			t.Fatalf("apply migration 010: %v", err)
		}
		assertMaturityOverrideTable(t, ctx, db)

		if _, err := provider.Down(ctx); err != nil {
			t.Fatalf("rollback migration 010: %v", err)
		}
		if postgresRelationExists(t, ctx, db, "review_maturity_overrides") {
			t.Fatal("review_maturity_overrides still exists after Down")
		}
	})
}

func assertMaturityOverrideTable(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	mustExecPostgres(t, ctx, db, `
INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
VALUES ('subject-override', 'team', 'Platform', 'platform', 'active', $1, $1)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
VALUES ('review-override', 'subject-override', 'Review', 'in-progress', $1, $1)`, templateRevisionTestTime)

	// Append-only create → supersede → revoke stream round-trips; every
	// consumer resolves the same current value on read (AC-031).
	mustExecPostgres(t, ctx, db, `
INSERT INTO review_maturity_overrides (
  id, review_id, template_revision_id, action, reviewed_percent,
  reviewed_stage, explanation, evidence, prior_transition_id, actor_id,
  occurred_at
) VALUES
  ('ovr-1', 'review-override', 'rev-a', 'create', 80, 4,
   'Reviewed on evidence call.', '["evidence:interview-1"]'::jsonb, NULL,
   'actor-advisor-1', $1),
  ('ovr-2', 'review-override', 'rev-a', 'supersede', 60, 3,
   'Re-scored after re-review.', '["evidence:interview-2"]'::jsonb, 'ovr-1',
   'actor-advisor-2', $1),
  ('ovr-3', 'review-override', 'rev-a', 'revoke', NULL, NULL,
   'Evidence no longer stands.', '[]'::jsonb, 'ovr-2',
   'actor-advisor-2', $1)`, templateRevisionTestTime)

	var count int
	if err := db.QueryRowContext(ctx, `
SELECT count(*) FROM review_maturity_overrides WHERE review_id = 'review-override'`).Scan(&count); err != nil {
		t.Fatalf("count override transitions: %v", err)
	}
	if count != 3 {
		t.Fatalf("override transitions = %d, want 3 (append-only history)", count)
	}

	// The action CHECK rejects an unknown action.
	assertPostgresErrorCode(t, "23514", func() error {
		_, err := db.ExecContext(ctx, `
INSERT INTO review_maturity_overrides (
  id, review_id, template_revision_id, action, actor_id, occurred_at
) VALUES ('ovr-bad', 'review-override', 'rev-a', 'delete', 'actor-1', $1)`, templateRevisionTestTime)
		return err
	})

	// The value CHECK rejects a revoke carrying a reviewed value.
	assertPostgresErrorCode(t, "23514", func() error {
		_, err := db.ExecContext(ctx, `
INSERT INTO review_maturity_overrides (
  id, review_id, template_revision_id, action, reviewed_percent,
  reviewed_stage, actor_id, occurred_at
) VALUES ('ovr-bad-2', 'review-override', 'rev-a', 'revoke', 10, 1, 'actor-1', $1)`, templateRevisionTestTime)
		return err
	})

	// Override history cascades with its owning Review.
	if _, err := db.ExecContext(ctx, `DELETE FROM reviews WHERE id = 'review-override'`); err != nil {
		t.Fatalf("delete owning review: %v", err)
	}
	if got := postgresRowCount(t, ctx, db, "review_maturity_overrides"); got != 0 {
		t.Fatalf("override rows after review delete = %d, want 0", got)
	}
}
