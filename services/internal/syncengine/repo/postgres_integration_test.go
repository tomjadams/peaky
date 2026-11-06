//go:build integration

package repo_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/peaky-team/peaky/services/internal/syncengine/entity"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
	"github.com/peaky-team/peaky/services/internal/testhelper"
)

func setupPostgres(t *testing.T) (*repo.PostgresSyncRepo, *sql.DB) {
	t.Helper()
	db := testhelper.StartPostgres(t)
	return repo.NewPostgresSyncRepo(db), db
}

// --- Atomic HLC upsert (the race condition we fixed) ---

func TestPostgres_UpsertFieldVersion_AtomicHLC(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	// Given: a field version exists with HLC=1000:0001
	err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"yes"`),
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	})
	if err != nil {
		t.Fatalf("seed upsert: %v", err)
	}

	// When: a stale push arrives with an older HLC
	err = r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"no"`),
		HLC:        "0999:0001",
		ActorID:    "actor_bob",
	})
	if err != nil {
		t.Fatalf("stale upsert: %v", err)
	}

	// Then: the newer value survives — the WHERE clause rejected the stale write
	fv, err := r.GetFieldVersion(ctx, "review_answer", "r1:q1", "answer")
	if err != nil {
		t.Fatalf("get field version: %v", err)
	}
	if fv.HLC != "1000:0001" {
		t.Errorf("stale HLC overwrote newer value: got HLC=%s, want 1000:0001", fv.HLC)
	}
	if fv.ActorID != "actor_alice" {
		t.Errorf("stale actor overwrote newer: got %s, want actor_alice", fv.ActorID)
	}
	if *fv.Value != `"yes"` {
		t.Errorf("stale value overwrote newer: got %s, want \"yes\"", *fv.Value)
	}
}

func TestPostgres_UpsertFieldVersion_NewerWins(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	// Given: a field version exists with HLC=1000:0001
	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"yes"`),
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	// When: a newer push arrives with HLC=2000:0001
	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"no"`),
		HLC:        "2000:0001",
		ActorID:    "actor_bob",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	// Then: the newer value wins
	fv, err := r.GetFieldVersion(ctx, "review_answer", "r1:q1", "answer")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if fv == nil {
		t.Fatal("expected non-nil field version")
	}
	if fv.HLC != "2000:0001" {
		t.Errorf("newer HLC did not win: got %s", fv.HLC)
	}
	if fv.Value == nil || *fv.Value != `"no"` {
		t.Errorf("newer value not stored: got %v", fv.Value)
	}
}

func TestPostgres_UpsertFieldVersion_ActorTiebreaker(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	// Given: a field version exists from actor_alice at HLC=1000:0001
	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"yes"`),
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	// When: actor_bob pushes with the same HLC (bob > alice lexicographically)
	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"no"`),
		HLC:        "1000:0001",
		ActorID:    "actor_bob",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	// Then: actor_bob wins the tiebreaker
	fv, err := r.GetFieldVersion(ctx, "review_answer", "r1:q1", "answer")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if fv == nil {
		t.Fatal("expected non-nil field version")
	}
	if fv.ActorID != "actor_bob" {
		t.Errorf("actor tiebreaker failed: got %s, want actor_bob", fv.ActorID)
	}
}

// --- Concurrent push race ---

