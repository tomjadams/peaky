//go:build integration

package dbmigrate

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"slices"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"

	"github.com/peaky-team/peaky/services/internal/testhelper"
)

const templateRevisionMigrationVersion int64 = 8
const templateRevisionTestTime = "2026-08-18T00:00:00Z"

var templateRevisionResetEntityTypes = []string{
	"review",
	"review_checkpoint",
	"review_answer",
	"review_note",
	"review_attachment",
	"template",
	"template_version",
	"template_pillar",
	"template_question",
	"template_draft",
	"template_draft_pillar",
	"template_draft_question",
}

var templateRevisionResetEventTypes = []string{
	"ReviewAnswerRecorded.v1",
	"ReviewCheckpointSaved.v1",
	"ReviewNoteRecorded.v1",
	"ReviewNoteDeleted.v1",
	"ReviewAttachmentUploaded.v1",
	"ReviewAttachmentDeleted.v1",
	"ReviewProgressUpdated.v1",
	"ReviewCreated.v1",
	"ReviewArchived.v1",
	"ReviewRestored.v1",
	"ReviewDeleted.v1",
	"TemplateDraftCreated.v1",
	"TemplateDraftUpdated.v1",
	"TemplateDraftDeleted.v1",
	"TemplatePublished.v1",
	"TemplateImported.v1",
	"TemplatePillarCreated.v1",
	"TemplatePillarUpdated.v1",
	"TemplatePillarDeleted.v1",
	"TemplateQuestionCreated.v1",
	"TemplateQuestionUpdated.v1",
	"TemplateQuestionDeleted.v1",
}

func TestTemplateRevisionMigrationResetsDomainAndPreservesUnrelatedData(t *testing.T) {
	ctx := context.Background()
	db := testhelper.StartPostgres(t)
	resetPostgresSchema(t, ctx, db)
	provider := newTemplateRevisionMigrationProvider(t, db)
	defer func() { _ = provider.Close() }()

	if _, err := provider.UpTo(ctx, 7); err != nil {
		t.Fatalf("apply migrations through 007: %v", err)
	}
	seedPostgresTemplateRevisionLegacyState(t, ctx, db)
	legacySchemaBefore := readPostgresLegacySchemaFacts(t, ctx, db)
	preservedRowsBefore := readPostgresPreservedRowSnapshots(t, ctx, db)
	if len(preservedRowsBefore) != 11 {
		t.Fatalf("preserved PostgreSQL fixture has %d rows, want 11", len(preservedRowsBefore))
	}
	gooseRowsBefore := readGooseHistorySnapshots(t, ctx, db)
	if len(gooseRowsBefore) != 7 {
		t.Fatalf("Goose history fixture has %d rows, want 7", len(gooseRowsBefore))
	}

	if _, err := provider.UpTo(ctx, templateRevisionMigrationVersion); err != nil {
		t.Fatalf("apply migration 008: %v", err)
	}
	if got := currentGooseVersion(t, ctx, db); got != templateRevisionMigrationVersion {
		t.Fatalf("current Goose version = %d, want %d", got, templateRevisionMigrationVersion)
	}
	assertGooseHistoryThroughSeven(t, ctx, db)
	assertPostgresSnapshots(t, "preserved rows after Up", readPostgresPreservedRowSnapshots(t, ctx, db), preservedRowsBefore)
	assertPostgresSnapshots(t, "Goose history after Up", readGooseHistorySnapshots(t, ctx, db), gooseRowsBefore)

	for _, table := range []string{
		"templates",
		"template_revisions",
		"template_pillars",
		"template_questions",
		"reviews",
		"review_template_selections",
		"review_answer_state",
		"review_note_state",
		"review_attachments",
		"review_score_state",
		"review_participants",
		"draft_answer_imports",
		"draft_answer_evidence",
	} {
		if !postgresRelationExists(t, ctx, db, table) {
			t.Errorf("target relation %s does not exist", table)
			continue
		}
		if got := postgresRowCount(t, ctx, db, table); got != 0 {
			t.Errorf("%s rows after reset = %d, want 0", table, got)
		}
	}
	if postgresRelationExists(t, ctx, db, "template_versions") {
		t.Error("legacy template_versions still exists")
	}

	assertPostgresResetOperationalRows(t, ctx, db)

	if _, err := provider.Down(ctx); err != nil {
		t.Fatalf("rollback migration 008: %v", err)
	}
	if got := currentGooseVersion(t, ctx, db); got != 7 {
		t.Fatalf("current Goose version after Down = %d, want 7", got)
	}
	assertGooseHistoryThroughSeven(t, ctx, db)
	if got := readPostgresLegacySchemaFacts(t, ctx, db); !slices.Equal(got, legacySchemaBefore) {
		t.Fatalf("Down did not restore the exact Goose-007 schema\ngot:  %v\nwant: %v", got, legacySchemaBefore)
	}
	assertPostgresSnapshots(t, "preserved rows after Down", readPostgresPreservedRowSnapshots(t, ctx, db), preservedRowsBefore)
	assertPostgresSnapshots(t, "Goose history after Down", readGooseHistorySnapshots(t, ctx, db), gooseRowsBefore)
	if postgresRelationExists(t, ctx, db, "template_revisions") {
		t.Error("template_revisions still exists after Down")
	}
	if !postgresRelationExists(t, ctx, db, "template_versions") {
		t.Fatal("legacy template_versions was not restored by Down")
	}
	for _, table := range []string{
		"templates",
		"template_versions",
		"template_pillars",
		"template_questions",
		"reviews",
		"review_template_selections",
	} {
		if got := postgresRowCount(t, ctx, db, table); got != 0 {
			t.Errorf("%s rows restored by Down = %d, want 0", table, got)
		}
	}
}

