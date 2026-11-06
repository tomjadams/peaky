//go:build integration

package dbmigrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/peaky-team/peaky/services/internal/testhelper"
)

func TestTemplateRevisionSchemaConstraints(t *testing.T) {
	t.Run("fresh desired schema", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		if !postgresRelationExists(t, ctx, db, "template_revisions") {
			t.Fatal("fresh schema does not expose Template Revisions")
		}
		assertTemplateRevisionSchemaConstraints(t, ctx, db)
	})

	t.Run("Goose upgrade path", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		resetPostgresSchema(t, ctx, db)
		provider := newTemplateRevisionMigrationProvider(t, db)
		defer func() { _ = provider.Close() }()

		if _, err := provider.UpTo(ctx, templateRevisionMigrationVersion); err != nil {
			t.Fatalf("apply migrations through 008: %v", err)
		}
		if got := currentGooseVersion(t, ctx, db); got != templateRevisionMigrationVersion {
			t.Fatalf("migration 008 is not embedded or applied: current version = %d", got)
		}
		assertTemplateRevisionSchemaConstraints(t, ctx, db)
	})
}

func assertTemplateRevisionSchemaConstraints(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	seedPostgresTemplateRevisionConstraintState(t, ctx, db)

	t.Run("status and actor provenance", func(t *testing.T) {
		for _, status := range []string{"draft", "deleted"} {
			assertPostgresErrorCode(t, "23514", func() error {
				_, err := db.ExecContext(ctx, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ($1, 'Invalid', '', $2, 'group-platform',
  'actor-system', 'actor-system', $3, $3)`, "template-status-"+status, status, templateRevisionTestTime)
				return err
			})
		}
		assertPostgresErrorCode(t, "23502", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ('template-missing-owner', 'Invalid', '', 'active', NULL,
  'actor-system', 'actor-system', $1, $1)`, templateRevisionTestTime)
			return err
		})
		for name, values := range map[string][]any{
			"creator": {"template-missing-creator", "group-platform", nil, "actor-system", templateRevisionTestTime},
			"updater": {"template-missing-updater", "group-platform", "actor-system", nil, templateRevisionTestTime},
		} {
			t.Run("Template missing "+name, func(t *testing.T) {
				assertPostgresErrorCode(t, "23502", func() error {
					_, err := db.ExecContext(ctx, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ($1, 'Invalid', '', 'active', $2, $3, $4, $5, $5)`, values...)
					return err
				})
			})
		}
		for _, status := range []string{"active", "deleted"} {
			assertPostgresErrorCode(t, "23514", func() error {
				_, err := db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ($1, 'template-d', 'Invalid', '', $2,
  'actor-system', 'actor-system', $3, $3)`, "revision-status-"+status, status, templateRevisionTestTime)
				return err
			})
		}
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ('revision-missing-template', 'missing-template', 'Invalid', '', 'draft',
  'actor-system', 'actor-system', $1, $1)`, templateRevisionTestTime)
			return err
		})
		for name, values := range map[string][]any{
			"creator": {"revision-missing-creator", nil, "actor-system", templateRevisionTestTime},
			"updater": {"revision-missing-updater", "actor-system", nil, templateRevisionTestTime},
		} {
			t.Run("Revision missing "+name, func(t *testing.T) {
				assertPostgresErrorCode(t, "23502", func() error {
					_, err := db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ($1, 'template-b', 'Invalid', '', 'draft', $2, $3, $4, $4)`, values...)
					return err
				})
			})
		}
	})

	t.Run("publication tuple", func(t *testing.T) {
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, revision_number,
  created_by_actor_id, updated_by_actor_id, created_at, updated_at
) VALUES ('revision-numbered-draft', 'template-b', 'Invalid', '', 'draft', 1,
  'actor-system', 'actor-system', $1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, published_at,
  created_by_actor_id, updated_by_actor_id, created_at, updated_at
) VALUES ('revision-timestamped-draft', 'template-b', 'Invalid', '', 'draft', $1,
  'actor-system', 'actor-system', $1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, published_by_actor_id,
  created_by_actor_id, updated_by_actor_id, created_at, updated_at
) VALUES ('revision-publisher-draft', 'template-b', 'Invalid', '', 'draft', 'actor-system',
  'actor-system', 'actor-system', $1, $1)`, templateRevisionTestTime)
			return err
		})
		for _, status := range []string{"published", "retired"} {
			for name, columns := range map[string]string{
				"number":    "published_at, published_by_actor_id",
				"timestamp": "revision_number, published_by_actor_id",
				"publisher": "revision_number, published_at",
			} {
				t.Run(status+" missing "+name, func(t *testing.T) {
					query := `INSERT INTO template_revisions (
  id, template_id, name, description, status, ` + columns + `,
  created_by_actor_id, updated_by_actor_id, created_at, updated_at
) VALUES ('revision-` + status + `-missing-` + name + `', 'template-d', 'Invalid', '', '` + status + `', ` +
						publicationValues(columns) + `, 'actor-system', 'actor-system', $1, $1)`
					assertPostgresErrorCode(t, "23514", func() error {
						_, err := db.ExecContext(ctx, query, templateRevisionTestTime)
						return err
					})
				})
			}
		}
	})

	t.Run("numbering summary and cardinality", func(t *testing.T) {
		for _, number := range []int{0, -1} {
			assertPostgresErrorCode(t, "23514", func() error {
				_, err := insertPostgresRevision(ctx, db, postgresRevision{
					id: fmt.Sprintf("revision-number-%d", number), templateID: "template-c", status: "retired",
					number: intPtr(number), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime),
				})
				return err
			})
		}
		assertPostgresErrorCode(t, "23505", func() error {
			_, err := insertPostgresRevision(ctx, db, postgresRevision{
				id: "revision-duplicate-draft", templateID: "template-a", status: "draft",
			})
			return err
		})
		assertPostgresErrorCode(t, "23505", func() error {
			_, err := insertPostgresRevision(ctx, db, postgresRevision{
				id: "revision-duplicate-published", templateID: "template-a", status: "published",
				number: intPtr(4), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime),
			})
			return err
		})
		assertPostgresErrorCode(t, "23505", func() error {
			_, err := insertPostgresRevision(ctx, db, postgresRevision{
				id: "revision-duplicate-number", templateID: "template-a", status: "retired",
				number: intPtr(1), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime),
			})
			return err
		})
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := insertPostgresRevision(ctx, db, postgresRevision{
				id: "revision-blank-summary", templateID: "template-b", status: "retired",
				number: intPtr(5), summary: strPtr("   "), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime),
			})
			return err
		})
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := insertPostgresRevision(ctx, db, postgresRevision{
				id: "revision-long-summary", templateID: "template-b", status: "retired",
				number: intPtr(5), summary: strPtr(strings.Repeat("x", 121)), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime),
			})
			return err
		})
		if _, err := insertPostgresRevision(ctx, db, postgresRevision{
			id: "revision-retired-two", templateID: "template-a", status: "retired",
			number: intPtr(2), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime),
		}); err != nil {
			t.Fatalf("insert second retired Revision: %v", err)
		}
	})

	t.Run("pillar question and selection references", func(t *testing.T) {
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_pillars (
  id, template_revision_id, slug, name, description, order_key, created_at, updated_at
) VALUES ('pillar-missing-revision', 'missing-revision', 'missing', 'Missing', '', '001', $1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23505", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_pillars (
  id, template_revision_id, slug, name, description, order_key, created_at, updated_at
) VALUES ('pillar-duplicate-slug', 'revision-published', 'reliability', 'Duplicate', '', '002', $1, $1)`, templateRevisionTestTime)
			return err
		})
		if _, err := db.ExecContext(ctx, `
INSERT INTO template_pillars (
  id, template_revision_id, slug, name, description, order_key, created_at, updated_at
) VALUES ('pillar-other-revision', 'revision-published-b', 'reliability', 'Reliability', '', '001', $1, $1)`, templateRevisionTestTime); err != nil {
			t.Fatalf("reuse Pillar slug in another Revision: %v", err)
		}
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO template_questions (
  id, pillar_id, order_key, text, type, risk_level, created_at, updated_at
) VALUES ('question-missing-pillar', 'missing', '001', 'Invalid?', 'yes-no', 'medium', $1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23505", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('review-target', 'revision-published', 1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23505", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('review-target', 'revision-published-b', 0, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('review-target', 'revision-published-b', 3, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23514", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('review-target', 'revision-published-b', -1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('review-target', 'missing-revision', 1, $1)`, templateRevisionTestTime)
			return err
		})
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('missing-review', 'revision-published-c', 2, $1)`, templateRevisionTestTime)
			return err
		})
		if _, err := db.ExecContext(ctx, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES
  ('review-target', 'revision-published-b', 1, $1),
  ('review-target', 'revision-published-c', 2, $1)`, templateRevisionTestTime); err != nil {
			t.Fatalf("insert valid second and third Review selections: %v", err)
		}
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, "DELETE FROM template_revisions WHERE id = 'revision-published'")
			return err
		})
		assertPostgresErrorCode(t, "23503", func() error {
			_, err := db.ExecContext(ctx, "DELETE FROM templates WHERE id = 'template-a'")
			return err
		})

		mustExecPostgres(t, ctx, db, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES (
  'template-delete-free', 'Delete free', '', 'active', 'group-platform',
  'actor-system', 'actor-system', $1, $1
)`, templateRevisionTestTime)
		mustExecPostgres(t, ctx, db, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES (
  'revision-delete-free', 'template-delete-free', 'Draft', '', 'draft',
  'actor-system', 'actor-system', $1, $1
)`, templateRevisionTestTime)
		mustExecPostgres(t, ctx, db, `
INSERT INTO template_pillars (
  id, template_revision_id, slug, name, description, order_key, created_at, updated_at
) VALUES (
  'pillar-delete-free', 'revision-delete-free', 'delete-free', 'Delete free', '', '001', $1, $1
)`, templateRevisionTestTime)
		mustExecPostgres(t, ctx, db, `
INSERT INTO template_questions (
  id, pillar_id, order_key, text, type, risk_level, created_at, updated_at
) VALUES (
  'question-delete-free', 'pillar-delete-free', '001', 'Delete?', 'yes-no', 'medium', $1, $1
)`, templateRevisionTestTime)
		mustExecPostgres(t, ctx, db, "DELETE FROM templates WHERE id = 'template-delete-free'")
		for table, id := range map[string]string{
			"templates":          "template-delete-free",
			"template_revisions": "revision-delete-free",
			"template_pillars":   "pillar-delete-free",
			"template_questions": "question-delete-free",
		} {
			if got := postgresFilteredCount(t, ctx, db, table, "id = '"+id+"'"); got != 0 {
				t.Errorf("cascade delete left %s row %s", table, id)
			}
		}
	})

	assertPostgresCompositeSelectionKey(t, ctx, db)
	assertPostgresQuestionOwnership(t, ctx, db)
	assertPostgresIntegerColumn(t, ctx, db, "template_revisions", "revision_number")
	assertPostgresIntegerColumn(t, ctx, db, "review_template_selections", "position")
}

