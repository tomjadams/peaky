package syncengine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/ssecontract"
	"github.com/peaky-team/peaky/services/internal/syncengine/conflict"
	"github.com/peaky-team/peaky/services/internal/syncengine/entity"
	"github.com/peaky-team/peaky/services/internal/syncengine/handoff"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// fieldBufPool reuses []byte buffers when marshaling field values.
// Each push request may carry up to 100 fields; pooling avoids per-field heap
// allocations on the hot path without changing the outward JSON contract.
var fieldBufPool = sync.Pool{
	New: func() any { return new(bytes.Buffer) },
}

const maxPushEvents = 500
const maxFieldsPerEvent = 100

// Push processes field-level HLC push events.
func (h *Handlers) Push(c fuego.ContextWithBody[pushRequest]) (pushResponse, error) {
	ctx := c.Context()
	a := appmiddleware.FromContext(ctx)

	req, err := c.Body()
	if err != nil {
		return pushResponse{}, fuego.BadRequestError{Title: "invalid JSON body"}
	}

	if len(req.Events) > maxPushEvents {
		return pushResponse{}, fuego.BadRequestError{Title: "too many events in push batch"}
	}

	accepted := make([]string, 0, len(req.Events))
	rejected := make([]rejectedEvent, 0)
	// Distinct families with a persisted change this batch (full or partial
	// accept) — the doorbell rings once per family. See notifySSE.
	notifyFamilies := make(map[string]bool)
	// pushedAt of the last persisted event (full or partial accept) in request
	// order. Tracking the value directly — rather than a set keyed by event ID —
	// keeps cursor advancement correct even if a batch repeats an event ID.
	lastPersistedCursor := ""

	for _, ev := range req.Events {
		if ev.ID == "" || ev.EntityType == "" || ev.EntityID == "" {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "missing_required_fields"})
			continue
		}

		// Validate entity type + operation against the sync registry — shape only,
		// no authorization. The registry is the extension seam for Phase 2
		// templates/products while keeping the push payload stable.
		if !h.entities.Knows(ev.EntityType) {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_entity_type"})
			continue
		}
		if !entity.ValidOperation(ev.Operation) {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_operation"})
			continue
		}

		// Resolve the root entity for this event. Every accepted event must
		// carry a (root_type, root_id) so the pull filter can scope by root.
		// A child with no parseable {rootId}: prefix is rejected — it would
		// be invisible to every pull (null root matches no entitlement).
		rootType, rootID, rootOK := entity.RootFor(ev.EntityType, ev.EntityID)
		if !rootOK {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_entity_id"})
			continue
		}

		// Validate pushedAt is present and RFC3339 (with optional sub-second) and not in the future.
		if ev.PushedAt == "" {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "missing_pushed_at"})
			continue
		}
		{
			pushedAt, err := time.Parse(time.RFC3339Nano, ev.PushedAt)
			if err != nil {
				// Fall back to strict RFC3339 for clients that omit fractional seconds.
				pushedAt, err = time.Parse(time.RFC3339, ev.PushedAt)
			}
			if err != nil || pushedAt.After(time.Now().Add(30*time.Second)) {
				rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_pushed_at"})
				continue
			}
		}

		// Parse fields — must be a JSON array of {name, value, hlc}.
		// Legacy clients (pre-HLC) stored fields as a plain object; reject
		// those gracefully rather than crashing the whole batch.
		var parsedFields []pushField
		if len(ev.Fields) > 0 {
			if ev.Fields[0] != '[' {
				rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "legacy_fields_format"})
				continue
			}
			if err := json.Unmarshal(ev.Fields, &parsedFields); err != nil {
				rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_fields"})
				continue
			}
		}

		// Field count limit — prevents memory exhaustion.
		if len(parsedFields) > maxFieldsPerEvent {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "too_many_fields"})
			continue
		}

		// Versioned handoff limits are enforced atomically before
		// authorization and HLC resolution (local-first/REQ-013; AC-021): one
		// over-limit or malformed handoff field rejects the whole mutation —
		// no truncated value or partial state is persisted.
		if violations := handoffViolations(ev.EntityType, parsedFields); len(violations) > 0 {
			conflicts := make([]fieldConflict, 0, len(violations))
			for _, v := range violations {
				conflicts = append(conflicts, fieldConflict{Field: v.Field, Reason: v.Code})
			}
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "handoff_limit_exceeded", FieldConflicts: conflicts})
			continue
		}

		// Authorization is the boundary's call: forward the raw entity and enforce
		// the verdict. The authz boundary owns how an entity maps to a resource
		// (today a small resolver; tomorrow Cedar's entity store). Override
		// mutations route through the action-specific Advisor policy instead
		// (authorization/REQ-008) — a bare edit capability is never sufficient.
		allowed, err := h.authorizeMutation(ctx, a.ID, ev, rootID, parsedFields)
		if err != nil || !allowed {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "access_revoked"})
			continue
		}

		// Convert push fields to repo.FieldValue, serialising Value to JSON.
		// Borrow a buffer from the pool so the marshal does not allocate a new
		// []byte for each field across concurrent push requests.
		repoFields := make([]repo.FieldValue, 0, len(parsedFields))
		encodeFailed := false
		for _, f := range parsedFields {
			var valPtr *string
			if f.Value != nil {
				buf, _ := fieldBufPool.Get().(*bytes.Buffer) //nolint:errcheck // pool always stores *bytes.Buffer
				buf.Reset()
				if err := json.NewEncoder(buf).Encode(f.Value); err == nil {
					// buf.String() copies the bytes from the buffer's backing
					// array, so it is safe even after the buffer is returned
					// to the pool and reused by another goroutine.
					s := buf.String()
					// Trim the trailing newline that json.Encoder appends.
					if l := len(s); l > 0 && s[l-1] == '\n' {
						s = s[:l-1]
					}
					valPtr = &s
				} else {
					slog.Warn("push: field value encoding failed", "event", ev.ID, "field", f.Name, "error", err)
					encodeFailed = true
				}
				fieldBufPool.Put(buf)
			}
			repoFields = append(repoFields, repo.FieldValue{
				Name:  f.Name,
				Value: valPtr,
				HLC:   f.HLC,
			})
		}
		if encodeFailed {
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_fields"})
			continue
		}

		// Per-field HLC resolution
		results, err := conflict.ApplyFields(ctx, h.repo, ev.EntityType, ev.EntityID, a.ID, repoFields)
		if err != nil {
			slog.Error("push: apply fields failed", "event", ev.ID, "entityType", ev.EntityType, "entityId", ev.EntityID, "error", err)
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "internal_error"})
			continue
		}

		// Collect field conflicts
		var conflicts []fieldConflict
		acceptedFields := make([]repo.FieldValue, 0, len(repoFields))
		for i, result := range results {
			if !result.Accepted {
				conflicts = append(conflicts, fieldConflict{Field: result.Name, Reason: result.Reason})
			} else {
				acceptedFields = append(acceptedFields, repoFields[i])
			}
		}

		if len(conflicts) > 0 && len(conflicts) == len(repoFields) {
			// All fields rejected — treat event as rejected
			rejected = append(rejected, rejectedEvent{
				ID:             ev.ID,
				Reason:         "hlc_conflict",
				FieldConflicts: conflicts,
			})
			continue
		}

		// Partially or fully accepted — persist the event record
		if err := h.repo.SaveEvent(ctx, repo.SyncEvent{
			ID:         ev.ID,
			EntityType: ev.EntityType,
			EntityID:   ev.EntityID,
			RootType:   rootType,
			RootID:     rootID,
			Operation:  ev.Operation,
			ActorID:    a.ID,
			Fields:     acceptedFields,
			PushedAt:   ev.PushedAt,
		}); err != nil {
			slog.Error("push: save event failed", "event", ev.ID, "entityType", ev.EntityType, "entityId", ev.EntityID, "error", err)
			rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "internal_error"})
			continue
		}

		// Persisted (full or partial accept) → its family gets a doorbell and
		// the cursor advances to this event (pushedAt is validated non-empty above).
		lastPersistedCursor = ev.PushedAt
		if fam, ok := entity.Family(entity.Type(ev.EntityType)); ok {
			notifyFamilies[fam] = true
		}

		switch {
		case len(conflicts) > 0:
			// Partially accepted — some field conflicts.
			// Do NOT add to accepted; report as partial conflict so the
			// client knows which fields lost.
			rejected = append(rejected, rejectedEvent{
				ID:             ev.ID,
				Reason:         "partial_hlc_conflict",
				FieldConflicts: conflicts,
			})
		default:
			// Fully accepted
			accepted = append(accepted, ev.ID)
		}
	}

	// Advance the cursor to the pushedAt of the last PERSISTED event (full or
	// partial accept). A partial accept persists a pullable change, so it moves
	// the high-water mark exactly like a full accept; only a wholly rejected
	// event leaves the cursor where it was. This cursor gates neither re-push
	// (the outbox is drained by per-item status) nor pull (remoteCursor), so it
	// stays a truthful, monotonic marker of the latest pullable position.
	newCursor := ""
	if req.ClientCursor != nil {
		newCursor = *req.ClientCursor
	}
	if lastPersistedCursor != "" {
		newCursor = lastPersistedCursor
	}

	if err := h.repo.SaveCursor(ctx, a.ID, newCursor); err != nil {
		slog.Error("push: failed to save cursor", "actor", a.ID, "cursor", newCursor, "error", err)
		return pushResponse{}, fuego.HTTPError{Title: "failed to persist sync cursor"}
	}

	// Fan out one cursor-pointer notification per distinct family that had a
	// persisted change this batch. Clients pull entitled data on receipt; the
	// family channel is the doorbell, not an authorization boundary.
	if len(notifyFamilies) > 0 {
		h.notifySSE(ctx, notifyFamilies, newCursor)
	}

	return pushResponse{
		Accepted:        accepted,
		Rejected:        rejected,
		NewClientCursor: newCursor,
	}, nil
}

