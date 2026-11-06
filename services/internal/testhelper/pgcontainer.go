//go:build integration

// Package testhelper provides shared test infrastructure.
//
// StartPostgres returns a *sql.DB connected to an isolated PostgreSQL
// database with schema.sql applied. Two modes:
//
//  1. PG_TEST_DSN set (GitLab CI) — connects directly to a sidecar
//     provided by GitLab services. No Docker needed in the job.
//  2. PG_TEST_DSN unset (local dev) — spins up a throwaway container
//     via testcontainers-go. Set PEAKY_TEST_PG_IMAGE for internal
//     registries; defaults to postgres:17-alpine. Set
//     TESTCONTAINERS_RYUK_DISABLED=true where the reaper can't pull.
package testhelper

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

// StartPostgres returns a connected *sql.DB with schema.sql applied.
// If PG_TEST_DSN is set it connects directly (GitLab services sidecar);
// otherwise it starts a testcontainer.
func StartPostgres(t *testing.T) *sql.DB {
	t.Helper()
	ctx := context.Background()
	schemaSQL := readSchemaSQL(t)

	if dsn := os.Getenv("PG_TEST_DSN"); dsn != "" {
		return connectExternal(t, ctx, dsn, schemaSQL)
	}
	return startContainer(t, ctx, schemaSQL)
}

// connectExternal connects to a pre-existing database (GitLab services sidecar).
func connectExternal(t *testing.T, ctx context.Context, dsn string, schemaSQL []byte) *sql.DB {
	t.Helper()
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open external db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)

	// GitLab services may still be booting; retry until ready.
	for range 30 {
		if err := db.PingContext(ctx); err == nil {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("ping external db: %v", err)
	}

	// Reset the public schema to give each test a clean slate.
	// The GitLab services sidecar is shared across tests in the package,
	// and schema.sql uses plain CREATE TABLE (not IF NOT EXISTS).
	//
	// NOTE: This is NOT safe with t.Parallel() or concurrent packages.
	// Only one integration test package may use PG_TEST_DSN at a time.
	// If parallel execution is needed, switch to per-test database creation
	// or testcontainers instead of a shared sidecar.
	schemaCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if _, err := db.ExecContext(schemaCtx, "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"); err != nil {
		t.Fatalf("reset schema: %v", err)
	}

	if _, err := db.ExecContext(schemaCtx, string(schemaSQL)); err != nil {
		t.Fatalf("apply schema.sql: %v", err)
	}
	return db
}

func stripProto(port string) string {
	if i := strings.Index(port, "/"); i >= 0 {
		return port[:i]
	}
	return port
}

// startContainer spins up a throwaway PostgreSQL via testcontainers-go.
func startContainer(t *testing.T, ctx context.Context, schemaSQL []byte) *sql.DB {
	t.Helper()

	pgImage := os.Getenv("PEAKY_TEST_PG_IMAGE")
	if pgImage == "" {
		pgImage = "postgres:17-alpine"
	}

	// Internal CI images (e.g. postgres17-o9-ci) have a custom entrypoint
	// that inits then exits. Override entirely: run initdb, write a minimal
	// postgresql.conf (no logging collector — it kills pg_ctl -w detection),
	// then start postgres in the foreground.
	req := testcontainers.ContainerRequest{
		Image:        pgImage,
		ExposedPorts: []string{"5432/tcp"},
		Entrypoint:   []string{"sh", "-c"},
		Cmd: []string{`
set -e
export PGDATA=/var/lib/pgsql/17/data
rm -rf "$PGDATA"
initdb --pgdata="$PGDATA" --auth=trust --locale=en_US.UTF-8 -U postgres
cat > "$PGDATA/postgresql.conf" <<PGCONF
listen_addresses = '*'
logging_collector = off
unix_socket_directories = '/tmp'
PGCONF
echo 'host all all 0.0.0.0/0 trust' >> "$PGDATA/pg_hba.conf"
exec postgres -D "$PGDATA"
`},
		WaitingFor: wait.ForListeningPort("5432/tcp").
			WithStartupTimeout(60 * time.Second),
	}

	ctr, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}
	t.Cleanup(func() { _ = ctr.Terminate(context.Background()) })

	host, err := ctr.Host(ctx)
	if err != nil {
		t.Fatalf("container host: %v", err)
	}
	port, err := ctr.MappedPort(ctx, "5432")
	if err != nil {
		t.Fatalf("mapped port: %v", err)
	}
	p := stripProto(port.Port())

	// Connect as the bootstrap superuser (trust auth) and create the test DB + user.
	adminDSN := fmt.Sprintf("host=%s port=%s user=postgres dbname=postgres sslmode=disable", host, p)
	adminDB, err := sql.Open("pgx", adminDSN)
	if err != nil {
		t.Fatalf("open admin db: %v", err)
	}
	defer adminDB.Close()

	for range 30 {
		if err := adminDB.PingContext(ctx); err == nil {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}

	for _, stmt := range []string{
		"CREATE USER peaky WITH PASSWORD 'peaky'",
		"CREATE DATABASE peaky_test OWNER peaky",
	} {
		if _, err := adminDB.ExecContext(ctx, stmt); err != nil {
			t.Fatalf("admin setup %q: %v", stmt, err)
		}
	}
	adminDB.Close()

	dsn := fmt.Sprintf("host=%s port=%s user=peaky password=peaky dbname=peaky_test sslmode=disable", host, p)
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)

	if _, err := db.ExecContext(ctx, string(schemaSQL)); err != nil {
		t.Fatalf("apply schema.sql: %v", err)
	}

	return db
}

func readSchemaSQL(t *testing.T) []byte {
	t.Helper()
	path := findSchemaSQL(t)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read schema.sql: %v", err)
	}
	return data
}

func findSchemaSQL(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine caller file")
	}
	dir := filepath.Dir(thisFile)
	for range 5 {
		candidate := filepath.Join(dir, "schema.sql")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		dir = filepath.Dir(dir)
	}
	t.Fatal("schema.sql not found — expected at services/schema.sql")
	return ""
}

// TruncateAll truncates all data tables for test isolation between subtests.
func TruncateAll(t *testing.T, db *sql.DB) {
	t.Helper()
	tables := []string{
		"field_versions", "sync_cursors", "events",
		"review_attachments", "review_answer_state",
		"review_note_state", "review_template_selections",
		"review_maturity_overrides", "review_handoff_practices",
		"review_handoff_associations", "review_score_state",
		"reviews", "product_profiles", "team_profiles",
		"subject_component_links", "subjects",
	}
	for _, tbl := range tables {
		if _, err := db.ExecContext(context.Background(), fmt.Sprintf("TRUNCATE %s CASCADE", tbl)); err != nil {
			t.Fatalf("truncate %s: %v", tbl, err)
		}
	}
}