func TestTemplateRevisionMigrationFailsOnUnexpectedDependency(t *testing.T) {
	ctx := context.Background()
	db := testhelper.StartPostgres(t)
	resetPostgresSchema(t, ctx, db)
	provider := newTemplateRevisionMigrationProvider(t, db)
	defer func() { _ = provider.Close() }()

	if _, err := provider.UpTo(ctx, 7); err != nil {
		t.Fatalf("apply migrations through 007: %v", err)
	}
	mustExecPostgres(t, ctx, db, `
INSERT INTO templates (id, name, description, status, created_at, updated_at, published_at)
VALUES ('template-unexpected', 'Unexpected dependency', '', 'active', $1, $1, $1)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
CREATE TABLE unexpected_template_reference (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE RESTRICT
)`)
	mustExecPostgres(t, ctx, db, `
INSERT INTO unexpected_template_reference (id, template_id)
VALUES ('unexpected-reference', 'template-unexpected')`)

	_, err := provider.UpTo(ctx, templateRevisionMigrationVersion)
	if err == nil {
		if got := currentGooseVersion(t, ctx, db); got != templateRevisionMigrationVersion {
			t.Fatalf("migration 008 is not embedded or applied: current version = %d", got)
		}
		t.Fatal("migration 008 succeeded despite an unknown restrictive dependency")
	}
	if !strings.Contains(err.Error(), "unexpected_template_reference") {
		t.Fatalf("migration failure did not identify the unknown dependency: %v", err)
	}
	if got := currentGooseVersion(t, ctx, db); got != 7 {
		t.Fatalf("failed migration changed Goose version to %d, want 7", got)
	}
	if got := postgresRowCount(t, ctx, db, "unexpected_template_reference"); got != 1 {
		t.Fatalf("failed migration changed unexpected dependency rows: got %d, want 1", got)
	}
}

func newTemplateRevisionMigrationProvider(t *testing.T, db *sql.DB) *goose.Provider {
	t.Helper()
	subFS, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		t.Fatalf("migration fs: %v", err)
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, db, subFS)
	if err != nil {
		t.Fatalf("goose provider: %v", err)
	}
	return provider
}

func resetPostgresSchema(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	if _, err := db.ExecContext(ctx, "DROP SCHEMA public CASCADE; CREATE SCHEMA public"); err != nil {
		t.Fatalf("reset schema: %v", err)
	}
}

