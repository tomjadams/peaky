// Package repo — in-memory fakes for testing (fake.go).
// Used exclusively in unit tests — no database required.
package repo

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"sync"
)

// FakeSyncRepo is a thread-safe in-memory SyncRepo for testing.
type FakeSyncRepo struct {
	mu                sync.RWMutex
	fieldVersions     map[string]FieldVersion // key: entityType+"/"+entityID+"/"+fieldName
	cursors           map[string]string       // key: actorID
	events            []SyncEvent
	attachmentReviews map[string]string // attachmentID → reviewID
	participantRoles  map[string]string // "reviewID/actorID" → role
}

// NewFakeSyncRepo constructs an empty fake SyncRepo.
func NewFakeSyncRepo() *FakeSyncRepo {
	return &FakeSyncRepo{
		fieldVersions: make(map[string]FieldVersion),
		cursors:       make(map[string]string),
	}
}

var _ SyncRepo = (*FakeSyncRepo)(nil)

func fvKey(entityType, entityID, fieldName string) string {
	return entityType + "/" + entityID + "/" + fieldName
}

func (r *FakeSyncRepo) GetFieldVersion(ctx context.Context, entityType, entityID, fieldName string) (*FieldVersion, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	fv, ok := r.fieldVersions[fvKey(entityType, entityID, fieldName)]
	if !ok {
		return nil, nil
	}
	cp := fv
	return &cp, nil
}

func (r *FakeSyncRepo) UpsertFieldVersion(ctx context.Context, fv FieldVersion) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.fieldVersions[fvKey(fv.EntityType, fv.EntityID, fv.FieldName)] = fv
	return nil
}

func (r *FakeSyncRepo) GetCursor(ctx context.Context, actorID string) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.cursors[actorID], nil
}

func (r *FakeSyncRepo) SaveCursor(ctx context.Context, actorID, cursor string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.cursors[actorID] = cursor
	return nil
}

func (r *FakeSyncRepo) PullEvents(ctx context.Context, actorID, after string, scope PullScope, limit int) ([]PullEvent, bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	// Empty scope: zero events (inverse of the old nil-means-everything bug).
	if scope.IsEmpty() {
		return nil, false, nil
	}

	wildcardSet := make(map[string]bool, len(scope.Wildcards))
	for _, w := range scope.Wildcards {
		wildcardSet[w] = true
	}
	exactSet := make(map[string]bool, len(scope.ExactRefs))
	for _, ref := range scope.ExactRefs {
		exactSet[ref.RootType+":"+ref.RootID] = true
	}

	// Sort events by PushedAt for deterministic output
	sorted := make([]SyncEvent, len(r.events))
	copy(sorted, r.events)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].PushedAt != sorted[j].PushedAt {
			return sorted[i].PushedAt < sorted[j].PushedAt
		}
		return sorted[i].ID < sorted[j].ID
	})

	afterTime, afterID := parseCursor(after)

	var result []PullEvent
	for _, ev := range sorted {
		// Composite-cursor tuple comparison: (time, id) > (afterTime, afterID),
		// mirroring postgres.go's `(time, id) > ($1, $2)` predicate exactly
		// (see parseCursor). Without an afterID (legacy/no cursor), fall back
		// to a plain time comparison.
		if afterID != "" {
			if ev.PushedAt < afterTime || (ev.PushedAt == afterTime && ev.ID <= afterID) {
				continue
			}
		} else if ev.PushedAt <= afterTime {
			continue
		}
		// Filter on root_type/root_id (mirrors the Postgres WHERE clause).
		matches := wildcardSet[ev.RootType] || exactSet[ev.RootType+":"+ev.RootID]
		if !matches {
			continue
		}
		operation := ev.Operation
		if operation == "" {
			operation = "upsert"
		}
		result = append(result, PullEvent{
			ID:         ev.ID,
			EntityType: ev.EntityType,
			EntityID:   ev.EntityID,
			Operation:  operation,
			ActorID:    ev.ActorID,
			Fields:     ev.Fields,
			Time:       ev.PushedAt,
		})
	}

	hasMore := len(result) > limit
	if hasMore {
		result = result[:limit]
	}

	return result, hasMore, nil
}

func (r *FakeSyncRepo) SaveEvent(ctx context.Context, ev SyncEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	// Idempotency: duplicate IDs keep the original event and merge any missing fields.
	for i, existing := range r.events {
		if existing.ID == ev.ID {
			existingFields := make(map[string]bool, len(existing.Fields))
			for _, field := range existing.Fields {
				existingFields[field.Name] = true
			}
			for _, field := range ev.Fields {
				if !existingFields[field.Name] {
					r.events[i].Fields = append(r.events[i].Fields, field)
				}
			}
			return nil
		}
	}
	r.events = append(r.events, ev)
	return nil
}

