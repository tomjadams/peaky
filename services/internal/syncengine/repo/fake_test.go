package repo_test

import (
	"context"
	"slices"
	"testing"

	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// seedRoot is a test helper that stamps an event with its root fields set
// explicitly, mirroring what the push handler does via entity.RootFor.
func seedRoot(t *testing.T, r *repo.FakeSyncRepo, id, entityType, entityID, rootType, rootID string) {
	t.Helper()
	r.SeedEvent(repo.SyncEvent{
		ID:         id,
		EntityType: entityType,
		EntityID:   entityID,
		RootType:   rootType,
		RootID:     rootID,
		Operation:  "upsert",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:00:00Z",
	})
}

func fakeRepoWithRoots(t *testing.T) *repo.FakeSyncRepo {
	t.Helper()
	r := repo.NewFakeSyncRepo()
	// Two reviews, two products, one child under review-001.
	seedRoot(t, r, "rev-001", "review", "review-001", "review", "review-001")
	seedRoot(t, r, "rev-999", "review", "review-999", "review", "review-999")
	seedRoot(t, r, "rev-001-q1", "review_answer", "review-001:q1", "review", "review-001")
	seedRoot(t, r, "prod-1", "product", "prod-1", "product", "prod-1")
	seedRoot(t, r, "prod-2", "product", "prod-2", "product", "prod-2")
	return r
}

func TestFakePullEvents_EmptyScope_ReturnsNothing(t *testing.T) {
	r := fakeRepoWithRoots(t)
	ctx := context.Background()

	events, _, err := r.PullEvents(ctx, "actor_dev", "", repo.PullScope{}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("expected 0 events for empty scope, got %d", len(events))
	}
}

func TestFakePullEvents_WildcardMatchesFamily(t *testing.T) {
	r := fakeRepoWithRoots(t)
	ctx := context.Background()

	// review:* wildcard — all review-rooted events (review + child), no products.
	events, _, err := r.PullEvents(ctx, "actor_dev", "",
		repo.PullScope{Wildcards: []string{"review"}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	if len(events) != 3 {
		t.Fatalf("expected 3 review-rooted events, got %d: %v", len(events), ids)
	}
	for _, ev := range events {
		if ev.EntityType == "product" {
			t.Errorf("product leaked into review-wildcard pull: %s", ev.EntityID)
		}
	}
}

func TestFakePullEvents_ExactRefMatchesOnlyThatRoot(t *testing.T) {
	r := fakeRepoWithRoots(t)
	ctx := context.Background()

	// review:review-001 exact — review-001 + its child, never review-999.
	events, _, err := r.PullEvents(ctx, "actor_dev", "",
		repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-001"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	if len(events) != 2 {
		t.Fatalf("expected 2 events (review-001 + child), got %d: %v", len(events), ids)
	}
	if !slices.Contains(ids, "review-001") || !slices.Contains(ids, "review-001:q1") {
		t.Errorf("expected review-001 + child, got %v", ids)
	}
	if slices.Contains(ids, "review-999") {
		t.Errorf("review-999 leaked into exact-ref pull: %v", ids)
	}
}

func TestFakePullEvents_MixedWildcardAndExact(t *testing.T) {
	r := fakeRepoWithRoots(t)
	ctx := context.Background()

	// actor_bob shape: product:* + review:review-001.
	events, _, err := r.PullEvents(ctx, "actor_dev", "",
		repo.PullScope{
			Wildcards: []string{"product"},
			ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-001"}},
		}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	if !slices.Contains(ids, "prod-1") || !slices.Contains(ids, "prod-2") {
		t.Errorf("expected both products, got %v", ids)
	}
	if !slices.Contains(ids, "review-001") {
		t.Errorf("expected review-001, got %v", ids)
	}
	if slices.Contains(ids, "review-999") {
		t.Errorf("review-999 leaked into mixed scope: %v", ids)
	}
}

func TestFakePullEvents_ChildRidesAlongUnderParentRoot(t *testing.T) {
	r := fakeRepoWithRoots(t)
	ctx := context.Background()

	// Pulling review:review-001 returns the child answer too (same root).
	events, _, err := r.PullEvents(ctx, "actor_dev", "",
		repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-001"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	if !slices.Contains(ids, "review-001:q1") {
		t.Errorf("child answer did not ride along under review-001 root: %v", ids)
	}
}
