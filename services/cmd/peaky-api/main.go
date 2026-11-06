// peaky-api is the Go sync backend for Peaky.
//
// It does exactly one thing: serve HTTP. No subcommand dispatch, no
// management commands. Use peaky-ctl for migrate, seed, and health probes.
//
// Deployment sequence (CI/CD or local watch):
//
//  1. docker run ... peaky-ctl migrate   # apply pending DDL, exits
//  2. docker run ... peaky-ctl seed      # insert demo data, exits (local only)
//  3. docker run ... peaky-api           # start HTTP server (or Lambda deploy)
//
// # Architecture
//
//	┌──────────── Nuxt (browser) ──────────────────────────────────────────────┐
//	│  SQLite/OPFS (SQLocal)    SyncEngine.ts                                  │
//	│  draft() → outbox  ──►   POST /api/sync/push → HLC conflict resolution  │
//	│  replay() ← pull   ◄──   GET  /api/sync/pull → field_versions join       │
//	└─────────────────────────────────────────────────────────────────────────-┘
//	                         │ HTTP (same-origin via Nitro proxy in dev;
//	                         │       API Gateway in production)
//	               ┌─────────▼─────────────────────────┐
//	               │         peaky-api serve            │
//	               │  Fuego + Actor middleware          │
//	               │  syncengine: push/pull/bootstrap    │
//	               │  catalog: embedded snapshot         │
//	               └─────────────┬───────────────────────┘
//	                             │
//	                      PostgreSQL 17
//	                      (LISTEN/NOTIFY → future SSE/WS)
//
// # Environment variables
//
//   - PORT        TCP port for serve (default: 8080)
//   - PG_DSN      PostgreSQL connection string (default: postgres://peaky:peaky@localhost:5432/peaky?sslmode=disable)
//   - ACTORS_FILE Path to actors.json (default: seed/actors.json)
//   - LOG_LEVEL   debug | info | warn | error  (default: info)
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-fuego/fuego"
	"github.com/go-fuego/fuego/option"

	"github.com/peaky-team/peaky/services/internal/apiui"
	"github.com/peaky-team/peaky/services/internal/app"
	"github.com/peaky-team/peaky/services/internal/attachment"
	"github.com/peaky-team/peaky/services/internal/authz"
	"github.com/peaky-team/peaky/services/internal/catalog"
	appevents "github.com/peaky-team/peaky/services/internal/events"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/syncengine"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

func main() {
	// health is the only accepted argument — it is a server self-probe used
	// by the Docker healthcheck inside the distroless image. Management
	// commands (migrate, seed) live in the separate peaky-ctl binary.
	if len(os.Args) > 1 && os.Args[1] == "health" {
		runHealth()
		return
	}
	app.InitLogger()
	runServe()
}

// runHealth probes /__health and exits 0 on 200, 1 otherwise.
// Called by the Docker HEALTHCHECK — no external tools needed in distroless.
func runHealth() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := "http://localhost:" + app.EnvOr("PORT", "8080") + "/__health"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "health check request: %v\n", err)
		os.Exit(1)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "health check failed: %v\n", err)
		os.Exit(1)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintf(os.Stderr, "health check returned %d\n", resp.StatusCode)
		os.Exit(1)
	}
}

func runServe() {
	cfg := app.ConfigFromEnv()

	// ── Database ────────────────────────────────────────────────────────────
	db, err := app.OpenDB(cfg)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close() }()

	// ── Dependencies ────────────────────────────────────────────────────────
	registry, err := authz.LoadRegistry(cfg.ActorsFile)
	if err != nil {
		slog.Error("failed to load actor registry", "error", err)
		os.Exit(1)
	}

	syncRepo := repo.NewPostgresSyncRepo(db)
	notifier := repo.NewPostgresNotifier(db)
	// The action-specific Advisor override policy (authorization/REQ-008):
	// the sync repo doubles as the server-side review-participants lookup.
	syncHandlers := syncengine.New(syncRepo, registry).
		WithNotifier(notifier).
		WithOverridePolicy(authz.NewMaturityOverridePolicy(registry, syncRepo))

	catalogHandlers, err := catalog.New()
	if err != nil {
		slog.Error("failed to load catalog snapshot", "error", err)
		os.Exit(1)
	}

	attachmentHandlers := attachment.New(syncRepo, registry)

	eventsRepo := appevents.NewPostgresEventsRepo(db)
	eventsHandlers := appevents.New(eventsRepo, registry)

	// ── Fuego server ────────────────────────────────────────────────────────
	s := fuego.NewServer(
		fuego.WithAddr(":"+cfg.Port),
		fuego.WithLoggingMiddleware(fuego.LoggingConfig{
			DisableRequest:  false,
			DisableResponse: false,
		}),
		fuego.WithGlobalMiddlewares(
			appmiddleware.Actor(registry),
		),
		// JSON-only serialization — reject Accept: application/xml etc.
		fuego.WithSerializer(fuego.SendJSON),
		fuego.WithErrorSerializer(fuego.SendJSONError),
		fuego.WithEngineOptions(
			fuego.WithOpenAPIConfig(fuego.OpenAPIConfig{
				SwaggerURL:           "/docs",
				SpecURL:              "/docs/openapi.json",
				DisableDefaultServer: true,
				UIHandler:            apiui.ScalarUI,
			}),
			fuego.WithRequestContentType("application/json"),
			fuego.WithResponseContentType("application/json"),
		),
	)

	// ── Routes ──────────────────────────────────────────────────────────────
	// Each feature package owns its route registration; main only wires deps.
	fuego.Get(s, "/__health", func(c fuego.ContextNoBody) (map[string]string, error) {
		return map[string]string{"status": "ok", "service": "peaky-api"}, nil
	}, option.Hide())

	syncengine.RegisterRoutes(s, syncHandlers)
	attachment.RegisterRoutes(s, attachmentHandlers)
	appevents.RegisterRoutes(s, eventsHandlers)
	catalog.RegisterRoutes(s, catalogHandlers)

	// ── Graceful shutdown ───────────────────────────────────────────────────
	// Lambda Web Adapter sends SIGTERM ~500 ms before SIGKILL.
	// We give in-flight requests up to 10 s to drain.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	go func() {
		slog.Info("peaky-api starting", "addr", s.Addr)
		if err := s.Run(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := s.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}