func seedPostgresTemplateRevisionLegacyState(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	statements := []string{
		`INSERT INTO subjects (id, type, name, slug, status, created_at, updated_at)
VALUES
  ('subject-team', 'team', 'Platform', 'platform', 'active', $1, $1),
  ('subject-product', 'product', 'Payments', 'payments', 'active', $1, $1)`,
		`INSERT INTO subject_component_links (id, subject_id, component_id, relationship_type, created_at)
VALUES ('subject-component', 'subject-product', 'component-1', 'contains', $1)`,
		`INSERT INTO templates (id, name, description, status, created_at, updated_at, published_at)
VALUES ('template-legacy', 'Legacy Template', '', 'active', $1, $1, $1)`,
		`INSERT INTO template_versions (id, template_id, version_label, status, created_at, published_at)
VALUES ('version-legacy', 'template-legacy', 'v1', 'active', $1, $1)`,
		`INSERT INTO template_pillars (
  id, template_version_id, slug, name, description, order_key, created_at, updated_at
) VALUES ('pillar-legacy', 'version-legacy', 'reliability', 'Reliability', '', '001', $1, $1)`,
		`INSERT INTO template_questions (
  id, pillar_id, order_key, text, type, risk_level, importance,
  checklist_items, leading_practices, helpful_links, created_at, updated_at
) VALUES (
  'question-legacy', 'pillar-legacy', '001', 'Is failover tested?', 'yes-no', 'medium', '',
  '[]', '[]', '[]', $1, $1
)`,
		`INSERT INTO reviews (id, subject_id, name, status, created_at, updated_at)
VALUES ('review-legacy', 'subject-product', 'Legacy Review', 'draft', $1, $1)`,
		`INSERT INTO review_template_selections (
  id, review_id, template_version_id, position, created_at
) VALUES ('selection-legacy', 'review-legacy', 'version-legacy', 0, $1)`,
		`INSERT INTO review_answer_state (
  id, review_id, question_id, answer, na_reason, item_na_reasons, updated_at
) VALUES ('answer-legacy', 'review-legacy', 'question-legacy', '"yes"', NULL, NULL, $1)`,
		`INSERT INTO review_note_state (
  id, review_id, scope_type, scope_id, content, updated_at
) VALUES ('note-legacy', 'review-legacy', 'question', 'question-legacy', 'Legacy note', $1)`,
		`INSERT INTO review_attachments (
  id, review_id, scope_type, scope_id, filename, object_key, mime_type, size,
  created_by, created_by_name, created_at
) VALUES (
  'attachment-legacy', 'review-legacy', 'question', 'question-legacy', 'evidence.txt',
  'reviews/legacy/evidence.txt', 'text/plain', 10, 'actor-system', 'System', $1
)`,
		`INSERT INTO review_score_state (
  id, review_id, score_type, numeric_score, band, score_breakdown, computed_at
) VALUES ('score-legacy', 'review-legacy', 'readiness', 80, 'ready', '{}', $1)`,
		`INSERT INTO review_participants (
  id, review_id, actor_id, role, name, email, created_at
) VALUES (
  'participant-legacy', 'review-legacy', 'actor-reviewer', 'reviewer',
  'Reviewer', 'reviewer@example.com', $1
)`,
		`INSERT INTO draft_answer_imports (
  id, review_id, source, run_id, imported_at, actor_id
) VALUES ('answer-import-legacy', 'review-legacy', 'llm', 'run-1', $1, 'actor-system')`,
		`INSERT INTO draft_answer_evidence (
  id, import_id, question_id, answer, confidence, evidence
) VALUES (
  'answer-evidence-legacy', 'answer-import-legacy', 'question-legacy', 'yes', 'high', $1
)`,
		`INSERT INTO sync_cursors (actor_id, cursor_value, updated_at)
VALUES ('actor-reviewer', 'cursor-1', $1)`,
	}
	for _, statement := range statements {
		mustExecPostgres(t, ctx, db, statement, templateRevisionTestTime)
	}
	seedPostgresOperationalState(t, ctx, db)
}

