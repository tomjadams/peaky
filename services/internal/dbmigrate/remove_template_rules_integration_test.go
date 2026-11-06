//go:build integration

package dbmigrate

import (
	"context"
	"io/fs"
	"testing"

	"github.com/pressly/goose/v3"

	"github.com/peaky-team/peaky/services/internal/testhelper"
)

func TestRemoveTemplateRulesMigration(t *testing.T) {
	ctx := context.Background()
	db := testhelper.StartPostgres(t)

	if _, err := db.ExecContext(ctx, "DROP SCHEMA public CASCADE; CREATE SCHEMA public"); err != nil {
		t.Fatalf("reset schema: %v", err)
	}

	subFS, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		t.Fatalf("migration fs: %v", err)
	}
	provider, err := goose.NewProvider(goose.DialectPostgres, db, subFS)
	if err != nil {
		t.Fatalf("goose provider: %v", err)
	}
	defer func() { _ = provider.Close() }()

	if _, err := provider.UpTo(ctx, 6); err != nil {
		t.Fatalf("apply migrations through 006: %v", err)
	}

	const now = "2026-08-13T00:00:00Z"
	seedTx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin seed transaction: %v", err)
	}
	defer func() { _ = seedTx.Rollback() }()

	seedStatements := []string{
		`INSERT INTO templates (id, name, description, status, created_at, updated_at, published_at)
VALUES ('template-1', 'Template', '', 'active', $1, $1, $1)`,
		`INSERT INTO template_versions (id, template_id, version_label, status, created_at, published_at)
VALUES ('version-1', 'template-1', 'v1', 'active', $1, $1)`,
		`INSERT INTO template_pillars (
  id, template_version_id, slug, name, description, order_key, created_at, updated_at
) VALUES ('pillar-1', 'version-1', 'reliability', 'Reliability', '', '001', $1, $1)`,
		`INSERT INTO template_questions (
  id, pillar_id, order_key, text, type, risk_level, importance,
  checklist_items, leading_practices, helpful_links, created_at, updated_at
) VALUES (
  'question-1', 'pillar-1', '001', 'Is failover tested?', 'yes-no', 'medium', '',
  '[]', '[]', '[]', $1, $1
)`,
		`INSERT INTO template_rules (
  id, pillar_id, name, conditions, condition_groups, action, position, created_at, updated_at
) VALUES ('rule-1', 'pillar-1', 'Escalate', '[]', '[]', '{}', '{}', $1, $1)`,
	}
	for _, statement := range seedStatements {
		if _, err := seedTx.ExecContext(ctx, statement, now); err != nil {
			t.Fatalf("seed template hierarchy: %v", err)
		}
	}
	if err := seedTx.Commit(); err != nil {
		t.Fatalf("commit seed transaction: %v", err)
	}

	if _, err := provider.UpTo(ctx, 7); err != nil {
		t.Fatalf("apply migration 007: %v", err)
	}

	var ruleTable string
	if err := db.QueryRowContext(
		ctx,
		"SELECT COALESCE(to_regclass('public.template_rules')::text, '')",
	).Scan(&ruleTable); err != nil {
		t.Fatalf("lookup template_rules: %v", err)
	}
	if ruleTable != "" {
		t.Fatalf("template_rules still exists after migration 007: %s", ruleTable)
	}

	var templateCount, versionCount, pillarCount, questionCount int
	if err := db.QueryRowContext(ctx, `
SELECT
  (SELECT count(*) FROM templates),
  (SELECT count(*) FROM template_versions),
  (SELECT count(*) FROM template_pillars),
  (SELECT count(*) FROM template_questions)
`).Scan(&templateCount, &versionCount, &pillarCount, &questionCount); err != nil {
		t.Fatalf("count preserved Template rows: %v", err)
	}
	for name, count := range map[string]int{
		"templates":          templateCount,
		"template_versions":  versionCount,
		"template_pillars":   pillarCount,
		"template_questions": questionCount,
	} {
		if count != 1 {
			t.Fatalf("%s rows changed: got %d, want 1", name, count)
		}
	}

	var templateName, versionLabel, pillarName, questionText string
	if err := db.QueryRowContext(ctx, `
SELECT t.name, tv.version_label, tp.name, tq.text
FROM templates t
JOIN template_versions tv ON tv.template_id = t.id
JOIN template_pillars tp ON tp.template_version_id = tv.id
JOIN template_questions tq ON tq.pillar_id = tp.id
WHERE t.id = 'template-1'
`).Scan(&templateName, &versionLabel, &pillarName, &questionText); err != nil {
		t.Fatalf("read preserved Template hierarchy: %v", err)
	}
	if templateName != "Template" || versionLabel != "v1" || pillarName != "Reliability" || questionText != "Is failover tested?" {
		t.Fatalf(
			"preserved Template hierarchy changed: got %q, %q, %q, %q",
			templateName,
			versionLabel,
			pillarName,
			questionText,
		)
	}

	if _, err := provider.Down(ctx); err != nil {
		t.Fatalf("rollback migration 007: %v", err)
	}
	if err := db.QueryRowContext(
		ctx,
		"SELECT COALESCE(to_regclass('public.template_rules')::text, '')",
	).Scan(&ruleTable); err != nil {
		t.Fatalf("lookup restored template_rules: %v", err)
	}
	if ruleTable != "template_rules" {
		t.Fatalf("template_rules not restored by Down: %q", ruleTable)
	}

	var restoredRuleCount int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM template_rules").Scan(&restoredRuleCount); err != nil {
		t.Fatalf("count restored template_rules: %v", err)
	}
	if restoredRuleCount != 0 {
		t.Fatalf("Down claimed to restore deleted Rules rows: got %d", restoredRuleCount)
	}
}
