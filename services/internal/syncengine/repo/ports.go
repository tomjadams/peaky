// Package repo defines the repository interfaces (ports) for the sync engine.
// Concrete implementations are in the same package; in-memory fakes live in
// internal/syncengine/repo/fake for unit testing.
package repo

import "context"

// FieldVersion is the current winning value for a single entity field.
// hlc is stored as "wallclock:counter" — actor_id is a separate column.
type FieldVersion struct {
	EntityType string
	EntityID   string
	FieldName  string
	Value      *string // JSON-encoded, nil means NULL
	HLC        string
	ActorID    string
}

// SyncEvent is a pushed domain event from the client.
type SyncEvent struct {
	ID         string
	EntityType string
	EntityID   string
	RootType   string // resolved root entity type (review, product, template_draft, ...)
	RootID     string // resolved root entity id (self for roots; prefix for children)
	Operation  string // "create" | "upsert" | "update" | "delete"
	ActorID    string
	Fields     []FieldValue // accepted fields only when persisted
	PushedAt   string
}

// FieldValue is a single field with its HLC stamp from a push request.
type FieldValue struct {
	Name  string
	Value *string // JSON-encoded
	HLC   string  // "wallclock:counter:actorId" (wire format)
}

// PullEvent is an event returned to the client in a pull response.
type PullEvent struct {
	ID         string
	EntityType string
	EntityID   string
	Operation  string
	ActorID    string
	Fields     []FieldValue
	Time       string
}

// RootRef pairs a root entity type with its ID for root-scoped authorization
// filtering in PullEvents.
type RootRef struct {
	RootType string
	RootID   string
}

// PullScope is the per-family authorization filter for pull events.
// Wildcards lists root types the actor is fully entitled to (e.g. "review");
// ExactRefs lists specific roots the actor can see (e.g. {review, review-001}).
// An empty PullScope (both nil) matches zero events — the inverse of the old
// "entitled=nil fetches everything" bug.
type PullScope struct {
	Wildcards []string  // root types fully visible
	ExactRefs []RootRef // specific roots visible
}

// IsEmpty reports whether the scope grants no access.
func (s PullScope) IsEmpty() bool {
	return len(s.Wildcards) == 0 && len(s.ExactRefs) == 0
}

// SyncRepo is the persistence port for sync operations.
// Implementations: PostgresSyncRepo (production), FakeSyncRepo (unit tests).
type SyncRepo interface {
	// GetFieldVersion returns the current winning version for a field, or nil
	// if no version exists yet.
	GetFieldVersion(ctx context.Context, entityType, entityID, fieldName string) (*FieldVersion, error)

	// UpsertFieldVersion stores a field version (called after HLC comparison
	// confirms the incoming value wins).
	UpsertFieldVersion(ctx context.Context, fv FieldVersion) error

	// GetCursor returns the latest event time for a given actor, or empty
	// string if no events exist.
	GetCursor(ctx context.Context, actorID string) (string, error)

	// SaveCursor persists the cursor for an actor.
	SaveCursor(ctx context.Context, actorID, cursor string) error

	// PullEvents returns events after the given cursor, scoped to the
	// root types and root refs the actor is entitled to see.
	// Returns events and a hasMore flag. An empty scope returns zero events.
	PullEvents(ctx context.Context, actorID, after string, scope PullScope, limit int) ([]PullEvent, bool, error)

	// SaveEvent persists an accepted sync event to the events table.
	SaveEvent(ctx context.Context, ev SyncEvent) error
}

// Notifier is the port for emitting PostgreSQL NOTIFY messages.
// The push handler calls Notify after accepting events so peaky-sse can
// fan cursor pointers to connected SSE clients.
//
// Phase 1: PostgresNotifier (real PG call).
// Tests: NoopNotifier (silent no-op, keeps unit tests fast and DB-free).
type Notifier interface {
	// Notify sends pg_notify(channel, payload) on the given PG channel.
	// channel is the family-catalog channel "sync:{family}:catalog".
	Notify(ctx context.Context, channel, payload string) error
}