// handoffViolations validates a handoff mutation's fields against the
// versioned HandoffLimits contract (improvement-plans/REQ-011). Returns nil
// for entity types outside the handoff streams.
func handoffViolations(entityType string, fields []pushField) []handoff.Violation {
	if entityType != string(entity.ReviewHandoffPractice) && entityType != string(entity.ReviewHandoffAssociation) {
		return nil
	}
	decoded := make([]handoff.Field, 0, len(fields))
	for _, f := range fields {
		decoded = append(decoded, handoff.Field{Name: f.Name, Value: f.Value})
	}
	return handoff.ValidateEventFields(entityType, decoded)
}

// authorizeMutation decides whether actorID may persist the pushed event.
// review_maturity_override events route through the action-specific
// MaturityOverridePolicy — the action comes from the event's own action
// field, and the policy resolves the participant role server-side
// (authorization/REQ-008; AC-024). Every other entity keeps the shared
// capability check against the resource the authz boundary resolves.
func (h *Handlers) authorizeMutation(ctx context.Context, actorID string, ev pushEvent, rootID string, fields []pushField) (bool, error) {
	if entity.Type(ev.EntityType) != entity.ReviewMaturityOverride {
		canEdit, err := h.authz.CanEdit(ctx, actorID, ev.EntityType, ev.EntityID)
		if err != nil {
			return false, fmt.Errorf("authorize mutation: %w", err)
		}
		return canEdit, nil
	}
	if h.overrides == nil {
		return false, nil // fail closed while the policy is unwired
	}
	action, ok := overrideActionField(fields)
	if !ok {
		return false, nil
	}
	allowed, err := h.overrides.Authorize(ctx, actorID, rootID, authz.OverrideAction(action))
	if err != nil {
		return false, fmt.Errorf("authorize override mutation: %w", err)
	}
	return allowed, nil
}

// overrideActionField extracts the transition action the pushed override
// event claims. A missing or non-string action authorizes nothing.
func overrideActionField(fields []pushField) (string, bool) {
	for _, f := range fields {
		if f.Name == "action" {
			action, ok := f.Value.(string)
			return action, ok
		}
	}
	return "", false
}

// notifySSE emits one pg_notify per distinct family on its single catalog
// channel, deduplicated by the caller's family set. A partial accept persists a
// change, so its family is woken exactly as a full accept; only a wholly
// rejected event leaves its family out and stays silent.
func (h *Handlers) notifySSE(ctx context.Context, families map[string]bool, cursor string) {
	for family := range families {
		channel := ssecontract.CatalogChannel(family)
		payloadJSON, err := json.Marshal(ssecontract.CursorNotification{Cursor: cursor, Family: family})
		if err != nil {
			slog.Warn("push: marshal cursor notification failed", "family", family, "error", err)
			continue
		}
		if err := h.notifier.Notify(ctx, channel, string(payloadJSON)); err != nil {
			slog.Warn("push: pg_notify failed", "channel", channel, "error", err)
		}
	}
}
