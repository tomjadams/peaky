// Package dbmigrate embeds and runs goose PostgreSQL migrations.
// Migrations live in ./migrations/ relative to this file — valid for embed.
package dbmigrate

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"

	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Up runs all pending migrations. Safe to call on every startup — goose
// tracks applied migrations in the goose_db_version table and is a no-op
// when everything is already up to date.
func Up(ctx context.Context, db *sql.DB) error {
	// goose.NewProvider expects the FS root to contain migration files directly,
	// but embed.FS preserves the full path ("migrations/001_initial.sql").
	// fs.Sub gives goose a view rooted at "migrations/" so it sees *.sql at the root.
	subFS, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("migrations sub-fs: %w", err)
	}

	provider, err := goose.NewProvider(goose.DialectPostgres, db, subFS)
	if err != nil {
		return fmt.Errorf("goose provider: %w", err)
	}

	results, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("goose up: %w", err)
	}

	for _, r := range results {
		if r.Error != nil {
			return fmt.Errorf("migration %s: %w", r.Source.Path, r.Error)
		}
	}

	return nil
}
