package authz

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
)

// Actor represents an authenticated principal.
type Actor struct {
	ID           string                 `json:"id"`
	Email        string                 `json:"email"`
	Name         string                 `json:"name"`
	Entitlements map[string]Entitlement `json:"entitlements"`
}

// actorsFile is the JSON shape of seed/actors.json.
type actorsFile struct {
	Actors []Actor `json:"actors"`
}

// Registry holds all seeded actors and implements Authorizer.
// Phase 1: actors are loaded from seed/actors.json at startup.
// Phase 3: Okta + Cedar replace this with a JWT validator + policy engine.
// All methods are read-only after construction — safe for concurrent use.
type Registry struct {
	byID map[string]Actor
	dev  Actor // fallback when unknown actor_id is presented
}

// LoadRegistry reads actors from a JSON file and returns a ready Registry.
func LoadRegistry(path string) (*Registry, error) {
	//nolint:gosec // path comes from the trusted ACTORS_FILE environment variable.
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("actor registry: read %q: %w", path, err)
	}

	var f actorsFile
	if err := json.Unmarshal(data, &f); err != nil {
		return nil, fmt.Errorf("actor registry: parse %q: %w", path, err)
	}

	r := &Registry{byID: make(map[string]Actor, len(f.Actors))}
	for _, a := range f.Actors {
		r.byID[a.ID] = a
		if a.ID == "actor_dev" {
			r.dev = a
		}
	}

	return r, nil
}

// NewRegistryFromActors builds a Registry directly from a slice — used in tests.
func NewRegistryFromActors(actors []Actor) *Registry {
	r := &Registry{byID: make(map[string]Actor, len(actors))}
	for _, a := range actors {
		r.byID[a.ID] = a
		if a.ID == "actor_dev" {
			r.dev = a
		}
	}
	return r
}

// Get returns the actor for id, or the dev fallback for unknown IDs.
func (r *Registry) Get(id string) Actor {
	if a, ok := r.byID[id]; ok {
		return a
	}
	return r.dev
}

// ── Authorizer implementation ───────────────────────────────────────────────

var _ Authorizer = (*Registry)(nil)

func (r *Registry) ViewableEntities(ctx context.Context, actorID, entityType string) ([]string, error) {
	a := r.Get(actorID)

	// Wildcard: entityType:* means the actor can see all entities of that type
	if e, ok := a.Entitlements[entityType+":*"]; ok && e.CanView {
		return []string{"*"}, nil
	}

	// Enumerate specific entity entitlements
	var ids []string
	prefix := entityType + ":"
	for key, e := range a.Entitlements {
		if len(key) > len(prefix) && key[:len(prefix)] == prefix && e.CanView {
			ids = append(ids, key[len(prefix):])
		}
	}

	return ids, nil
}

func (r *Registry) CanView(ctx context.Context, actorID, entityType, entityID string) (bool, error) {
	resourceType, resourceID := resourceFor(entityType, entityID)
	a := r.Get(actorID)
	if e, ok := a.Entitlements[resourceType+":*"]; ok {
		return e.CanView, nil
	}
	e, ok := a.Entitlements[resourceType+":"+resourceID]
	return ok && e.CanView, nil
}

func (r *Registry) CanEdit(ctx context.Context, actorID, entityType, entityID string) (bool, error) {
	resourceType, resourceID := resourceFor(entityType, entityID)
	a := r.Get(actorID)
	if e, ok := a.Entitlements[resourceType+":*"]; ok {
		return e.CanEdit, nil
	}
	e, ok := a.Entitlements[resourceType+":"+resourceID]
	return ok && e.CanEdit, nil
}

func (r *Registry) Entitlements(ctx context.Context, actorID string) (map[string]Entitlement, error) {
	a := r.Get(actorID)
	return a.Entitlements, nil
}
