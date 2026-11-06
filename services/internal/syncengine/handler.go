// Package syncengine implements the sync engine's HTTP API — the push, pull,
// bootstrap, and entitlements endpoints. It is the web (Fuego) layer of the
// sync bounded context; its domain logic (conflict, entity) and persistence
// (repo, db) live in sub-packages.
//
// Handlers receive repo.SyncRepo and authz.Authorizer via constructor injection —
// no direct DB imports — so unit tests swap in the in-memory fake from the
// repo package without needing a running database.
package syncengine

import (
	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/syncengine/entity"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

const engineVersion = "1.0"

// Handlers groups all sync endpoint handlers.
type Handlers struct {
	repo     repo.SyncRepo
	authz    authz.Authorizer
	notifier repo.Notifier
	entities entity.Registry
	// overrides is the action-specific Advisor override policy
	// (authorization/REQ-008). Nil until WithOverridePolicy — push fails
	// closed for review_maturity_override events while it is unset.
	overrides *authz.MaturityOverridePolicy
}

// New constructs a Handlers instance.
// notifier is unset until WithNotifier — in that case push notifications are
// silently skipped (useful for unit tests and environments without SSE).
func New(r repo.SyncRepo, az authz.Authorizer) *Handlers {
	return &Handlers{
		repo:     r,
		authz:    az,
		notifier: repo.NoopNotifier{},
		entities: entity.DefaultRegistry(),
	}
}

// WithNotifier attaches the Notifier that backs family-catalog SSE fan-out.
// Call this in production after New(). Push resolves the channel from the
// changed entity's family (see push.go notifySSE), so no subject lookup is
// needed.
func (h *Handlers) WithNotifier(n repo.Notifier) *Handlers {
	h.notifier = n
	return h
}

// WithOverridePolicy attaches the action-specific Advisor override policy
// consulted by push for review_maturity_override events
// (authorization/REQ-008; AC-022 through AC-024). In production the
// participant lookup is the PostgresSyncRepo itself (see
// cmd/peaky-api/main.go).
func (h *Handlers) WithOverridePolicy(p *authz.MaturityOverridePolicy) *Handlers {
	h.overrides = p
	return h
}

// ── Entitlement mapping ───────────────────────────────────────────────────────

func entitlementMap(raw map[string]authz.Entitlement) map[string]entitlement {
	out := make(map[string]entitlement, len(raw))
	for k, v := range raw {
		out[k] = entitlement{CanView: v.CanView, CanEdit: v.CanEdit}
	}
	return out
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Bootstrap returns the actor identity, entitlement snapshot, and sync cursors.
// Called on first load and after cursor expiry.
func (h *Handlers) Bootstrap(c fuego.ContextNoBody) (bootstrapResponse, error) {
	ctx := c.Context()
	a := appmiddleware.FromContext(ctx)

	entitlements, err := h.authz.Entitlements(ctx, a.ID)
	if err != nil {
		return bootstrapResponse{}, fuego.HTTPError{Title: "failed to load entitlements"}
	}

	cursor, err := h.repo.GetCursor(ctx, a.ID)
	if err != nil {
		return bootstrapResponse{}, fuego.HTTPError{Title: "failed to get cursor"}
	}

	var localCursor *string
	if cursor != "" {
		localCursor = &cursor
	}

	return bootstrapResponse{
		ActorID:       a.ID,
		ActorName:     a.Name,
		ActorEmail:    a.Email,
		Entitlements:  entitlementMap(entitlements),
		Cursors:       bootstrapCursors{Local: localCursor, Remote: nil},
		EngineVersion: engineVersion,
	}, nil
}

// ── Entitlements ──────────────────────────────────────────────────────────────

// Entitlements returns the current entitlement snapshot for the actor.
// Phase 1: no downgrade simulation — hasDowngrades is always false.
func (h *Handlers) Entitlements(c fuego.ContextNoBody) (entitlementsResponse, error) {
	ctx := c.Context()
	a := appmiddleware.FromContext(ctx)

	entitlements, err := h.authz.Entitlements(ctx, a.ID)
	if err != nil {
		return entitlementsResponse{}, fuego.HTTPError{Title: "failed to load entitlements"}
	}

	return entitlementsResponse{
		Current: entitlementsSnapshot{
			ActorID:      a.ID,
			Entitlements: entitlementMap(entitlements),
		},
		HasDowngrades: false,
		Changes:       []entitlementChange{},
	}, nil
}