func seedPostgresOperationalState(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	mustExecPostgres(t, ctx, db, `
INSERT INTO events (
  id, specversion, event_type, actor_type, actor_id, data, time, status, source,
  entity_type, entity_id, operation, root_type, root_id
) VALUES (
  'event-product-preserved', '1.0', 'ProductUpdated.v1', 'user', 'actor-system', '{}', $1,
  'synced', 'peaky.client', 'product', 'subject-product', 'upsert', 'product', 'subject-product'
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO events (
  id, specversion, event_type, actor_type, actor_id, data, time, status, source,
  operation, root_type, root_id
) VALUES (
  'event-system-preserved', '1.0', 'ClientSchemaMigrated.v1', 'system', 'actor-system', '{}', $1,
  'synced', 'peaky.system', 'upsert', 'system', 'event-system-preserved'
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO events (
  id, specversion, event_type, actor_type, actor_id, data, time, status, source,
  entity_type, entity_id, operation, root_type, root_id
) VALUES (
  'event-near-match-preserved', '1.0', 'TemplateRevisionCached.v1', 'system', 'actor-system', '{}', $1,
  'synced', 'peaky.system', 'template_revision', 'revision-cache', 'upsert', 'system',
  'event-near-match-preserved'
)`, templateRevisionTestTime)

	for i, entityType := range templateRevisionResetEntityTypes {
		entityID := fmt.Sprintf("%s-legacy", entityType)
		mustExecPostgres(t, ctx, db, `
INSERT INTO events (
  id, specversion, event_type, actor_type, actor_id, data, time, status, source,
  entity_type, entity_id, operation, root_type, root_id
) VALUES ($1, '1.0', 'LegacyEntityTouched.v1', 'user', 'actor-system', '{}', $2,
  'synced', 'peaky.client', $3, $4, 'upsert', 'system', $1)`,
			fmt.Sprintf("event-entity-reset-%d", i), templateRevisionTestTime, entityType, entityID)
		mustExecPostgres(t, ctx, db, `
INSERT INTO field_versions (
  id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at
) VALUES ($1, $2, $3, 'name', '"legacy"', '1000:0001', 'actor-system', $4)`,
			fmt.Sprintf("field-reset-%d", i), entityType, entityID, templateRevisionTestTime)
		mustExecPostgres(t, ctx, db, `
INSERT INTO field_version_events (
  id, event_id, entity_type, entity_id, field_name, value, previous_value,
  hlc, actor_id, updated_at
) VALUES ($1, 'event-product-preserved', $2, $3, $4, '"legacy"', NULL,
  '1000:0001:actor-system', 'actor-system', $5)`,
			fmt.Sprintf("history-reset-%d", i), entityType, entityID, fmt.Sprintf("field-%d", i), templateRevisionTestTime)
	}

	for i, eventType := range templateRevisionResetEventTypes {
		mustExecPostgres(t, ctx, db, `
INSERT INTO events (
  id, specversion, event_type, actor_type, actor_id, data, time, status, source,
  operation, root_type, root_id
) VALUES ($1, '1.0', $2, 'user', 'actor-system', '{}', $3,
  'synced', 'peaky.client', 'upsert', 'system', $1)`,
			fmt.Sprintf("event-type-reset-%d", i), eventType, templateRevisionTestTime)
	}
	mustExecPostgres(t, ctx, db, `
INSERT INTO events (
  id, specversion, review_id, event_type, actor_type, actor_id, data, time, status,
  source, operation, root_type, root_id
) VALUES (
  'event-review-id-reset', '1.0', 'review-legacy', 'LegacyReviewTouched.v1', 'user',
  'actor-system', '{}', $1, 'synced', 'peaky.client', 'upsert', 'review', 'review-legacy'
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO field_versions (
  id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at
) VALUES (
  'field-product-preserved', 'product', 'subject-product', 'name', '"Payments"',
  '1000:0001', 'actor-system', $1
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO field_version_events (
  id, event_id, entity_type, entity_id, field_name, value, previous_value,
  hlc, actor_id, updated_at
) VALUES (
  'history-product-preserved', 'event-product-preserved', 'product', 'subject-product',
  'name', '"Payments"', NULL, '1000:0001:actor-system', 'actor-system', $1
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO field_versions (
  id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at
) VALUES (
  'field-near-match-preserved', 'template_revision', 'revision-cache', 'name', '"Cached"',
  '1000:0001', 'actor-system', $1
)`, templateRevisionTestTime)
	mustExecPostgres(t, ctx, db, `
INSERT INTO field_version_events (
  id, event_id, entity_type, entity_id, field_name, value, previous_value,
  hlc, actor_id, updated_at
) VALUES (
  'history-near-match-preserved', 'event-near-match-preserved', 'template_revision',
  'revision-cache', 'name', '"Cached"', NULL, '1000:0001:actor-system', 'actor-system', $1
)`, templateRevisionTestTime)
}

