//go:build integration

package repo_test

import (
	"context"
	"testing"
	"time"

	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// local-first/REQ-011; AC-018: the three maturity/handoff review-child types
// persist and pull through the generic PostgreSQL field-version path — events
// are stamped with the owning review root, field history attaches, and a
// re-saved stable transition ID cannot duplicate history.

func TestPostgres_ReviewChildrenRoundTrip(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()
	at := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC).Format(time.RFC3339Nano)

	str := func(s string) *string { return &s }
	events := []repo.SyncEvent{
		{
			ID:         "evt-rc-practice",
			EntityType: "review_handoff_practice",
			EntityID:   "review_handoff_practice:review-001/rev-a/q-1/cl-1",
			RootType:   "review",
			RootID:     "review-001",
			Operation:  "upsert",
			ActorID:    "actor_editor",
			Fields: []repo.FieldValue{
				{Name: "orderKey", Value: str(`"a"`), HLC: "1000:0001:actor_editor"},
				{Name: "selectionState", Value: str(`"selected"`), HLC: "1000:0001:actor_editor"},
			},
			PushedAt: at,
		},
		{
			ID:         "evt-rc-association",
			EntityType: "review_handoff_association",
			EntityID:   "review_handoff_association:review-001/trn-1",
			RootType:   "review",
			RootID:     "review-001",
			Operation:  "upsert",
			ActorID:    "actor_editor",
			Fields: []repo.FieldValue{
				{Name: "action", Value: str(`"associate"`), HLC: "1000:0002:actor_editor"},
				{Name: "url", Value: str(`"https://example.com/t/1"`), HLC: "1000:0002:actor_editor"},
			},
			PushedAt: at,
		},
		{
			ID:         "evt-rc-override",
			EntityType: "review_maturity_override",
			EntityID:   "review_maturity_override:review-001/ov-1",
			RootType:   "review",
			RootID:     "review-001",
			Operation:  "upsert",
			ActorID:    "actor_advisor",
			Fields: []repo.FieldValue{
				{Name: "action", Value: str(`"create"`), HLC: "1000:0003:actor_advisor"},
				{Name: "reviewedStage", Value: str(`3`), HLC: "1000:0003:actor_advisor"},
			},
			PushedAt: at,
		},
	}

	for _, ev := range events {
		if err := r.SaveEvent(ctx, ev); err != nil {
			t.Fatalf("save %s: %v", ev.ID, err)
		}
		// A replayed stable transition ID must not duplicate history.
		if err := r.SaveEvent(ctx, ev); err != nil {
			t.Fatalf("replay %s: %v", ev.ID, err)
		}
	}

	pulled, hasMore, err := r.PullEvents(ctx, "actor_reader", "", repo.PullScope{
		ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-001"}},
	}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if hasMore {
		t.Fatal("unexpected hasMore")
	}
	if len(pulled) != 3 {
		t.Fatalf("expected 3 pulled events, got %d", len(pulled))
	}
	for _, ev := range pulled {
		if len(ev.Fields) == 0 {
			t.Errorf("pulled event %s has no attached field history", ev.ID)
		}
	}

	// An actor scoped to a different review sees none of the children.
	other, _, err := r.PullEvents(ctx, "actor_reader", "", repo.PullScope{
		ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-999"}},
	}, 100)
	if err != nil {
		t.Fatalf("scoped pull: %v", err)
	}
	if len(other) != 0 {
		t.Fatalf("children must not leak across review roots, got %v", other)
	}
}
