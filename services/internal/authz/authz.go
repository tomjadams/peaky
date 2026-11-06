// Package authz is the authorization boundary shared across features and the
// actor-registry stand-in that backs it today.
//
// Callers pass the RAW entity (entityType, entityID); this boundary owns both
// how an entity maps to the resource that gates it (resourceFor, see
// resource.go) and the decision itself. Features never resolve a resource or
// know a policy — they forward and enforce.
//
// Phase 1: backed by seed/actors.json (see Registry in registry.go).
// Next: a Cedar-backed AuthZ service — policies + schema in a policy store, the
// entity graph in Cedar's entity store — swapped in behind this same interface.
package authz

import "context"

// Authorizer is the authorization port. Callers pass raw domain entities; the
// implementation resolves the gating resource and decides.
// Phase 1: implemented by Registry (actors.json).
// Next: backed by a Cedar AuthZ service (drop-in replacement via this interface).
type Authorizer interface {
	// ViewableEntities returns the list of entity IDs of the given type that
	// the actor is allowed to view. An empty slice means no access.
	ViewableEntities(ctx context.Context, actorID, entityType string) ([]string, error)

	// CanView returns whether the actor can view a specific entity (raw type+id).
	CanView(ctx context.Context, actorID, entityType, entityID string) (bool, error)

	// CanEdit returns whether the actor can edit a specific entity (raw type+id).
	CanEdit(ctx context.Context, actorID, entityType, entityID string) (bool, error)

	// Entitlements returns the full entitlement set for the actor (for
	// snapshot caching on the client).
	Entitlements(ctx context.Context, actorID string) (map[string]Entitlement, error)
}

// Entitlement describes an actor's access level for a single entity key
// (entityType:entityID or entityType:* for wildcards).
type Entitlement struct {
	CanView bool
	CanEdit bool
}