func assertPostgresResetOperationalRows(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	quotedEntityTypes := make([]string, len(templateRevisionResetEntityTypes))
	for i, entityType := range templateRevisionResetEntityTypes {
		quotedEntityTypes[i] = fmt.Sprintf("'%s'", entityType)
	}
	where := fmt.Sprintf("entity_type IN (%s)", strings.Join(quotedEntityTypes, ","))
	for _, table := range []string{"events", "field_versions", "field_version_events"} {
		if got := postgresFilteredCount(t, ctx, db, table, where); got != 0 {
			t.Errorf("%s reset entity rows = %d, want 0", table, got)
		}
	}
	if got := postgresFilteredCount(t, ctx, db, "events", "review_id IS NOT NULL"); got != 0 {
		t.Errorf("events with review_id after reset = %d, want 0", got)
	}
	quotedEventTypes := make([]string, len(templateRevisionResetEventTypes))
	for i, eventType := range templateRevisionResetEventTypes {
		quotedEventTypes[i] = fmt.Sprintf("'%s'", eventType)
	}
	where = fmt.Sprintf("event_type IN (%s)", strings.Join(quotedEventTypes, ","))
	if got := postgresFilteredCount(t, ctx, db, "events", where); got != 0 {
		t.Errorf("events with reset event types = %d, want 0", got)
	}
}

func readPostgresPreservedRowSnapshots(t *testing.T, ctx context.Context, db *sql.DB) []string {
	t.Helper()
	return readPostgresStringRows(t, ctx, db, `
SELECT fact
FROM (
  SELECT 'subjects|' || row_to_json(s)::text AS fact FROM subjects s
  UNION ALL
  SELECT 'subject_component_links|' || row_to_json(l)::text FROM subject_component_links l
  UNION ALL
  SELECT 'sync_cursors|' || row_to_json(c)::text FROM sync_cursors c
  UNION ALL
  SELECT 'events|' || row_to_json(e)::text
  FROM events e
  WHERE id IN ('event-product-preserved', 'event-system-preserved', 'event-near-match-preserved')
  UNION ALL
  SELECT 'field_versions|' || row_to_json(f)::text
  FROM field_versions f
  WHERE id IN ('field-product-preserved', 'field-near-match-preserved')
  UNION ALL
  SELECT 'field_version_events|' || row_to_json(f)::text
  FROM field_version_events f
  WHERE id IN ('history-product-preserved', 'history-near-match-preserved')
) snapshots
ORDER BY fact`)
}

func readGooseHistorySnapshots(t *testing.T, ctx context.Context, db *sql.DB) []string {
	t.Helper()
	return readPostgresStringRows(t, ctx, db, `
SELECT row_to_json(g)::text
FROM goose_db_version g
WHERE version_id BETWEEN 1 AND 7
ORDER BY id`)
}

func assertPostgresSnapshots(t *testing.T, label string, got, want []string) {
	t.Helper()
	if !slices.Equal(got, want) {
		t.Fatalf("%s changed\ngot:  %v\nwant: %v", label, got, want)
	}
}