// ── Test helpers ─────────────────────────────────────────────────────────────

// SeedEvent adds an event directly (bypassing SaveEvent idempotency check).
// Caller must set RootType/RootID explicitly (use entity.RootFor to resolve).
func (r *FakeSyncRepo) SeedEvent(ev SyncEvent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, ev)
}

// FieldVersionCount returns the number of stored field versions.
func (r *FakeSyncRepo) FieldVersionCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.fieldVersions)
}

// EventCount returns the number of stored events.
func (r *FakeSyncRepo) EventCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.events)
}

// StoredEventByID returns the stored event with the given ID, or nil.
func (r *FakeSyncRepo) StoredEventByID(id string) *SyncEvent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for i := range r.events {
		if r.events[i].ID == id {
			return &r.events[i]
		}
	}
	return nil
}

// ── Erroring fake ────────────────────────────────────────────────────────────

// ErrorSyncRepo always returns an error — used to test error handling paths.
type ErrorSyncRepo struct{}

var _ SyncRepo = (*ErrorSyncRepo)(nil)

func (r *ErrorSyncRepo) GetFieldVersion(ctx context.Context, _, _, _ string) (*FieldVersion, error) {
	return nil, fmt.Errorf("storage unavailable")
}
func (r *ErrorSyncRepo) UpsertFieldVersion(ctx context.Context, _ FieldVersion) error {
	return fmt.Errorf("storage unavailable")
}
func (r *ErrorSyncRepo) GetCursor(ctx context.Context, _ string) (string, error) {
	return "", fmt.Errorf("storage unavailable")
}
func (r *ErrorSyncRepo) SaveCursor(ctx context.Context, _, _ string) error {
	return fmt.Errorf("storage unavailable")
}
func (r *ErrorSyncRepo) PullEvents(ctx context.Context, _, _ string, _ PullScope, _ int) ([]PullEvent, bool, error) {
	return nil, false, fmt.Errorf("storage unavailable")
}
func (r *ErrorSyncRepo) SaveEvent(ctx context.Context, _ SyncEvent) error {
	return fmt.Errorf("storage unavailable")
}

// FindAttachmentReview returns the review_id for an attachment, using the
// in-memory attachments map. Returns sql.ErrNoRows when not found.
func (r *FakeSyncRepo) FindAttachmentReview(ctx context.Context, attachmentID string) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if reviewID, ok := r.attachmentReviews[attachmentID]; ok {
		return reviewID, nil
	}
	return "", sql.ErrNoRows
}

// AddAttachment seeds an attachment→review mapping for tests.
func (r *FakeSyncRepo) AddAttachment(attachmentID, reviewID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.attachmentReviews == nil {
		r.attachmentReviews = make(map[string]string)
	}
	r.attachmentReviews[attachmentID] = reviewID
}

// ParticipantRole returns the seeded participant role for the actor on the
// review, or "" when none — mirroring PostgresSyncRepo.ParticipantRole.
// Satisfies authz.ReviewParticipantLookup for policy tests.
func (r *FakeSyncRepo) ParticipantRole(ctx context.Context, reviewID, actorID string) (string, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.participantRoles[reviewID+"/"+actorID], nil
}

// AddParticipant seeds a review participant role for tests.
func (r *FakeSyncRepo) AddParticipant(reviewID, actorID, role string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.participantRoles == nil {
		r.participantRoles = make(map[string]string)
	}
	r.participantRoles[reviewID+"/"+actorID] = role
}

// ── FakeNotifier ──────────────────────────────────────────────────────────────

// FakeNotifier is a Notifier that records every Notify call.
// Thread-safe; safe to use from concurrent handler tests.
type FakeNotifier struct {
	mu    sync.Mutex
	calls []NotifyCall
}

// NotifyCall captures the arguments of a single Notify invocation.
type NotifyCall struct {
	Channel string
	Payload string
}

var _ Notifier = (*FakeNotifier)(nil)

// Notify records the call and returns nil.
func (f *FakeNotifier) Notify(_ context.Context, channel, payload string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, NotifyCall{Channel: channel, Payload: payload})
	return nil
}

// Calls returns a snapshot of all recorded calls.
func (f *FakeNotifier) Calls() []NotifyCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]NotifyCall, len(f.calls))
	copy(out, f.calls)
	return out
}

// CallCount returns the number of Notify calls recorded.
func (f *FakeNotifier) CallCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.calls)
}
