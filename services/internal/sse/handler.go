package sse

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/ssecontract"
	"github.com/peaky-team/peaky/services/internal/syncengine/entity"
)

const heartbeatInterval = 15 * time.Second

// Handler holds the SSE HTTP handler and its hub dependency.
type Handler struct {
	hub *Hub
	reg *authz.Registry
}

// NewHandler wires up the SSE handler.
func NewHandler(hub *Hub, reg *authz.Registry) *Handler {
	return &Handler{hub: hub, reg: reg}
}

// Events is GET /api/sse/events — an indefinitely open SSE stream.
//
// The client receives cursor-pointer notifications whenever a push batch is
// accepted for an entity the actor is entitled to see. It responds by calling
// pullChanges() immediately, skipping the 30s wait.
//
// Auth: Phase 1 — x-actor-id header (trusted, same as peaky-api).
//
//	Phase 3 — Okta JWT via Authorization: Bearer header.
func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	a := appmiddleware.FromContext(r.Context())

	// Build the channel list from the actor's entitlements.
	channels := entitlementChannels(a)
	if len(channels) == 0 {
		http.Error(w, "no entitled channels", http.StatusForbidden)
		return
	}

	streamID := fmt.Sprintf("%s-%d", a.ID, time.Now().UnixNano())
	stream := &Stream{
		ID:       streamID,
		ActorID:  a.ID,
		Channels: channels,
		Ch:       make(chan []byte, 16),
		Done:     make(chan struct{}),
	}

	if err := h.hub.Register(ctx, stream); err != nil {
		http.Error(w, "failed to register stream", http.StatusInternalServerError)
		return
	}
	defer h.hub.Deregister(ctx, streamID)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering if present
	w.WriteHeader(http.StatusOK)

	// Flush sends any buffered data immediately without waiting for the response
	// to complete — required for SSE.
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()

	slog.Debug("sse: stream opened", "actor", a.ID, "channels", len(channels))

	for {
		select {
		case payload := <-stream.Ch:
			// Write errors are expected when the client disconnects — ctx.Done handles cleanup.
			_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
			flusher.Flush()

		case <-heartbeat.C:
			_, _ = fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()

		case <-ctx.Done():
			slog.Debug("sse: stream closed", "actor", a.ID)
			return
		}
	}
}

// entitlementChannels derives the family-catalog SSE channels an actor may
// LISTEN on from its entitlement keys. A key is "{family}:{id}" (e.g. "review:*"
// or "review:review-001"); only the family segment routes, so both collapse to
// the same sync:{family}:catalog channel. Keys whose family is not a routable
// SSE family (e.g. a legacy "team:*") are skipped, and the "*" of a wildcard
// entitlement never reaches a channel name — PostgreSQL LISTEN is exact-match,
// and per-entity scope is re-applied by /pull.
func entitlementChannels(a authz.Actor) []string {
	seen := make(map[string]bool, len(a.Entitlements))
	channels := make([]string, 0, len(a.Entitlements))
	for key, ent := range a.Entitlements {
		if !ent.CanView {
			continue
		}
		family, _, ok := strings.Cut(key, ":")
		if !ok || !entity.IsFamily(family) {
			continue
		}
		ch := ssecontract.CatalogChannel(family)
		if seen[ch] {
			continue
		}
		seen[ch] = true
		channels = append(channels, ch)
	}
	return channels
}