type postgresRevision struct {
	id          string
	templateID  string
	status      string
	number      *int
	summary     *string
	publisher   *string
	publishedAt *string
}

func seedPostgresTemplateRevisionConstraintState(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	mustExecPostgres(t, ctx, db, `
INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
VALUES ('subject-target', 'product', 'Target', 'target', 'active', $1, $1)`, templateRevisionTestTime)
	for _, id := range []string{"template-a", "template-b", "template-c", "template-d"} {
		mustExecPostgres(t, ctx, db, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES ($1, $2, '', 'active', 'group-platform', 'actor-system', 'actor-system', $3, $3)`, id, id, templateRevisionTestTime)
	}
	mustExecPostgres(t, ctx, db, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES (
  'template-archived', 'Archived', '', 'archived', 'group-platform',
  'actor-system', 'actor-system', $1, $1
)`, templateRevisionTestTime)
	for _, revision := range []postgresRevision{
		{id: "revision-draft", templateID: "template-a", status: "draft"},
		{id: "revision-published", templateID: "template-a", status: "published", number: intPtr(1), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime)},
		{id: "revision-retired", templateID: "template-a", status: "retired", number: intPtr(3), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime)},
		{id: "revision-published-b", templateID: "template-b", status: "published", number: intPtr(1), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime)},
		{id: "revision-published-c", templateID: "template-c", status: "published", number: intPtr(1), summary: strPtr(strings.Repeat("x", 120)), publisher: strPtr("actor-system"), publishedAt: strPtr(templateRevisionTestTime)},
	} {
		if _, err := insertPostgresRevision(ctx, db, revision); err != nil {
			t.Fatalf("insert baseline Revision %s: %v", revision.id, err)
		}
	}
	mustExecPostgres(t, ctx, db, `
INSERT INTO template_pillars (
  id, template_revision_id, slug, name, description, order_key, created_at, updated_at
) VALUES ('pillar-target', 'revision-published', 'reliability', 'Reliability', '', '001', $1, $1)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO template_questions (
  id, pillar_id, order_key, text, type, risk_level, created_at, updated_at
) VALUES ('question-target', 'pillar-target', '001', 'Is failover tested?', 'yes-no', 'medium', $1, $1)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
VALUES ('review-target', 'subject-target', 'Target Review', 'draft', $1, $1)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO review_template_selections (review_id, template_revision_id, position, created_at)
VALUES ('review-target', 'revision-published', 0, $1)`, templateRevisionTestTime)
}

