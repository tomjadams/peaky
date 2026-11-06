// peaky-ctl is the management CLI for the Peaky sync backend.
//
// Runs as a one-shot container in CI/CD pipelines and local development.
// Lives in a separate Docker image (Dockerfile.peaky-ctl) — it is never
// bundled into the production peaky-api Lambda image.
//
// Commands:
//
//	peaky-ctl migrate   — run pending goose migrations, then exit 0/1
//	peaky-ctl seed      — insert idempotent demo data (local dev only), then exit 0/1
//
// Environment variables:
//
//	PG_DSN       PostgreSQL connection string
//	ACTORS_FILE  Path to actors.json
//	LOG_LEVEL    debug | info | warn | error  (default: info)
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/peaky-team/peaky/services/internal/app"
	"github.com/peaky-team/peaky/services/internal/dbmigrate"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: peaky-ctl <migrate|seed>")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "migrate":
		runMigrate()
	case "seed":
		runSeed()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\nusage: peaky-ctl <migrate|seed>\n", os.Args[1])
		os.Exit(1)
	}
}

func runMigrate() {
	app.InitLogger()
	cfg := app.ConfigFromEnv()

	db, err := app.OpenDB(cfg)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close() }()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	if err := dbmigrate.Up(ctx, db); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations applied")
}

func runSeed() {
	app.InitLogger()
	if os.Getenv("ALLOW_SEED") != "true" {
		slog.Error("seed is disabled; set ALLOW_SEED=true to run it")
		os.Exit(1)
	}
	cfg := app.ConfigFromEnv()

	db, err := app.OpenDB(cfg)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close() }()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := dbmigrate.Seed(ctx, db); err != nil {
		slog.Error("seed failed", "error", err)
		os.Exit(1)
	}
	slog.Info("seed applied")
}