func TestPostgres_ConcurrentUpsert_NewerSurvives(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	// Given: a baseline field version at HLC=0500:0001
	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"initial"`),
		HLC:        "0500:0001",
		ActorID:    "actor_seed",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	// When: 20 goroutines push to the same field with HLCs 1000..1019
	const goroutines = 20
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := range goroutines {
		go func(idx int) {
			defer wg.Done()
			hlc := fmt.Sprintf("%04d:0001", 1000+idx)
			if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
				EntityType: "review_answer",
				EntityID:   "r1:q1",
				FieldName:  "answer",
				Value:      strPtr(fmt.Sprintf(`"val-%d"`, idx)),
				HLC:        hlc,
				ActorID:    fmt.Sprintf("actor_%02d", idx),
			}); err != nil {
				t.Errorf("upsert goroutine %d: %v", idx, err)
			}
		}(i)
	}
	wg.Wait()

	// Then: the highest HLC (1019:0001) survives regardless of arrival order
	fv, err := r.GetFieldVersion(ctx, "review_answer", "r1:q1", "answer")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if fv.HLC != "1019:0001" {
		t.Errorf("concurrent race: expected HLC 1019:0001, got %s (value=%s, actor=%s)",
			fv.HLC, safeDeref(fv.Value), fv.ActorID)
	}
}

// --- Pull SQL correctness ---

func TestPostgres_PullEvents_EntitlementScoping(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()

	// Given: events exist for review-001 and review-999
	seedEvent(t, db, "evt-1", "review", "review-001", "actor_dev", time.Now().Add(-2*time.Minute))
	seedEvent(t, db, "evt-2", "review", "review-999", "actor_dev", time.Now().Add(-1*time.Minute))

	// When: pulling scoped to review-001 only
	events, _, err := r.PullEvents(ctx, "actor_alice", "", repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-001"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}

	// Then: only the entitled event is returned
	if len(events) != 1 {
		t.Fatalf("expected 1 scoped event, got %d", len(events))
	}
	if events[0].EntityID != "review-001" {
		t.Errorf("wrong entity: %s", events[0].EntityID)
	}
}

func TestPostgres_PullEvents_CursorFiltering(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()

	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 1, 11, 0, 0, 0, time.UTC)
	t3 := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	// Given: three events at t1, t2, t3
	seedEvent(t, db, "evt-a", "review", "r1", "actor_dev", t1)
	seedEvent(t, db, "evt-b", "review", "r1", "actor_dev", t2)
	seedEvent(t, db, "evt-c", "review", "r1", "actor_dev", t3)

	// When: pulling with cursor set to t1
	cursor := t1.Format(time.RFC3339Nano)
	events, _, err := r.PullEvents(ctx, "actor_dev", cursor, repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "r1"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}

	// Then: only events after the cursor are returned (t2, t3)
	if len(events) != 2 {
		t.Errorf("expected 2 events after cursor, got %d", len(events))
	}
}

func TestPostgres_PullEvents_CompositeNanoCursorFiltering(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()

	t1 := time.Date(2026, 1, 1, 10, 0, 0, 123456789, time.UTC)
	t2 := t1.Add(time.Second)
	seedEvent(t, db, "evt-a", "review", "r1", "actor_dev", t1)
	seedEvent(t, db, "evt-b", "review", "r1", "actor_dev", t2)

	cursor := t1.Format(time.RFC3339Nano) + ":evt-a"
	events, _, err := r.PullEvents(ctx, "actor_dev", cursor, repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "r1"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event after nano cursor, got %d", len(events))
	}
	if events[0].ID != "evt-b" {
		t.Fatalf("expected evt-b after nano cursor, got %s", events[0].ID)
	}
}

func TestPostgres_PullEvents_HasMorePagination(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()

	// Given: 5 events
	base := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	for i := range 5 {
		seedEvent(t, db, fmt.Sprintf("evt-%d", i), "review", "r1", "actor_dev",
			base.Add(time.Duration(i)*time.Minute))
	}

	// When: pulling with limit=3
	events, hasMore, err := r.PullEvents(ctx, "actor_dev", "", repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "r1"}}}, 3)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}

	// Then: 3 events returned and hasMore signals more pages exist
	if len(events) != 3 {
		t.Errorf("expected 3 events, got %d", len(events))
	}
	if !hasMore {
		t.Error("expected hasMore=true")
	}
}

func TestPostgres_PullEvents_FieldVersionsAttached(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()

	// Given: an event and a field version for the same entity
	seedEvent(t, db, "evt-1", "review_answer", "r1:q1", "actor_alice", time.Now().Add(-1*time.Minute))
	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      strPtr(`"yes"`),
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	// When: pulling events for that entity
	events, _, err := r.PullEvents(ctx, "actor_dev", "", repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "r1"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}

	// Then: the pulled event has the field version attached
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if len(events[0].Fields) == 0 {
		t.Error("expected fields attached to pulled event")
	}

	found := false
	for _, f := range events[0].Fields {
		if f.Name == "answer" && f.Value != nil && *f.Value == `"yes"` {
			found = true
		}
	}
	if !found {
		t.Error("field 'answer' with value '\"yes\"' not found in pulled event fields")
	}
}

func TestPostgres_PullEvents_AttachesHistoricalFieldValues(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	t1 := time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
	t2 := t1.Add(10 * time.Second)
	yes := `"yes"`
	no := `"no"`

	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      &yes,
		HLC:        "1000:0001",
		ActorID:    "actor_alice",
	}); err != nil {
		t.Fatalf("upsert yes: %v", err)
	}
	if err := r.SaveEvent(ctx, repo.SyncEvent{
		ID:         "evt-history-1",
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		RootType:   "review",
		RootID:     "r1",
		Operation:  "upsert",
		ActorID:    "actor_alice",
		Fields: []repo.FieldValue{
			{Name: "answer", Value: &yes, HLC: "1000:0001:actor_alice"},
		},
		PushedAt: t1.Format(time.RFC3339Nano),
	}); err != nil {
		t.Fatalf("save event 1: %v", err)
	}

	if err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		FieldName:  "answer",
		Value:      &no,
		HLC:        "2000:0001",
		ActorID:    "actor_alice",
	}); err != nil {
		t.Fatalf("upsert no: %v", err)
	}
	if err := r.SaveEvent(ctx, repo.SyncEvent{
		ID:         "evt-history-2",
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		RootType:   "review",
		RootID:     "r1",
		Operation:  "upsert",
		ActorID:    "actor_alice",
		Fields: []repo.FieldValue{
			{Name: "answer", Value: &no, HLC: "2000:0001:actor_alice"},
		},
		PushedAt: t2.Format(time.RFC3339Nano),
	}); err != nil {
		t.Fatalf("save event 2: %v", err)
	}

	events, _, err := r.PullEvents(ctx, "actor_dev", "", repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "r1"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}

	got := map[string]string{}
	for _, ev := range events {
		if len(ev.Fields) != 1 || ev.Fields[0].Value == nil {
			t.Fatalf("event %s fields = %+v, want one answer field", ev.ID, ev.Fields)
		}
		got[ev.ID] = *ev.Fields[0].Value
	}
	if got["evt-history-1"] != `"yes"` {
		t.Errorf("event 1 got current value %q, want historical \"yes\"", got["evt-history-1"])
	}
	if got["evt-history-2"] != `"no"` {
		t.Errorf("event 2 got %q, want \"no\"", got["evt-history-2"])
	}
}

func TestPostgres_SaveEvent_IdempotentReplay(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()

	value := `"yes"`
	event := repo.SyncEvent{
		ID:         "evt-idempotent",
		EntityType: "review_answer",
		EntityID:   "r1:q1",
		Operation:  "upsert",
		ActorID:    "actor_alice",
		Fields: []repo.FieldValue{
			{Name: "answer", Value: &value, HLC: "1000:0001:actor_alice"},
		},
		PushedAt: time.Date(2026, 6, 1, 10, 0, 0, 123456789, time.UTC).Format(time.RFC3339Nano),
	}

	if err := r.SaveEvent(ctx, event); err != nil {
		t.Fatalf("first save: %v", err)
	}
	if err := r.SaveEvent(ctx, event); err != nil {
		t.Fatalf("second save: %v", err)
	}

	var eventCount, fieldEventCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM events WHERE id = $1`, event.ID).Scan(&eventCount); err != nil {
		t.Fatalf("count events: %v", err)
	}
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM field_version_events WHERE event_id = $1`, event.ID).Scan(&fieldEventCount); err != nil {
		t.Fatalf("count field version events: %v", err)
	}
	if eventCount != 1 {
		t.Fatalf("expected 1 event row, got %d", eventCount)
	}
	if fieldEventCount != 1 {
		t.Fatalf("expected 1 field_version_events row, got %d", fieldEventCount)
	}
}

// --- JSONB type casting ---

func TestPostgres_FieldVersion_JSONBTypes(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	cases := []struct {
		name  string
		value string
	}{
		{"string", `"hello world"`},
		{"number", `42`},
		{"float", `3.14`},
		{"boolean_true", `true`},
		{"boolean_false", `false`},
		{"null", `null`},
		{"object", `{"key":"val","nested":{"a":1}}`},
		{"array", `[1,2,3]`},
		{"empty_object", `{}`},
		{"empty_array", `[]`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			fieldName := "field_" + tc.name
			val := tc.value

			// Given: a JSONB value of this type
			// When: upserted and read back
			err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
				EntityType: "test",
				EntityID:   "jsonb-types",
				FieldName:  fieldName,
				Value:      &val,
				HLC:        "1000:0001",
				ActorID:    "actor_test",
			})
			if err != nil {
				t.Fatalf("upsert: %v", err)
			}

			fv, err := r.GetFieldVersion(ctx, "test", "jsonb-types", fieldName)
			if err != nil {
				t.Fatalf("get: %v", err)
			}

			// Then: the value survives the PostgreSQL JSONB round-trip
			if fv.Value == nil {
				t.Fatal("expected non-nil value")
			}
			var got, want any
			if err := json.Unmarshal([]byte(*fv.Value), &got); err != nil {
				t.Fatalf("unmarshal got: %v", err)
			}
			if err := json.Unmarshal([]byte(tc.value), &want); err != nil {
				t.Fatalf("unmarshal want: %v", err)
			}
			if !reflect.DeepEqual(got, want) {
				t.Errorf("JSONB round-trip: got %v, want %v", got, want)
			}
		})
	}
}

func TestPostgres_FieldVersion_NullValue(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	// Given/When: upserting a field with nil value
	err := r.UpsertFieldVersion(ctx, repo.FieldVersion{
		EntityType: "test",
		EntityID:   "null-test",
		FieldName:  "nullable",
		Value:      nil,
		HLC:        "1000:0001",
		ActorID:    "actor_test",
	})
	if err != nil {
		t.Fatalf("upsert nil: %v", err)
	}

	// Then: the value round-trips as nil (SQL NULL), not as JSON "null"
	fv, err := r.GetFieldVersion(ctx, "test", "null-test", "nullable")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if fv.Value != nil {
		t.Errorf("expected nil value, got %q", *fv.Value)
	}
}

// --- pg_notify ---

func TestPostgres_Notify(t *testing.T) {
	_, db := setupPostgres(t)
	ctx := context.Background()

	notifier := repo.NewPostgresNotifier(db)

	// Given: a valid channel and JSON payload
	// When: pg_notify is called
	err := notifier.Notify(ctx, "sync:review:catalog", `{"cursor":"2026-01-01T00:00:00Z:evt-1","family":"review"}`)

	// Then: no error (notification delivered to PG)
	if err != nil {
		t.Fatalf("notify: %v", err)
	}
}

// --- Cursor round-trip ---

func TestPostgres_CursorRoundTrip(t *testing.T) {
	r, _ := setupPostgres(t)
	ctx := context.Background()

	// Given: no cursor exists for this actor
	cur, err := r.GetCursor(ctx, "actor_alice")
	if err != nil {
		t.Fatalf("get cursor: %v", err)
	}
	if cur != "" {
		t.Errorf("expected empty cursor, got %q", cur)
	}

	// When: saving a cursor
	_ = r.SaveCursor(ctx, "actor_alice", "2026-01-01T12:00:00Z")

	// Then: the cursor round-trips correctly
	cur, _ = r.GetCursor(ctx, "actor_alice")
	if cur != "2026-01-01T12:00:00Z" {
		t.Errorf("expected 2026-01-01T12:00:00Z, got %q", cur)
	}

	// When: updating the cursor
	_ = r.SaveCursor(ctx, "actor_alice", "2026-01-02T00:00:00Z")

	// Then: the updated value is returned
	cur, _ = r.GetCursor(ctx, "actor_alice")
	if cur != "2026-01-02T00:00:00Z" {
		t.Errorf("expected updated cursor, got %q", cur)
	}
}

// --- Per-family root-scoped pull (5A: #53 + #83 coverage) ---

// 5.2 — backfill correctness: every entity-scoped event has a non-null root.
func TestPostgres_PullEvents_RootsNeverNull(t *testing.T) {
	_, db := setupPostgres(t)
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	// Seed a mix of root types and child types.
	seedEvent(t, db, "root-1", "review", "review-001", "actor_dev", now)
	seedEvent(t, db, "root-2", "review_answer", "review-001:q1", "actor_dev", now)
	seedEvent(t, db, "root-3", "product", "prod-1", "actor_dev", now)
	seedEvent(t, db, "root-4", "review_note", "review-999:n1", "actor_dev", now)
	seedEvent(t, db, "root-5", "review_checkpoint", "review-001:cp-1", "actor_dev", now)

	var nullCount int
	err := db.QueryRowContext(context.Background(),
		`SELECT COUNT(*) FROM events WHERE root_type IS NULL OR root_id IS NULL`).Scan(&nullCount)
	if err != nil {
		t.Fatalf("query null roots: %v", err)
	}
	if nullCount != 0 {
		t.Errorf("expected 0 events with null root_type/root_id, got %d", nullCount)
	}
}

// 5.3 — #83 repro: a scoped actor pulls children of review-001 and never
// review-999 or its children.
func TestPostgres_PullEvents_ScopedReview_ChildrenOnly(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	seedEvent(t, db, "s3-1", "review", "review-001", "actor_dev", now.Add(-3*time.Minute))
	seedEvent(t, db, "s3-2", "review_answer", "review-001:q1", "actor_dev", now.Add(-2*time.Minute))
	seedEvent(t, db, "s3-3", "review", "review-999", "actor_dev", now.Add(-1*time.Minute))
	seedEvent(t, db, "s3-4", "review_answer", "review-999:q1", "actor_dev", now)

	// actor_scoped shape: review:review-001 only (no wildcard).
	events, _, err := r.PullEvents(ctx, "actor_scoped", "",
		repo.PullScope{ExactRefs: []repo.RootRef{{RootType: "review", RootID: "review-001"}}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	if len(events) != 2 {
		t.Fatalf("expected 2 events (review-001 + child), got %d: %v", len(events), ids)
	}
	if !slices.Contains(ids, "review-001") || !slices.Contains(ids, "review-001:q1") {
		t.Errorf("expected review-001 and its child, got %v", ids)
	}
	if slices.Contains(ids, "review-999") || slices.Contains(ids, "review-999:q1") {
		t.Errorf("review-999 or its child leaked into scoped pull: %v", ids)
	}
}

// 5.4 — #53 repro: actor_bob (product:* + review:review-001) returns all
// products + only review-001 (+children), never review-999.
func TestPostgres_PullEvents_BobWildcardProduct_ScopedReview(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	seedEvent(t, db, "s4-1", "product", "prod-1", "actor_dev", now.Add(-4*time.Minute))
	seedEvent(t, db, "s4-2", "product", "prod-2", "actor_dev", now.Add(-3*time.Minute))
	seedEvent(t, db, "s4-3", "review", "review-001", "actor_dev", now.Add(-2*time.Minute))
	seedEvent(t, db, "s4-4", "review_answer", "review-001:q1", "actor_dev", now.Add(-1*time.Minute))
	seedEvent(t, db, "s4-5", "review", "review-999", "actor_dev", now)

	// actor_bob shape: product:* wildcard + review:review-001 exact.
	events, _, err := r.PullEvents(ctx, "actor_bob", "",
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
	if !slices.Contains(ids, "review-001") || !slices.Contains(ids, "review-001:q1") {
		t.Errorf("expected review-001 + child, got %v", ids)
	}
	if slices.Contains(ids, "review-999") {
		t.Errorf("review-999 leaked into bob's pull (the #53 bug): %v", ids)
	}
}

// 5.5 — sealing: actor_reviewonly (review:* only) sees all reviews and ZERO
// product events.
func TestPostgres_PullEvents_ReviewOnlySealedFromProducts(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	seedEvent(t, db, "s5-1", "review", "review-001", "actor_dev", now.Add(-3*time.Minute))
	seedEvent(t, db, "s5-2", "review", "review-999", "actor_dev", now.Add(-2*time.Minute))
	seedEvent(t, db, "s5-3", "product", "prod-1", "actor_dev", now.Add(-1*time.Minute))
	seedEvent(t, db, "s5-4", "product", "prod-2", "actor_dev", now)

	// actor_reviewonly shape: review:* wildcard only.
	events, _, err := r.PullEvents(ctx, "actor_reviewonly", "",
		repo.PullScope{Wildcards: []string{"review"}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	for _, ev := range events {
		if ev.EntityType == "product" {
			t.Errorf("product event leaked into review-only pull: %s", ev.EntityID)
		}
	}
	if !slices.Contains(ids, "review-001") || !slices.Contains(ids, "review-999") {
		t.Errorf("expected both reviews, got %v", ids)
	}
}

// 5.6 — exact within-family isolation: actor_scoped (product:prod-1 +
// review:review-001) returns prod-1 + review-001 children, never prod-2 or
// review-999.
func TestPostgres_PullEvents_ScopedExactIsolation(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	seedEvent(t, db, "s6-1", "product", "prod-1", "actor_dev", now.Add(-4*time.Minute))
	seedEvent(t, db, "s6-2", "product", "prod-2", "actor_dev", now.Add(-3*time.Minute))
	seedEvent(t, db, "s6-3", "review", "review-001", "actor_dev", now.Add(-2*time.Minute))
	seedEvent(t, db, "s6-4", "review_answer", "review-001:q1", "actor_dev", now.Add(-1*time.Minute))
	seedEvent(t, db, "s6-5", "review", "review-999", "actor_dev", now)

	// actor_scoped shape: product:prod-1 + review:review-001 (no wildcards).
	events, _, err := r.PullEvents(ctx, "actor_scoped", "",
		repo.PullScope{ExactRefs: []repo.RootRef{
			{RootType: "product", RootID: "prod-1"},
			{RootType: "review", RootID: "review-001"},
		}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	ids := entityIDs(events)
	if !slices.Contains(ids, "prod-1") || !slices.Contains(ids, "review-001") || !slices.Contains(ids, "review-001:q1") {
		t.Errorf("expected prod-1 + review-001 + child, got %v", ids)
	}
	if slices.Contains(ids, "prod-2") {
		t.Errorf("prod-2 leaked into scoped pull: %v", ids)
	}
	if slices.Contains(ids, "review-999") {
		t.Errorf("review-999 leaked into scoped pull: %v", ids)
	}
}

// 5.7 — regression guard: dev/admin (wildcard on both families) see
// everything, unchanged before/after.
func TestPostgres_PullEvents_DevAdminSeesAll(t *testing.T) {
	r, db := setupPostgres(t)
	ctx := context.Background()
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)

	seedEvent(t, db, "s7-1", "review", "review-001", "actor_dev", now.Add(-4*time.Minute))
	seedEvent(t, db, "s7-2", "review_answer", "review-001:q1", "actor_dev", now.Add(-3*time.Minute))
	seedEvent(t, db, "s7-3", "review", "review-999", "actor_dev", now.Add(-2*time.Minute))
	seedEvent(t, db, "s7-4", "product", "prod-1", "actor_dev", now.Add(-1*time.Minute))
	seedEvent(t, db, "s7-5", "product", "prod-2", "actor_dev", now)

	// dev/admin shape: wildcard on both review and product.
	events, _, err := r.PullEvents(ctx, "actor_dev", "",
		repo.PullScope{Wildcards: []string{"product", "review"}}, 100)
	if err != nil {
		t.Fatalf("pull: %v", err)
	}
	if len(events) != 5 {
		ids := entityIDs(events)
		t.Errorf("expected all 5 events for dev/admin, got %d: %v", len(events), ids)
	}
}

// --- helpers ---

func strPtr(s string) *string { return &s }

func safeDeref(p *string) string {
	if p == nil {
		return "<nil>"
	}
	return *p
}

func seedEvent(t *testing.T, db *sql.DB, id, entityType, entityID, actorID string, at time.Time) {
	t.Helper()
	rootType, rootID, ok := entity.RootFor(entityType, entityID)
	if !ok {
		t.Fatalf("seed event %s: cannot resolve root for (%s, %s)", id, entityType, entityID)
	}
	_, err := db.ExecContext(context.Background(),
		`INSERT INTO events (id, specversion, event_type, actor_type, actor_id, time, status, source, entity_type, entity_id, root_type, root_id, operation)
		 VALUES ($1, '1.0', 'SyncEvent.v1', 'user', $2, $3, 'synced', 'peaky.sync', $4, $5, $6, $7, 'upsert')
		 ON CONFLICT (id) DO NOTHING`,
		id, actorID, at, entityType, entityID, rootType, rootID)
	if err != nil {
		t.Fatalf("seed event %s: %v", id, err)
	}
}
