// peaky-sse is the SSE fan-out service for Peaky.
//
// It holds one PostgreSQL LISTEN connection per pod and fans cursor-pointer
// notifications to connected browser clients via Server-Sent Events. The
// browser responds by calling pullChanges() immediately, reducing sync
// latency from 30s to network RTT. 30s polling continues as a fallback.
//
// # Architecture
//
//	Browser ─── GET /api/sse/events ──► peaky-sse
//	                                       │ LISTEN sync:review:catalog
//	                                       │ LISTEN sync:product:catalog
//	                                       │ LISTEN sync:template:catalog
//	                                    PostgreSQL (NOTIFY from peaky-api)
//
// Channels are exactly one per family (review, product, template); the actor's
// entitlements are collapsed to the families they can view. No literal `*` is
// ever passed to LISTEN — wildcard entitlements (e.g. review:*) and specific
// ones (review:review-001) subscribe to the same sync:review:catalog channel.
//
// # Auth (Phase 1 stub)
//
// x-actor-id header is trusted (same as peaky-api). Phase 3: Okta JWT via
// Authorization: Bearer header validated against Okta JWKS endpoint.
//
// # Environment variables
//
//   - PORT        TCP port (default: 8081)
//   - PG_DSN      PostgreSQL connection string
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
	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/sse"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "health" {
		runHealth()
		return
	}
	app.InitLogger()
	runServe()
}

func runHealth() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := "http://localhost:" + app.EnvOr("PORT", "8081") + "/__health"
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

	registry, err := authz.LoadRegistry(cfg.ActorsFile)
	if err != nil {
		slog.Error("failed to load actor registry", "error", err)
		os.Exit(1)
	}

	hub := sse.NewHub(cfg.DSN)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	if err := hub.Start(ctx); err != nil {
		slog.Error("sse hub failed to start", "error", err)
		os.Exit(1)
	}

	s := fuego.NewServer(
		fuego.WithAddr(":"+cfg.Port),
		fuego.WithLoggingMiddleware(fuego.LoggingConfig{
			DisableRequest:  false,
			DisableResponse: false,
		}),
		fuego.WithGlobalMiddlewares(
			appmiddleware.Actor(registry),
		),
		// JSON-only serialization — SSE uses GetStd and bypasses this entirely.
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

	// SSE connections are long-lived — disable the absolute write deadline so
	// Fuego's default 30s WriteTimeout doesn't kill the stream.
	s.WriteTimeout = 0

	fuego.Get(s, "/__health", func(c fuego.ContextNoBody) (map[string]string, error) {
		return map[string]string{"status": "ok", "service": "peaky-sse"}, nil
	}, option.Hide())

	sse.RegisterRoutes(s, sse.NewHandler(hub, registry))

	go func() {
		slog.Info("peaky-sse starting", "addr", s.Addr)
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
