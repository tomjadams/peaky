package conflict_test

import (
	"context"
	"testing"

	"github.com/peaky-team/peaky/services/internal/syncengine/conflict"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

func TestApplyFields_NewerWins(t *testing.T) {
	// GIVEN an empty repo and a field with a fresh HLC
	r := repo.NewFakeSyncRepo()
	ctx := context.Background()

	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"yes"`), HLC: "1000:0001:alice"},
	}

	// WHEN applying the field
	results, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_alice", fields)

	// THEN the field is accepted and stored
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 || !results[0].Accepted {
		t.Errorf("expected field to be accepted, got %+v", results)
	}
	if r.FieldVersionCount() != 1 {
		t.Errorf("expected 1 field version stored, got %d", r.FieldVersionCount())
	}
}

func TestApplyFields_OlderRejected(t *testing.T) {
	// GIVEN a repo with a newer stored version
	r := repo.NewFakeSyncRepo()
	ctx := context.Background()

	_ = r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      new(`"yes"`),
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	})

	// WHEN pushing an older version
	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"no"`), HLC: "0999:0001:actor_bob"},
	}

	results, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_bob", fields)

	// THEN the field is rejected with hlc_conflict reason
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 || results[0].Accepted {
		t.Errorf("expected field to be rejected, got %+v", results)
	}
	if results[0].Reason != "hlc_conflict" {
		t.Errorf("expected hlc_conflict reason, got %q", results[0].Reason)
	}
}

func TestApplyFields_NonOverlappingFieldsAcceptedIndependently(t *testing.T) {
	// GIVEN alice's newer answer already stored
	r := repo.NewFakeSyncRepo()
	ctx := context.Background()

	_ = r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      new(`"yes"`),
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	})

	// WHEN bob pushes an older answer + newer naReason
	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"no"`), HLC: "0999:0001:actor_bob"},           // loses
		{Name: "naReason", Value: new(`"N/A for us"`), HLC: "1100:0001:actor_bob"}, // wins
	}

	results, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_bob", fields)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	byName := map[string]conflict.FieldResult{}
	for _, r := range results {
		byName[r.Name] = r
	}

	// THEN answer is rejected but naReason is accepted independently
	if byName["answer"].Accepted {
		t.Error("answer should be rejected (older HLC)")
	}
	if !byName["naReason"].Accepted {
		t.Error("naReason should be accepted (newer HLC, independent field)")
	}
	// 2 field versions: alice's answer + bob's naReason
	if r.FieldVersionCount() != 2 {
		t.Errorf("expected 2 field versions, got %d", r.FieldVersionCount())
	}
}

func TestApplyFields_IdenticalHLCActorTiebreaker(t *testing.T) {
	// GIVEN bob's version stored (bob < carol lexicographically)
	r := repo.NewFakeSyncRepo()
	ctx := context.Background()

	_ = r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      new(`"no"`),
		HLC:        "1000:0001",
		ActorID:    "actor_bob",
	})

	// WHEN carol pushes same wallclock:counter
	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"yes"`), HLC: "1000:0001:actor_carol"},
	}

	results, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_carol", fields)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// THEN carol wins (actor_carol > actor_bob lexicographically)
	if !results[0].Accepted {
		t.Error("carol should win tiebreaker against bob (actor_carol > actor_bob)")
	}
}

func TestApplyFields_GetFieldVersionError(t *testing.T) {
	// GIVEN a repo that errors on GetFieldVersion
	r := &repo.ErrorSyncRepo{}
	ctx := context.Background()

	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"yes"`), HLC: "1000:0001:alice"},
	}

	// WHEN applying fields THEN the error propagates
	_, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_alice", fields)
	if err == nil {
		t.Fatal("expected error from GetFieldVersion, got nil")
	}
}

// upsertErrorRepo returns nil from GetFieldVersion (simulating a new field)
// but errors on UpsertFieldVersion.
type upsertErrorRepo struct {
	repo.ErrorSyncRepo
}

func (r *upsertErrorRepo) GetFieldVersion(_ context.Context, _, _, _ string) (*repo.FieldVersion, error) {
	return nil, nil // new field, no existing version
}

func TestApplyFields_UpsertFieldVersionError(t *testing.T) {
	// GIVEN a repo that succeeds on Get but errors on Upsert
	r := &upsertErrorRepo{}
	ctx := context.Background()

	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"yes"`), HLC: "1000:0001:alice"},
	}

	// WHEN applying fields THEN the upsert error propagates
	_, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_alice", fields)
	if err == nil {
		t.Fatal("expected error from UpsertFieldVersion, got nil")
	}
}

func TestApplyFields_MalformedHLC_SoftReject(t *testing.T) {
	// GIVEN a field with a malformed HLC string
	r := repo.NewFakeSyncRepo()
	ctx := context.Background()

	fields := []repo.FieldValue{
		{Name: "answer", Value: new(`"yes"`), HLC: "not-a-valid-hlc"},
	}

	// WHEN applying the field
	results, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_alice", fields)

	// THEN it is soft-rejected (no hard error) and nothing stored
	if err != nil {
		t.Fatalf("unexpected hard error: %v", err)
	}
	if results[0].Accepted {
		t.Error("malformed HLC should result in soft rejection, not acceptance")
	}
	if r.FieldVersionCount() != 0 {
		t.Error("no field version should be stored for malformed HLC")
	}
}
