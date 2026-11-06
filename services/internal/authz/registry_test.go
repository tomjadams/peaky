package authz_test

import (
	"context"
	"testing"

	"github.com/peaky-team/peaky/services/internal/authz"
)

func makeTestRegistry(t *testing.T) *authz.Registry {
	t.Helper()
	return authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_dev",
			Email: "dev@peaky.local",
			Name:  "Dev",
			Entitlements: map[string]authz.Entitlement{
				"review:*": {CanView: true, CanEdit: true},
			},
		},
		{
			ID:    "actor_alice",
			Email: "alice@peaky.local",
			Name:  "Alice",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: true},
				"review:review-002": {CanView: true, CanEdit: false},
				"product:*":         {CanView: true, CanEdit: false},
			},
		},
	})
}

func TestRegistry_KnownActor(t *testing.T) {
	// GIVEN a registry with actor_alice
	reg := makeTestRegistry(t)

	// WHEN looking up a known actor
	a := reg.Get("actor_alice")

	// THEN the correct actor is returned
	if a.ID != "actor_alice" {
		t.Errorf("expected actor_alice, got %s", a.ID)
	}
	if a.Email != "alice@peaky.local" {
		t.Errorf("unexpected email: %s", a.Email)
	}
}

func TestRegistry_UnknownActor_ReturnsDev(t *testing.T) {
	// GIVEN a registry WHEN looking up an unknown actor
	reg := makeTestRegistry(t)
	a := reg.Get("unknown_actor")

	// THEN the dev fallback actor is returned
	if a.ID != "actor_dev" {
		t.Errorf("expected actor_dev fallback, got %s", a.ID)
	}
}

func TestRegistry_CanEdit_SpecificEntity(t *testing.T) {
	// GIVEN alice with edit access to review-001
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN checking CanEdit for review-001
	ok, err := reg.CanEdit(ctx, "actor_alice", "review", "review-001")

	// THEN access is granted
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("alice should be able to edit review-001")
	}
}

func TestRegistry_CanEdit_ViewOnlyEntity_Denied(t *testing.T) {
	// GIVEN alice with view-only access to review-002
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN checking CanEdit for review-002
	ok, err := reg.CanEdit(ctx, "actor_alice", "review", "review-002")

	// THEN access is denied
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("alice should NOT be able to edit review-002")
	}
}

func TestRegistry_CanView_WildcardEntitlement(t *testing.T) {
	// GIVEN alice with product:* wildcard view entitlement
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN checking CanView for any product ID
	ok, err := reg.CanView(ctx, "actor_alice", "product", "any-product-id")

	// THEN access is granted via wildcard
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("alice should be able to view any product (wildcard)")
	}
}

func TestRegistry_CanEdit_ResolvesEntityToGatingResource(t *testing.T) {
	// GIVEN alice can edit review-001 but only view review-002
	reg := makeTestRegistry(t)
	ctx := context.Background()

	tests := []struct {
		name       string
		entityType string
		entityID   string
		want       bool
	}{
		// the boundary resolves the gating resource from the raw entity
		{"keyed child resolves to its review", "review_answer", "review-001:security-q-1", true},
		{"keyed child under a view-only review is denied", "review_answer", "review-002:security-q-1", false},
		{"checkpoint shares the review id", "review_checkpoint", "review-001", true},
		{"the review itself", "review", "review-001", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ok, err := reg.CanEdit(ctx, "actor_alice", tt.entityType, tt.entityID)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if ok != tt.want {
				t.Errorf("CanEdit(%s, %s) = %v; want %v", tt.entityType, tt.entityID, ok, tt.want)
			}
		})
	}
}

func TestRegistry_ViewableEntities_Review_Wildcard(t *testing.T) {
	// GIVEN dev actor with review:* wildcard entitlement
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN listing viewable entities
	ids, err := reg.ViewableEntities(ctx, "actor_dev", "review")

	// THEN a single wildcard entry is returned
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 1 || ids[0] != "*" {
		t.Errorf("expected wildcard [*], got %v", ids)
	}
}

func TestRegistry_ViewableEntities_Review_Scoped(t *testing.T) {
	// GIVEN alice with two specific review entitlements
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN listing viewable review entities
	ids, err := reg.ViewableEntities(ctx, "actor_alice", "review")

	// THEN both scoped review IDs are returned
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 2 {
		t.Fatalf("expected 2 scoped review IDs, got %v", ids)
	}
	seen := map[string]bool{}
	for _, id := range ids {
		seen[id] = true
	}
	if !seen["review-001"] || !seen["review-002"] {
		t.Errorf("expected review-001 and review-002, got %v", ids)
	}
}

func TestRegistry_Entitlements_UnknownActor_ReturnsDevEntitlements(t *testing.T) {
	// GIVEN a registry with dev and alice actors
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN requesting entitlements for an unknown actor
	entitlements, err := reg.Entitlements(ctx, "unknown_actor")

	// THEN dev actor entitlements are returned as fallback
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := entitlements["review:*"]; !ok {
		t.Error("expected dev actor entitlements for unknown actor")
	}
}

func TestRegistry_ViewableEntities_Product_Wildcard(t *testing.T) {
	// GIVEN alice with product:* wildcard view entitlement
	reg := makeTestRegistry(t)
	ctx := context.Background()

	// WHEN listing viewable product entities
	ids, err := reg.ViewableEntities(ctx, "actor_alice", "product")

	// THEN a single wildcard entry is returned
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 1 || ids[0] != "*" {
		t.Errorf("expected wildcard [*] for product, got %v", ids)
	}
}

func TestRegistry_ViewableEntities_Product_Scoped(t *testing.T) {
	// GIVEN an actor with a scoped product:prod-1 entitlement (no wildcard)
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_scoped",
			Email: "scoped@peaky.local",
			Name:  "Scoped",
			Entitlements: map[string]authz.Entitlement{
				"product:prod-1": {CanView: true, CanEdit: false},
				"product:prod-2": {CanView: true, CanEdit: false},
			},
		},
	})
	ctx := context.Background()

	// WHEN listing viewable product entities
	ids, err := reg.ViewableEntities(ctx, "actor_scoped", "product")

	// THEN both scoped product IDs are returned (no wildcard)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(ids) != 2 {
		t.Fatalf("expected 2 scoped product IDs, got %v", ids)
	}
	seen := map[string]bool{}
	for _, id := range ids {
		seen[id] = true
	}
	if !seen["prod-1"] || !seen["prod-2"] {
		t.Errorf("expected prod-1 and prod-2, got %v", ids)
	}
}
