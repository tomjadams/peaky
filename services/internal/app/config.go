// Package app provides shared helpers used by both the peaky-api server and
// the peaky-ctl management CLI. Kept small on purpose — only the pieces that
// both binaries genuinely need.
package app

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers "pgx" driver for database/sql
)

// Config holds runtime configuration derived from environment variables.
type Config struct {
	Port       string
	DSN        string
	ActorsFile string
	// ProviderHandoffIntegrationEnabled is the private server capability
	// gating any future provider handoff network operation
	// (authorization/REQ-007; AC-021; design Decision 7 of the
	// maturity-score change). It defaults to disabled, is parsed
	// fail-closed (only the exact value "true" enables it), and is never
	// exposed through the client's public runtime config. This change ships
	// no provider adapter, reservation endpoint, or route; the single
	// choke point any future provider operation must pass is
	// authz.ProviderHandoffPolicy.
	ProviderHandoffIntegrationEnabled bool
}

// ConfigFromEnv reads Config from environment variables, applying sensible defaults.
func ConfigFromEnv() Config {
	return Config{
		Port:       EnvOr("PORT", "8080"),
		DSN:        EnvOr("PG_DSN", "*************************************/peaky?sslmode=disable"),
		ActorsFile: EnvOr("ACTORS_FILE", "seed/actors.json"),
		// Fail-closed: anything but exact "true" leaves the capability off.
		ProviderHandoffIntegrationEnabled: os.Getenv("PROVIDER_HANDOFF_INTEGRATION_ENABLED") == "true",
	}
}

// OpenDB opens and pings a *sql.DB connection pool tuned for Lambda/container use.
// MaxOpenConns=2: Lambda instances handle one concurrent request each; a small pool
// avoids exhausting PostgreSQL on fan-out while allowing a background health check.
func OpenDB(cfg Config) (*sql.DB, error) {
	db, err := sql.Open("pgx", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}

	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("db ping: %w", err)
	}

	return db, nil
}

// InitLogger configures the global slog logger to emit structured JSON.
func InitLogger() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: LogLevel()})))
}

// LogLevel returns the slog level derived from the LOG_LEVEL environment variable.
func LogLevel() slog.Level {
	switch os.Getenv("LOG_LEVEL") {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// EnvOr returns the value of the environment variable key, or fallback if unset/empty.
func EnvOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
