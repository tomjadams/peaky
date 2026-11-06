package syncengine

import "encoding/json"

// This file holds the JSON request/response DTOs for the sync endpoints.
// Handler logic lives alongside each endpoint (handler.go, push.go, pull.go).

// ── Bootstrap / entitlements ────────────────────────────────────────────────

type entitlement struct {
	CanView bool `json:"canView"`
	CanEdit bool `json:"canEdit"`
}

type bootstrapResponse struct {
	ActorID       string                 `json:"actorId"`
	ActorName     string                 `json:"actorName"`
	ActorEmail    string                 `json:"actorEmail"`
	Entitlements  map[string]entitlement `json:"entitlements"`
	Cursors       bootstrapCursors       `json:"cursors"`
	EngineVersion string                 `json:"engineVersion"`
}

type bootstrapCursors struct {
	Local  *string `json:"local"`
	Remote *string `json:"remote"`
}

type entitlementsResponse struct {
	Current       entitlementsSnapshot `json:"current"`
	HasDowngrades bool                 `json:"hasDowngrades"`
	Changes       []entitlementChange  `json:"changes"`
}

type entitlementsSnapshot struct {
	ActorID      string                 `json:"actorId"`
	Entitlements map[string]entitlement `json:"entitlements"`
}

type entitlementChange struct {
	EntityType string `json:"entityType"`
	EntityID   string `json:"entityId"`
	NewStatus  string `json:"newStatus"` // "edit" | "view" | "none"
	Reason     string `json:"reason"`
}

// ── Push ────────────────────────────────────────────────────────────────────

// pushRequest is the validated body of POST /api/sync/push.
type pushRequest struct {
	ClientCursor *string     `json:"clientCursor"`
	Events       []pushEvent `json:"events"`
}

type pushEvent struct {
	ID         string          `json:"id"`
	EntityType string          `json:"entityType"`
	EntityID   string          `json:"entityId"`
	Operation  string          `json:"operation"` // "create" | "upsert" | "update" | "delete"
	ActorID    string          `json:"actorId"`
	Fields     json.RawMessage `json:"fields"` // must be []pushField — kept raw to reject gracefully
	PushedAt   string          `json:"pushedAt"`
}

type pushField struct {
	Name  string `json:"name"`
	Value any    `json:"value"` // any JSON value — serialised before storage
	HLC   string `json:"hlc"`
}

type pushResponse struct {
	Accepted []string        `json:"accepted"`
	Rejected []rejectedEvent `json:"rejected"`
	// NewClientCursor is the local (push-dedup) cursor only. Push never
	// returns a remote (pull-window) cursor: the two are independent, and
	// advancing the pull cursor from a push value would skip other actors'
	// events in the stream (see openspec/specs/sync-engine/spec.md).
	NewClientCursor string `json:"newClientCursor"`
}

type rejectedEvent struct {
	ID             string          `json:"id"`
	Reason         string          `json:"reason"`
	FieldConflicts []fieldConflict `json:"fieldConflicts,omitempty"`
}

type fieldConflict struct {
	Field  string `json:"field"`
	Reason string `json:"reason"`
}

// ── Pull ────────────────────────────────────────────────────────────────────

type pullResponse struct {
	Events  []pullEvent `json:"events"`
	Cursor  string      `json:"cursor"`
	HasMore bool        `json:"hasMore"`
}

type pullEvent struct {
	ID         string      `json:"id"`
	EntityType string      `json:"entityType"`
	EntityID   string      `json:"entityId"`
	Operation  string      `json:"operation"`
	ActorID    string      `json:"actorId"`
	Fields     []pullField `json:"fields"`
	Time       string      `json:"time"`
}

type pullField struct {
	Name  string  `json:"name"`
	Value *string `json:"value"` // JSON-encoded or null
	HLC   string  `json:"hlc"`
}