func insertPostgresRevision(ctx context.Context, db *sql.DB, revision postgresRevision) (sql.Result, error) {
	return db.ExecContext(ctx, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, revision_number, revision_summary,
  created_by_actor_id, updated_by_actor_id, published_by_actor_id,
  created_at, updated_at, published_at
) VALUES ($1, $2, $1, '', $3, $4, $5, 'actor-system', 'actor-system', $6, $7, $7, $8)`,
		revision.id,
		revision.templateID,
		revision.status,
		revision.number,
		revision.summary,
		revision.publisher,
		templateRevisionTestTime,
		revision.publishedAt,
	)
}

func assertPostgresErrorCode(t *testing.T, want string, operation func() error) {
	t.Helper()
	err := operation()
	if err == nil {
		t.Fatalf("operation succeeded; want PostgreSQL error %s", want)
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		t.Fatalf("operation returned %T; want *pgconn.PgError: %v", err, err)
	}
	if pgErr.Code != want {
		t.Fatalf("PostgreSQL error code = %s, want %s: %v", pgErr.Code, want, pgErr)
	}
}

func assertPostgresCompositeSelectionKey(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	var definition string
	if err := db.QueryRowContext(ctx, `
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'review_template_selections'::regclass
  AND contype = 'p'`).Scan(&definition); err != nil {
		t.Fatalf("read Review selection primary key: %v", err)
	}
	if definition != "PRIMARY KEY (review_id, template_revision_id)" {
		t.Fatalf("Review selection primary key = %q", definition)
	}

	var deleteType string
	if err := db.QueryRowContext(ctx, `
SELECT confdeltype::text
FROM pg_constraint
WHERE conrelid = 'review_template_selections'::regclass
  AND contype = 'f'
  AND pg_get_constraintdef(oid) LIKE '%template_revision_id%'`).Scan(&deleteType); err != nil {
		t.Fatalf("read Review selection Revision FK: %v", err)
	}
	if deleteType != "r" {
		t.Fatalf("Review selection Revision FK delete type = %q, want restrict", deleteType)
	}
}

func assertPostgresQuestionOwnership(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	var revisionColumns int
	if err := db.QueryRowContext(ctx, `
SELECT count(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'template_questions'
  AND column_name = 'template_revision_id'`).Scan(&revisionColumns); err != nil {
		t.Fatalf("read Template Question ownership columns: %v", err)
	}
	if revisionColumns != 0 {
		t.Fatalf("template_questions has %d redundant Revision columns, want 0", revisionColumns)
	}
}

func assertPostgresIntegerColumn(t *testing.T, ctx context.Context, db *sql.DB, table, column string) {
	t.Helper()
	var dataType string
	if err := db.QueryRowContext(ctx, `
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, table, column).Scan(&dataType); err != nil {
		t.Fatalf("read %s.%s data type: %v", table, column, err)
	}
	if dataType != "integer" {
		t.Fatalf("%s.%s data type = %q, want integer", table, column, dataType)
	}
}

func publicationValues(columns string) string {
	switch columns {
	case "published_at, published_by_actor_id":
		return "$1, 'actor-system'"
	case "revision_number, published_by_actor_id":
		return "1, 'actor-system'"
	case "revision_number, published_at":
		return "1, $1"
	default:
		panic("unexpected publication columns")
	}
}

func intPtr(value int) *int       { return &value }
func strPtr(value string) *string { return &value }