func readPostgresStringRows(t *testing.T, ctx context.Context, db *sql.DB, query string) []string {
	t.Helper()
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		t.Fatalf("read PostgreSQL snapshot rows: %v", err)
	}
	defer rows.Close()

	var values []string
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			t.Fatalf("scan PostgreSQL snapshot row: %v", err)
		}
		values = append(values, value)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate PostgreSQL snapshot rows: %v", err)
	}
	return values
}

func readPostgresLegacySchemaFacts(t *testing.T, ctx context.Context, db *sql.DB) []string {
	t.Helper()
	rows, err := db.QueryContext(ctx, `
WITH affected_tables(table_name) AS (
  VALUES
    ('templates'), ('template_versions'), ('template_pillars'), ('template_questions'),
    ('reviews'), ('review_template_selections'), ('review_answer_state'),
    ('review_note_state'), ('review_attachments'), ('review_score_state'),
    ('review_participants'), ('draft_answer_imports'), ('draft_answer_evidence')
)
SELECT fact
FROM (
  SELECT concat_ws('|', 'column', c.table_name, c.ordinal_position::text, c.column_name,
    c.data_type, c.is_nullable, COALESCE(c.column_default, '')) AS fact
  FROM information_schema.columns c
  JOIN affected_tables a USING (table_name)
  WHERE c.table_schema = 'public'
  UNION ALL
  SELECT concat_ws('|', 'constraint', cls.relname, con.conname, pg_get_constraintdef(con.oid))
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN affected_tables a ON a.table_name = cls.relname
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
  UNION ALL
  SELECT concat_ws('|', 'index', i.tablename, i.indexname, i.indexdef)
  FROM pg_indexes i
  JOIN affected_tables a ON a.table_name = i.tablename
  WHERE i.schemaname = 'public'
) facts
ORDER BY fact`)
	if err != nil {
		t.Fatalf("read Goose-007 schema facts: %v", err)
	}
	defer rows.Close()

	var facts []string
	for rows.Next() {
		var fact string
		if err := rows.Scan(&fact); err != nil {
			t.Fatalf("scan Goose-007 schema fact: %v", err)
		}
		facts = append(facts, fact)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate Goose-007 schema facts: %v", err)
	}
	return facts
}

func assertGooseHistoryThroughSeven(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	var count int
	if err := db.QueryRowContext(ctx, `
SELECT count(DISTINCT version_id)
FROM goose_db_version
WHERE is_applied AND version_id BETWEEN 1 AND 7`).Scan(&count); err != nil {
		t.Fatalf("read preserved Goose history: %v", err)
	}
	if count != 7 {
		t.Fatalf("applied Goose history through 007 has %d versions, want 7", count)
	}
}

func currentGooseVersion(t *testing.T, ctx context.Context, db *sql.DB) int64 {
	t.Helper()
	var version int64
	if err := db.QueryRowContext(ctx, `
SELECT COALESCE(max(version_id) FILTER (WHERE is_applied), 0)
FROM goose_db_version`).Scan(&version); err != nil {
		t.Fatalf("read Goose version: %v", err)
	}
	return version
}

func postgresRelationExists(t *testing.T, ctx context.Context, db *sql.DB, name string) bool {
	t.Helper()
	var exists bool
	if err := db.QueryRowContext(ctx, `SELECT to_regclass('public.' || $1) IS NOT NULL`, name).Scan(&exists); err != nil {
		t.Fatalf("lookup relation %s: %v", name, err)
	}
	return exists
}

func postgresRowCount(t *testing.T, ctx context.Context, db *sql.DB, table string) int {
	t.Helper()
	return postgresFilteredCount(t, ctx, db, table, "TRUE")
}

func postgresFilteredCount(t *testing.T, ctx context.Context, db *sql.DB, table, where string) int {
	t.Helper()
	var count int
	query := fmt.Sprintf("SELECT count(*) FROM %s WHERE %s", table, where)
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return count
}

func mustExecPostgres(t *testing.T, ctx context.Context, db *sql.DB, statement string, args ...any) {
	t.Helper()
	if _, err := db.ExecContext(ctx, statement, args...); err != nil {
		t.Fatalf("execute PostgreSQL fixture statement: %v\n%s", err, statement)
	}
}
