//go:build integration

package dbmigrate

import (
	"context"
	"database/sql"
	"testing"

	"github.com/peaky-team/peaky/services/internal/testhelper"
)

const maturityDefinitionMigrationVersion int64 = 9

// The maturity definition column stores one schema-versioned JSON document
// per Template Revision (maturity-score/REQ-009); NULL is the explicit
// no-definition state (AC-060) and existing rows are never backfilled by the
// migration itself.
func TestMaturityDefinitionColumn(t *testing.T) {
	t.Run("fresh desired schema", func(t *testing.T) {
		ctx := context.Background()
		db := testhelper.StartPostgres(t)
		assertMaturityDefinitionColumn(t, ctx, db)
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
		if maturityDefinitionColumnExists(t, ctx, db) {
			t.Fatal("maturity_definition exists before migration 009")
		}

		if _, err := provider.UpTo(ctx, maturityDefinitionMigrationVersion); err != nil {
			t.Fatalf("apply migration 009: %v", err)
		}
		assertMaturityDefinitionColumn(t, ctx, db)

		if _, err := provider.Down(ctx); err != nil {
			t.Fatalf("rollback migration 009: %v", err)
		}
		if maturityDefinitionColumnExists(t, ctx, db) {
			t.Fatal("maturity_definition still exists after Down")
		}
	})
}

func assertMaturityDefinitionColumn(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	var dataType string
	var nullable string
	if err := db.QueryRowContext(ctx, `
SELECT data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'template_revisions'
  AND column_name = 'maturity_definition'`).Scan(&dataType, &nullable); err != nil {
		t.Fatalf("read maturity_definition column: %v", err)
	}
	if dataType != "jsonb" {
		t.Fatalf("maturity_definition data type = %q, want jsonb", dataType)
	}
	if nullable != "YES" {
		t.Fatalf("maturity_definition nullable = %q, want YES", nullable)
	}

	// JSONB round trip: a stored document reads back unchanged, and rows
	// without a definition stay NULL (the explicit no-definition state).
	mustExecPostgres(t, ctx, db, `
INSERT INTO templates (
  id, name, description, status, owner_team_id, created_by_actor_id,
  updated_by_actor_id, created_at, updated_at
) VALUES (
  'template-maturity', 'Maturity', '', 'active', 'group-platform',
  'actor-system', 'actor-system', $1, $1
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO template_revisions (
  id, template_id, name, description, status, revision_number,
  created_by_actor_id, updated_by_actor_id, published_by_actor_id,
  created_at, updated_at, published_at, maturity_definition
) VALUES (
  'revision-with-definition', 'template-maturity', 'With definition', '',
  'published', 1, 'actor-system', 'actor-system', 'actor-system',
  $1, $1, $1, '{"schemaVersion": 1}'::jsonb
), (
  'revision-without-definition', 'template-maturity', 'Without definition', '',
  'retired', 2, 'actor-system', 'actor-system', 'actor-system',
  $1, $1, $1, NULL
)`, templateRevisionTestTime)

	var stored string
	if err := db.QueryRowContext(ctx, `
SELECT maturity_definition::text
FROM template_revisions
WHERE id = 'revision-with-definition'`).Scan(&stored); err != nil {
		t.Fatalf("read stored maturity definition: %v", err)
	}
	if stored != `{"schemaVersion": 1}` {
		t.Fatalf("stored maturity definition = %q", stored)
	}
	var missing *string
	if err := db.QueryRowContext(ctx, `
SELECT maturity_definition::text
FROM template_revisions
WHERE id = 'revision-without-definition'`).Scan(&missing); err != nil {
		t.Fatalf("read NULL maturity definition: %v", err)
	}
	if missing != nil {
		t.Fatalf("NULL maturity definition read back as %q", *missing)
	}

	// Malformed JSON is rejected by the JSONB type itself.
	assertPostgresErrorCode(t, "22P02", func() error {
		_, err := db.ExecContext(ctx, `
UPDATE template_revisions
SET maturity_definition = 'not json'::jsonb
WHERE id = 'revision-with-definition'`)
		return err
	})
}

func maturityDefinitionColumnExists(t *testing.T, ctx context.Context, db *sql.DB) bool {
	t.Helper()
	var count int
	if err := db.QueryRowContext(ctx, `
SELECT count(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'template_revisions'
  AND column_name = 'maturity_definition'`).Scan(&count); err != nil {
		t.Fatalf("count maturity_definition columns: %v", err)
	}
	return count == 1
}
