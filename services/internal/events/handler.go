// Package events provides the GET /api/events handler and CloudEvents envelope
// validation utilities.
//
// The handler returns raw CloudEvent records from PostgreSQL for audit/admin views.
// No derivation is performed — clients receive exactly what was stored.
//
// File layout:
//   - handler.go  — Handlers + the List HTTP handler
//   - models.go   — wire types (EventRecord, eventsResponse)
//   - repo.go     — Repo port + PostgresEventsRepo implementation
//   - envelope.go — CloudEvents envelope validation
//   - routes.go   — route registration
package events

import (
	"strconv"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
)

// Handlers holds the handler dependencies.
type Handlers struct {
	repo  Repo
	authz authz.Authorizer
}

// New returns ready Handlers.
func New(r Repo, az authz.Authorizer) *Handlers {
	return &Handlers{repo: r, authz: az}
}

const defaultEventsLimit = 100

// List handles GET /api/events.
func (h *Handlers) List(c fuego.ContextNoBody) (eventsResponse, error) {
	ctx := c.Context()
	a := appmiddleware.FromContext(c.Context())

	after := c.QueryParam("after")
	limit := defaultEventsLimit
	if l := c.QueryParam("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}

	entitledIDs, err := h.authz.ViewableEntities(ctx, a.ID, "review")
	if err != nil {
		return eventsResponse{}, fuego.HTTPError{Title: "failed to load entitlements"}
	}

	allowAll := len(entitledIDs) == 1 && entitledIDs[0] == "*"
	if allowAll {
		entitledIDs = nil
	}

	records, hasMore, err := h.repo.ListEvents(ctx, a.ID, entitledIDs, after, limit, allowAll)
	if err != nil {
		return eventsResponse{}, fuego.HTTPError{Title: "failed to list events"}
	}

	return eventsResponse{
		Events:  records,
		HasMore: hasMore,
	}, nil
}
