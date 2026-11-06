package syncengine

import (
	"log/slog"
	"strconv"
	"time"

	"github.com/go-fuego/fuego"

	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// Formal models: formal_verification/sync/root_scope_alignment.fizz (entitlement
// scope filtering and root ride-along) and
// formal_verification/sync/sync_engine_push_pull.fizz (cursor windowing).
// Changing scope or cursor semantics requires updating those specs.

const defaultPullLimit = 200

// isValidCursor accepts both legacy RFC3339-only cursors and composite
// "RFC3339:id" cursors. Because RFC3339 timestamps contain colons (e.g.
// 15:04:05), we cannot naively split on the last colon. Instead we
// progressively test every colon position until the prefix parses as a
// valid RFC3339 timestamp and the suffix is non-empty.
func isValidCursor(after string) bool {
	if isCursorTime(after) {
		return true // legacy cursor
	}
	for i := 1; i < len(after); i++ {
		if after[i] != ':' {
			continue
		}
		if isCursorTime(after[:i]) && i+1 < len(after) {
			return true // composite cursor
		}
	}
	return false
}

func isCursorTime(value string) bool {
	if _, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return true
	}
	if _, err := time.Parse(time.RFC3339, value); err == nil {
		return true
	}
	return false
}

// Pull returns events since the given cursor, scoped to entities the actor
// is entitled to view. The WHERE clause includes entitlement IDs — data the
// actor isn't entitled to never leaves the database.
func (h *Handlers) Pull(c fuego.ContextNoBody) (pullResponse, error) {
	ctx := c.Context()
	a := appmiddleware.FromContext(ctx)

	after := c.QueryParam("after")
	if after != "" {
		if !isValidCursor(after) {
			return pullResponse{}, fuego.BadRequestError{Title: "invalid cursor", Detail: "expected RFC3339 or RFC3339:id"}
		}
	}
	limit := defaultPullLimit
	if limitParam := c.QueryParam("limit"); limitParam != "" {
		if n, err := strconv.Atoi(limitParam); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}

	// Build per-family pull scope: wildcards (family fully visible) and
	// exact refs (specific roots). This replaces the old entitled=nil collapse
	// that fetched every family when any one resolved to "*".
	scope := repo.PullScope{}
	for _, entityType := range h.entities.PullRootTypes() {
		entitledIDs, err := h.authz.ViewableEntities(ctx, a.ID, entityType)
		if err != nil {
			return pullResponse{}, fuego.HTTPError{Title: "failed to load entitlements"}
		}
		if len(entitledIDs) == 1 && entitledIDs[0] == "*" {
			scope.Wildcards = append(scope.Wildcards, entityType)
			continue
		}
		for _, id := range entitledIDs {
			scope.ExactRefs = append(scope.ExactRefs, repo.RootRef{RootType: entityType, RootID: id})
		}
	}

	events, hasMore, err := h.repo.PullEvents(ctx, a.ID, after, scope, limit)
	if err != nil {
		return pullResponse{}, fuego.HTTPError{Title: "failed to pull events"}
	}

	// Map repo.PullEvent → wire pullEvent
	wireEvents := make([]pullEvent, 0, len(events))
	for _, ev := range events {
		fields := make([]pullField, 0, len(ev.Fields))
		for _, f := range ev.Fields {
			fields = append(fields, pullField{
				Name:  f.Name,
				Value: f.Value,
				HLC:   f.HLC,
			})
		}
		wireEvents = append(wireEvents, pullEvent{
			ID:         ev.ID,
			EntityType: ev.EntityType,
			EntityID:   ev.EntityID,
			Operation:  ev.Operation,
			ActorID:    ev.ActorID,
			Fields:     fields,
			Time:       ev.Time,
		})
	}

	// Advance cursor to a stable composite (time + id) so events with the
	// same timestamp are not skipped on pagination boundaries.
	cursor := after
	if len(events) > 0 {
		last := events[len(events)-1]
		cursor = last.Time + ":" + last.ID
		// Persist cursor so bootstrap returns the actor's position on next
		// cycle. Non-fatal: the client maintains its own copy; server-side
		// is only used for reset detection (see SyncEngine.bootstrap).
		if err := h.repo.SaveCursor(ctx, a.ID, cursor); err != nil {
			slog.Warn("pull: failed to save cursor", "actor", a.ID, "error", err)
		}
	}

	return pullResponse{
		Events:  wireEvents,
		Cursor:  cursor,
		HasMore: hasMore,
	}, nil
}
