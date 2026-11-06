package dbmigrate

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"sort"
)

//go:embed seed/*.sql
var seedFS embed.FS

// Seed inserts demo data into the database. All SQL files under seed/ are
// run in lexical order. Every statement must be idempotent (ON CONFLICT DO
// NOTHING) so Seed can be called multiple times without duplicating rows.
//
// This intentionally does not use goose — seed data is not a versioned schema
// migration. It is declarative fixture data that should be re-applicable at
// any time.
func Seed(ctx context.Context, db *sql.DB) error {
	entries, err := seedFS.ReadDir("seed")
	if err != nil {
		return fmt.Errorf("read seed dir: %w", err)
	}

	// Sort by filename to guarantee deterministic execution order.
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		sql, err := seedFS.ReadFile("seed/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read seed file %s: %w", entry.Name(), err)
		}

		if _, err := db.ExecContext(ctx, string(sql)); err != nil {
			return fmt.Errorf("run seed %s: %w", entry.Name(), err)
		}
	}
	return nil
}
