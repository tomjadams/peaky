package syncengine_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/ssecontract"
	"github.com/peaky-team/peaky/services/internal/syncengine"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// setup creates a test Fuego server with the Actor middleware and returns
// the configured Handlers plus a helper to fire requests as a given actor.
func setup(t *testing.T) (*fuego.Server, *syncengine.Handlers, *authz.Registry, *repo.FakeSyncRepo) {
	t.Helper()
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_dev",
			Email: "dev@peaky.local",
			Name:  "Dev",
			Entitlements: map[string]authz.Entitlement{
				"review:*":  {CanView: true, CanEdit: true},
				"product:*": {CanView: true, CanEdit: true},
			},
		},
		{
			ID:    "actor_alice",
			Email: "alice@peaky.local",
			Name:  "Alice",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: true},
			},
		},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Get(s, "/api/sync/bootstrap", h.Bootstrap)
	fuego.Post(s, "/api/sync/push", h.Push)
	fuego.Get(s, "/api/sync/pull", h.Pull)
	fuego.Get(s, "/api/sync/entitlements", h.Entitlements)
	return s, h, reg, r
}

func actorRequest(t *testing.T, method, path string, body any, actorID string) *http.Request {
	t.Helper()
	var buf *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = bytes.NewBuffer(b)
	} else {
		buf = &bytes.Buffer{}
	}
	req := httptest.NewRequestWithContext(t.Context(), method, path, buf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-actor-id", actorID)
	return req
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

func TestBootstrap_ReturnsActorAndEntitlements(t *testing.T) {
	// GIVEN an authenticated actor with review entitlements
	_, h, _, _ := setup(t)

	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Email: "alice@peaky.local", Name: "Alice",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: true},
			}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Get(s, "/api/sync/bootstrap", h.Bootstrap)

	// WHEN the actor calls bootstrap
	req := actorRequest(t, http.MethodGet, "/api/sync/bootstrap", nil, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the response contains actor info, engine version, and entitlements
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["actorId"] != "actor_alice" {
		t.Errorf("expected actorId=actor_alice, got %v", resp["actorId"])
	}
	if resp["engineVersion"] != "1.0" {
		t.Errorf("expected engineVersion=1.0, got %v", resp["engineVersion"])
	}
	if resp["entitlements"] == nil {
		t.Error("expected entitlements in response")
	}
}

func TestBootstrap_ReturnsLocalCursorOnly(t *testing.T) {
	// GIVEN a server-side cursor for the actor
	_, h, _, r := setup(t)
	ctx := context.Background()
	if err := r.SaveCursor(ctx, "actor_alice", "2026-01-01T12:00:00Z:evt-1"); err != nil {
		t.Fatalf("save cursor: %v", err)
	}

	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Email: "alice@peaky.local", Name: "Alice",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: true},
			}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Get(s, "/api/sync/bootstrap", h.Bootstrap)

	// WHEN the actor calls bootstrap
	req := actorRequest(t, http.MethodGet, "/api/sync/bootstrap", nil, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// THEN bootstrap exposes the push-dedup cursor as local only. Remote pull
	// cursor remains nil so fresh clients re-pull from the beginning.
	var resp struct {
		Cursors struct {
			Local  *string `json:"local"`
			Remote *string `json:"remote"`
		} `json:"cursors"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp.Cursors.Local == nil || *resp.Cursors.Local != "2026-01-01T12:00:00Z:evt-1" {
		t.Fatalf("expected local cursor, got %#v", resp.Cursors.Local)
	}
	if resp.Cursors.Remote != nil {
		t.Fatalf("expected nil remote cursor, got %q", *resp.Cursors.Remote)
	}
}

// ── Push ─────────────────────────────────────────────────────────────────────

func TestPush_AcceptsFieldLevelEvents(t *testing.T) {
	// GIVEN a valid push event with one field update
	_, h, _, r := setup(t)

	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-001",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "in-progress", "hlc": "1000000000000:0001:actor_dev"},
				},
			},
		},
	}

	// WHEN the authorized actor pushes the event
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is accepted and the field version is stored
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	accepted := resp["accepted"].([]any)
	if len(accepted) != 1 || accepted[0] != "evt-001" {
		t.Errorf("expected evt-001 in accepted, got %v", accepted)
	}
	if r.FieldVersionCount() != 1 {
		t.Errorf("expected 1 field version stored, got %d", r.FieldVersionCount())
	}
}

func TestPush_DoesNotValidateReviewTemplateRevisionSelections(t *testing.T) {
	_, h, _, r := setup(t)
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{{
			"id":         "evt-review-selection-gap",
			"entityType": "review",
			"entityId":   "review-001",
			"operation":  "upsert",
			"actorId":    "actor_dev",
			"pushedAt":   "2026-01-01T00:00:00Z",
			"fields": []map[string]any{{
				"name":  "templateRevisionIds",
				"value": []string{"revision-a", "revision-a", "revision-a", "revision-a"},
				"hlc":   "1000000000000:0001:actor_dev",
			}},
		}},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected generic push acceptance, got %d: %s", rec.Code, rec.Body.String())
	}
	if r.FieldVersionCount() != 1 {
		t.Fatalf("expected unvalidated generic field storage, got %d", r.FieldVersionCount())
	}
}

func TestPush_RejectsUnauthorizedEntity(t *testing.T) {
	// GIVEN an actor with access only to review-001
	_, h, _, _ := setup(t)

	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Entitlements: map[string]authz.Entitlement{
			"review:review-001": {CanView: true, CanEdit: true},
		}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-002",
				"entityType": "review",
				"entityId":   "review-999",
				"operation":  "upsert",
				"actorId":    "actor_alice",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes an event for review-999
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with access_revoked
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %v", rejected)
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "access_revoked" {
		t.Errorf("expected access_revoked, got %v", first["reason"])
	}
}

func TestPush_InvalidJSONBody(t *testing.T) {
	// GIVEN a request with an invalid JSON body
	_, h, _, _ := setup(t)

	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN the actor pushes the malformed body
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sync/push",
		bytes.NewBufferString("not json"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-actor-id", "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the handler returns a 400 Bad Request error
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

// ── Pull ─────────────────────────────────────────────────────────────────────

func TestPull_ReturnsScopedEvents(t *testing.T) {
	// GIVEN events for review-001 (alice entitled) and review-999 (not)
	s, _, _, r := setup(t)

	r.SeedEvent(repo.SyncEvent{
		ID:         "evt-seed-001",
		EntityType: "review",
		EntityID:   "review-001",
		RootType:   "review",
		RootID:     "review-001",
		Operation:  "upsert",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:01:00Z",
	})
	r.SeedEvent(repo.SyncEvent{
		ID:         "evt-seed-002",
		EntityType: "review",
		EntityID:   "review-999",
		RootType:   "review",
		RootID:     "review-999",
		Operation:  "upsert",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:02:00Z",
	})

	// WHEN alice pulls events
	req := actorRequest(t, http.MethodGet, "/api/sync/pull?after=", nil, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN only the entitled event is returned
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 1 {
		t.Errorf("expected 1 event (scoped to alice's entitlements), got %d", len(events))
	}
}

func TestPull_WildcardFamilyDoesNotCollapseScope(t *testing.T) {
	// GIVEN actor_bob with product:* (wildcard) + review:review-001 (scoped).
	// The old entitled=nil collapse would fetch every family unfiltered,
	// leaking review-999 into bob's pull. The fix builds per-family scope.
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_bob",
			Email: "bob@peaky.local",
			Name:  "Bob",
			Entitlements: map[string]authz.Entitlement{
				"product:*":         {CanView: true, CanEdit: true},
				"review:review-001": {CanView: true, CanEdit: true},
			},
		},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Get(s, "/api/sync/pull", h.Pull)

	r.SeedEvent(repo.SyncEvent{
		ID: "evt-prod-1", EntityType: "product", EntityID: "prod-1",
		RootType: "product", RootID: "prod-1",
		Operation: "upsert", ActorID: "actor_dev", PushedAt: "2026-01-01T00:01:00Z",
	})
	r.SeedEvent(repo.SyncEvent{
		ID: "evt-rev-001", EntityType: "review", EntityID: "review-001",
		RootType: "review", RootID: "review-001",
		Operation: "upsert", ActorID: "actor_dev", PushedAt: "2026-01-01T00:02:00Z",
	})
	r.SeedEvent(repo.SyncEvent{
		ID: "evt-rev-999", EntityType: "review", EntityID: "review-999",
		RootType: "review", RootID: "review-999",
		Operation: "upsert", ActorID: "actor_dev", PushedAt: "2026-01-01T00:03:00Z",
	})

	// WHEN bob pulls
	req := actorRequest(t, http.MethodGet, "/api/sync/pull?after=", nil, "actor_bob")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN bob sees prod-1 (wildcard) + review-001 (scoped), NOT review-999
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 2 {
		t.Fatalf("expected 2 events (prod-1 + review-001), got %d", len(events))
	}
	seen := map[string]bool{}
	for _, ev := range events {
		id := ev.(map[string]any)["entityId"].(string)
		seen[id] = true
	}
	if !seen["prod-1"] {
		t.Error("expected prod-1 in bob's pull (product:* wildcard)")
	}
	if !seen["review-001"] {
		t.Error("expected review-001 in bob's pull (scoped entitlement)")
	}
	if seen["review-999"] {
		t.Error("review-999 leaked into bob's pull (the #53 bug)")
	}
}

func TestPull_ScopedActorReceivesChildren(t *testing.T) {
	// GIVEN alice entitled to review:review-001 only, with a root event
	// and a child answer event both rooted at review-001 (#83 repro).
	s, _, _, r := setup(t)

	r.SeedEvent(repo.SyncEvent{
		ID: "evt-root", EntityType: "review", EntityID: "review-001",
		RootType: "review", RootID: "review-001",
		Operation: "upsert", ActorID: "actor_dev", PushedAt: "2026-01-01T00:01:00Z",
	})
	r.SeedEvent(repo.SyncEvent{
		ID: "evt-child", EntityType: "review_answer", EntityID: "review-001:q1",
		RootType: "review", RootID: "review-001",
		Operation: "upsert", ActorID: "actor_dev", PushedAt: "2026-01-01T00:02:00Z",
	})

	// WHEN alice pulls
	req := actorRequest(t, http.MethodGet, "/api/sync/pull?after=", nil, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN alice receives both the root event and its child (ride-along).
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 2 {
		t.Fatalf("expected 2 events (root + child), got %d", len(events))
	}
	seen := map[string]bool{}
	for _, ev := range events {
		id := ev.(map[string]any)["entityId"].(string)
		seen[id] = true
	}
	if !seen["review-001"] {
		t.Error("expected review-001 root event in alice's pull")
	}
	if !seen["review-001:q1"] {
		t.Error("expected review-001:q1 child event to ride along (the #83 fix)")
	}
}

func TestEntitlements_ReturnsCurrentSnapshot(t *testing.T) {
	// GIVEN an authenticated actor with review and product entitlements
	s, _, _, _ := setup(t)

	// WHEN the actor requests their entitlements
	req := actorRequest(t, http.MethodGet, "/api/sync/entitlements", nil, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the snapshot contains actor info and no downgrades
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp["hasDowngrades"] != false {
		t.Error("Phase 1: hasDowngrades should always be false")
	}
	current := resp["current"].(map[string]any)
	if current["actorId"] != "actor_dev" {
		t.Errorf("expected actorId=actor_dev, got %v", current["actorId"])
	}
}

// ── SSE notification ──────────────────────────────────────────────────────────

func TestPush_NotifiesSSEOnAcceptedEvent(t *testing.T) {
	// GIVEN a handler with an SSE notifier attached
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN an authorized actor pushes a valid event
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-notify-01",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T12:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN SSE notifier fires once on the correct channel
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if notifier.CallCount() != 1 {
		t.Errorf("expected 1 Notify call, got %d", notifier.CallCount())
	}
	calls := notifier.Calls()
	if calls[0].Channel != "sync:review:catalog" {
		t.Errorf("expected channel sync:review:catalog, got %s", calls[0].Channel)
	}
	// Decode into the wire contract rather than substring-matching so the test
	// is immune to JSON key ordering/spacing, and assert the payload carries
	// nothing beyond {cursor, family}.
	var got ssecontract.CursorNotification
	if err := json.Unmarshal([]byte(calls[0].Payload), &got); err != nil {
		t.Fatalf("payload is not a valid CursorNotification: %v (raw: %s)", err, calls[0].Payload)
	}
	if got.Family != "review" {
		t.Errorf("expected family review, got %q", got.Family)
	}
	if got.Cursor == "" {
		t.Errorf("expected a non-empty cursor in payload, got %q", got.Cursor)
	}
	var raw map[string]any
	if err := json.Unmarshal([]byte(calls[0].Payload), &raw); err != nil {
		t.Fatalf("payload is not a JSON object: %v", err)
	}
	for k := range raw {
		if k != "cursor" && k != "family" {
			t.Errorf("payload carries unexpected field %q (must be cursor/family only): %s", k, calls[0].Payload)
		}
	}
}

func TestPush_DoesNotNotifyOnRejectedEvent(t *testing.T) {
	// GIVEN an actor without access to review-999 and an SSE notifier
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Entitlements: map[string]authz.Entitlement{
			"review:review-001": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN the actor pushes an event for the unauthorized review
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-rejected-01",
				"entityType": "review",
				"entityId":   "review-999",
				"operation":  "upsert",
				"actorId":    "actor_alice",
				"pushedAt":   "2026-01-01T12:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN no SSE notification is sent
	if notifier.CallCount() != 0 {
		t.Errorf("expected 0 Notify calls for rejected-only push, got %d", notifier.CallCount())
	}
}

func TestPush_DoesNotNotifyOnFullHLCConflict(t *testing.T) {
	// GIVEN a stored field whose HLC already beats every incoming field
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	winner := `"winning-status"`
	_ = r.UpsertFieldVersion(context.Background(), repo.FieldVersion{
		EntityType: "review", EntityID: "review-001", FieldName: "status",
		Value: &winner, HLC: "9999999999999:0001", ActorID: "actor_zzz",
	})
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN every field in the push loses its HLC contest (whole event rejected)
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id": "evt-full-reject", "entityType": "review", "entityId": "review-001",
				"operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "stale", "hlc": "1000000000000:0001:actor_dev"},
				},
			},
		},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN nothing persisted, so the family doorbell stays silent
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if notifier.CallCount() != 0 {
		t.Errorf("expected 0 Notify on full HLC reject, got %d", notifier.CallCount())
	}
}

func TestPush_DeduplicatesNotifyPerFamily(t *testing.T) {
	// GIVEN an actor who can edit reviews and an SSE notifier
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN two review events land in one batch
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{"id": "evt-r1", "entityType": "review", "entityId": "review-001", "operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:00Z", "fields": []map[string]any{}},
			{"id": "evt-r2", "entityType": "review", "entityId": "review-002", "operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:01Z", "fields": []map[string]any{}},
		},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the family doorbell rings exactly once
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if notifier.CallCount() != 1 {
		t.Fatalf("expected 1 deduped Notify, got %d", notifier.CallCount())
	}
	if got := notifier.Calls()[0].Channel; got != "sync:review:catalog" {
		t.Errorf("expected channel sync:review:catalog, got %s", got)
	}
}

func TestPush_NotifiesOncePerDistinctFamily(t *testing.T) {
	// GIVEN an actor who can edit reviews and products
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*":  {CanView: true, CanEdit: true},
			"product:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN a batch spans a review and a product
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{"id": "evt-rev", "entityType": "review", "entityId": "review-001", "operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:00Z", "fields": []map[string]any{}},
			{"id": "evt-prod", "entityType": "product", "entityId": "product-001", "operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:01Z", "fields": []map[string]any{}},
		},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN exactly one notify fires per distinct family channel
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if notifier.CallCount() != 2 {
		t.Fatalf("expected exactly 2 Notify calls (one per family), got %d: %v", notifier.CallCount(), notifier.Calls())
	}
	got := map[string]bool{}
	for _, c := range notifier.Calls() {
		got[c.Channel] = true
	}
	if len(got) != 2 || !got["sync:review:catalog"] || !got["sync:product:catalog"] {
		t.Errorf("expected one notify each on review and product catalog, got %v", got)
	}
}

func TestPush_NotifiesOnPartialAccept(t *testing.T) {
	// GIVEN a stored field whose HLC already beats the incoming title
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	old := `"old-title"`
	_ = r.UpsertFieldVersion(context.Background(), repo.FieldVersion{
		EntityType: "review", EntityID: "review-001", FieldName: "title",
		Value: &old, HLC: "9999999999999:0001", ActorID: "actor_zzz",
	})
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN a push carries one losing field (title) and one winning field (status)
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id": "evt-partial", "entityType": "review", "entityId": "review-001",
				"operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:00Z",
				"fields": []map[string]any{
					{"name": "title", "value": "new-title", "hlc": "1000000000000:0001:actor_dev"},
					{"name": "status", "value": "ready", "hlc": "2000000000000:0001:actor_dev"},
				},
			},
		},
	}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the partial accept still rings the family doorbell exactly once
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if notifier.CallCount() != 1 {
		t.Fatalf("expected 1 Notify on partial accept, got %d", notifier.CallCount())
	}
	if got := notifier.Calls()[0].Channel; got != "sync:review:catalog" {
		t.Errorf("expected channel sync:review:catalog, got %s", got)
	}
}

// using in-memory fakes. No MySQL required.
func TestIntegration_BootstrapPushPull(t *testing.T) {
	// GIVEN two actors (alice, bob) with wildcard review access
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Email: "alice@peaky.local", Name: "Alice",
			Entitlements: map[string]authz.Entitlement{
				"review:*": {CanView: true, CanEdit: true},
			}},
		{ID: "actor_bob", Email: "bob@peaky.local", Name: "Bob",
			Entitlements: map[string]authz.Entitlement{
				"review:*": {CanView: true, CanEdit: true},
			}},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Get(s, "/api/sync/bootstrap", h.Bootstrap)
	fuego.Post(s, "/api/sync/push", h.Push)
	fuego.Get(s, "/api/sync/pull", h.Pull)

	actorReq := func(method, path string, body any, id string) *http.Request {
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequestWithContext(t.Context(), method, path, &buf)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-actor-id", id)
		return req
	}

	call := func(req *http.Request) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		s.Mux.ServeHTTP(rec, req)
		return rec
	}

	// WHEN/THEN 1. Bootstrap — alice gets empty cursors
	{
		rec := call(actorReq(http.MethodGet, "/api/sync/bootstrap", nil, "actor_alice"))
		if rec.Code != http.StatusOK {
			t.Fatalf("bootstrap failed: %d %s", rec.Code, rec.Body.String())
		}
	}

	// WHEN/THEN 2. Push — alice sends a field update
	pushBody := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "alice-evt-001",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_alice",
				"pushedAt":   "2026-01-01T12:00:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "in-progress", "hlc": "1748779200000:0001:actor_alice"},
				},
			},
		},
	}
	{
		rec := call(actorReq(http.MethodPost, "/api/sync/push", pushBody, "actor_alice"))
		if rec.Code != http.StatusOK {
			t.Fatalf("push failed: %d %s", rec.Code, rec.Body.String())
		}
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		accepted := resp["accepted"].([]any)
		if len(accepted) != 1 {
			t.Fatalf("expected 1 accepted, got %v", accepted)
		}
	}

	// WHEN/THEN 3. Pull — bob pulls and sees alice's event
	{
		req := actorReq(http.MethodGet, "/api/sync/pull?after=", nil, "actor_bob")
		rec := call(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("pull failed: %d %s", rec.Code, rec.Body.String())
		}
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		events := resp["events"].([]any)
		if len(events) != 1 {
			t.Fatalf("expected 1 event in pull, got %d", len(events))
		}
	}
}

// TestIntegration_TwoActorConflict verifies field-level conflict resolution.
func TestIntegration_TwoActorConflict(t *testing.T) {
	// GIVEN two actors with wildcard review access
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Entitlements: map[string]authz.Entitlement{"review:*": {CanView: true, CanEdit: true}}},
		{ID: "actor_bob", Entitlements: map[string]authz.Entitlement{"review:*": {CanView: true, CanEdit: true}}},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	push := func(actorID string, events []map[string]any) *httptest.ResponseRecorder {
		body := map[string]any{"clientCursor": nil, "events": events}
		b, _ := json.Marshal(body)
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sync/push", bytes.NewBuffer(b))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-actor-id", actorID)
		rec := httptest.NewRecorder()
		s.Mux.ServeHTTP(rec, req)
		return rec
	}

	// WHEN alice pushes a newer answer
	aliceRec := push("actor_alice", []map[string]any{
		{
			"id": "alice-001", "entityType": "review_answer", "entityId": "r1:q1",
			"operation": "upsert", "actorId": "actor_alice", "pushedAt": "2026-01-01T12:00:00Z",
			"fields": []map[string]any{
				{"name": "answer", "value": "yes", "hlc": "1748779200000:0001:actor_alice"},
				{"name": "naReason", "value": nil, "hlc": "1748779200000:0002:actor_alice"},
			},
		},
	})
	if aliceRec.Code != http.StatusOK {
		t.Fatalf("alice push failed: %s", aliceRec.Body.String())
	}

	// WHEN bob pushes older answer (loses) + newer naReason (wins)
	bobRec := push("actor_bob", []map[string]any{
		{
			"id": "bob-001", "entityType": "review_answer", "entityId": "r1:q1",
			"operation": "upsert", "actorId": "actor_bob", "pushedAt": "2026-01-01T12:01:00Z",
			"fields": []map[string]any{
				{"name": "answer", "value": "no", "hlc": "1748779100000:0001:actor_bob"},    // older
				{"name": "naReason", "value": "n/a", "hlc": "1748779300000:0001:actor_bob"}, // newer
			},
		},
	})
	if bobRec.Code != http.StatusOK {
		t.Fatalf("bob push failed: %s", bobRec.Body.String())
	}

	// THEN only 2 field versions remain — alice's answer + bob's naReason
	if r.FieldVersionCount() != 2 {
		t.Errorf("expected 2 field versions (alice.answer + bob.naReason), got %d", r.FieldVersionCount())
	}
}

// TestIntegration_CursorAdvancement verifies the cursor advances after push.
func TestIntegration_CursorAdvancement(t *testing.T) {
	// GIVEN an actor with wildcard review access
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{"review:*": {CanView: true, CanEdit: true}}},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN two events are pushed with sequential timestamps
	for i, cursor := range []string{"2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"} {
		body := map[string]any{
			"clientCursor": nil,
			"events": []map[string]any{
				{
					"id": "evt-" + string(rune('0'+i)), "entityType": "review", "entityId": "review-001",
					"operation": "upsert", "actorId": "actor_dev", "pushedAt": cursor,
					"fields": []map[string]any{},
				},
			},
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sync/push", bytes.NewBuffer(b))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-actor-id", "actor_dev")
		rec := httptest.NewRecorder()
		s.Mux.ServeHTTP(rec, req)

		// THEN the cursor advances to match the pushed timestamp
		var resp map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &resp)
		if resp["newClientCursor"] != cursor {
			t.Errorf("iter %d: expected cursor %q, got %v", i, cursor, resp["newClientCursor"])
		}
	}
}

// ── Root stamping tests ──────────────────────────────────────────────────────

func TestPush_StampRootOnAcceptedEvent(t *testing.T) {
	// GIVEN an actor with review, product, and template edit access
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*":   {CanView: true, CanEdit: true},
			"product:*":  {CanView: true, CanEdit: true},
			"template:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	push := func(id, entityType, entityID string) *httptest.ResponseRecorder {
		body := map[string]any{
			"clientCursor": nil,
			"events": []map[string]any{
				{"id": id, "entityType": entityType, "entityId": entityID,
					"operation": "upsert", "actorId": "actor_dev", "pushedAt": "2026-01-01T12:00:00Z",
					"fields": []map[string]any{}},
			},
		}
		b, _ := json.Marshal(body)
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sync/push", bytes.NewBuffer(b))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-actor-id", "actor_dev")
		rec := httptest.NewRecorder()
		s.Mux.ServeHTTP(rec, req)
		return rec
	}

	// WHEN a root event and a child event are pushed
	rec := push("evt-root", "review", "review-001")
	if rec.Code != http.StatusOK {
		t.Fatalf("root push failed: %s", rec.Body.String())
	}
	rec = push("evt-child", "review_answer", "review-001:q1")
	if rec.Code != http.StatusOK {
		t.Fatalf("child push failed: %s", rec.Body.String())
	}

	// THEN the stored events have root_type/root_id stamped by the push handler
	root := r.StoredEventByID("evt-root")
	if root == nil {
		t.Fatal("evt-root not found in stored events")
	}
	if root.RootType != "review" || root.RootID != "review-001" {
		t.Errorf("root event: got root=(%s, %s), want (review, review-001)", root.RootType, root.RootID)
	}

	child := r.StoredEventByID("evt-child")
	if child == nil {
		t.Fatal("evt-child not found in stored events")
	}
	if child.RootType != "review" || child.RootID != "review-001" {
		t.Errorf("child event: got root=(%s, %s), want (review, review-001)", child.RootType, child.RootID)
	}

	// WHEN a product event is pushed (product is a pull root too)
	rec = push("evt-product", "product", "prod-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("product push failed: %s", rec.Body.String())
	}

	// THEN it is self-rooted under root_type=product
	product := r.StoredEventByID("evt-product")
	if product == nil {
		t.Fatal("evt-product not found in stored events")
	}
	if product.RootType != "product" || product.RootID != "prod-1" {
		t.Errorf("product event: got root=(%s, %s), want (product, prod-1)", product.RootType, product.RootID)
	}

	// WHEN a checkpoint event is pushed (childSharesRootID — no composite prefix)
	rec = push("evt-checkpoint", "review_checkpoint", "review-001")
	if rec.Code != http.StatusOK {
		t.Fatalf("checkpoint push failed: %s", rec.Body.String())
	}

	// THEN it resolves to root (review, review-001) via the shared-root-id path
	checkpoint := r.StoredEventByID("evt-checkpoint")
	if checkpoint == nil {
		t.Fatal("evt-checkpoint not found in stored events")
	}
	if checkpoint.RootType != "review" || checkpoint.RootID != "review-001" {
		t.Errorf("checkpoint event: got root=(%s, %s), want (review, review-001)", checkpoint.RootType, checkpoint.RootID)
	}

	// WHEN a template_draft pillar is pushed (stamped now, not yet a pull root)
	rec = push("evt-pillar", "template_draft_pillar", "draft-7:pillar-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("pillar push failed: %s", rec.Body.String())
	}

	// THEN it resolves to root (template_draft, draft-7)
	pillar := r.StoredEventByID("evt-pillar")
	if pillar == nil {
		t.Fatal("evt-pillar not found in stored events")
	}
	if pillar.RootType != "template_draft" || pillar.RootID != "draft-7" {
		t.Errorf("pillar event: got root=(%s, %s), want (template_draft, draft-7)", pillar.RootType, pillar.RootID)
	}
}

// ── New push validation tests ────────────────────────────────────────────────

func TestPush_RejectsMissingPushedAt(t *testing.T) {
	// GIVEN an event with an empty pushedAt field
	s, _, _, _ := setup(t)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-no-pushed-at",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with missing_pushed_at
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "missing_pushed_at" {
		t.Errorf("expected reason missing_pushed_at, got %v", first["reason"])
	}
}

func TestPush_RejectsTooManyEvents(t *testing.T) {
	// GIVEN a batch of 501 events (exceeds maxPushEvents)
	s, _, _, _ := setup(t)
	events := make([]map[string]any, 501)
	for i := range events {
		events[i] = map[string]any{
			"id":         fmt.Sprintf("evt-%04d", i),
			"entityType": "review",
			"entityId":   "review-001",
			"operation":  "upsert",
			"actorId":    "actor_dev",
			"pushedAt":   "2026-01-01T00:00:00Z",
			"fields":     []map[string]any{},
		}
	}

	body := map[string]any{
		"clientCursor": nil,
		"events":       events,
	}

	// WHEN the actor pushes the oversized batch
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the handler returns a 400 Bad Request error
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestPush_RejectsMissingRequiredFields(t *testing.T) {
	// GIVEN an event with an empty id
	s, _, _, _ := setup(t)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with missing_required_fields
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "missing_required_fields" {
		t.Errorf("expected reason missing_required_fields, got %v", first["reason"])
	}
}

func TestPush_RejectsInvalidEntityType(t *testing.T) {
	// GIVEN an event with an unrecognized entity type
	s, _, _, _ := setup(t)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-bad-type",
				"entityType": "unknown_type",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with invalid_entity_type
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "invalid_entity_type" {
		t.Errorf("expected reason invalid_entity_type, got %v", first["reason"])
	}
}

func TestPush_RejectsChildWithMalformedEntityID(t *testing.T) {
	// GIVEN a known child type (review_answer) with an entityId that lacks
	// the required {rootId}: prefix — RootFor cannot resolve a root for it.
	s, _, _, _ := setup(t)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-malformed-child",
				"entityType": "review_answer",
				"entityId":   "q1", // missing "review-001:" prefix
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with invalid_entity_id (RootFor could not
	// resolve the root — the entity_id lacks the required "reviewId:" prefix).
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "invalid_entity_id" {
		t.Errorf("expected reason invalid_entity_id, got %v", first["reason"])
	}
}

func TestPush_RejectsInvalidOperation(t *testing.T) {
	// GIVEN an event with an invalid operation "patch"
	s, _, _, _ := setup(t)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-bad-op",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "patch",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with invalid_operation
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "invalid_operation" {
		t.Errorf("expected reason invalid_operation, got %v", first["reason"])
	}
}

func TestPush_RejectsLegacyFieldsFormat(t *testing.T) {
	// GIVEN an event with fields as a JSON object instead of an array
	s, _, _, _ := setup(t)

	rawBody := `{
		"clientCursor": null,
		"events": [{
			"id":         "evt-legacy",
			"entityType": "review",
			"entityId":   "review-001",
			"operation":  "upsert",
			"actorId":    "actor_dev",
			"pushedAt":   "2026-01-01T00:00:00Z",
			"fields":     {"status": "done"}
		}]
	}`

	// WHEN the actor pushes the legacy-format event
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/sync/push",
		bytes.NewBufferString(rawBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-actor-id", "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with legacy_fields_format
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "legacy_fields_format" {
		t.Errorf("expected reason legacy_fields_format, got %v", first["reason"])
	}
}

func TestPush_RejectsFuturePushedAt(t *testing.T) {
	// GIVEN an event with a pushedAt timestamp 1 hour in the future
	s, _, _, _ := setup(t)

	futureTime := time.Now().Add(1 * time.Hour).Format(time.RFC3339)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-future",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   futureTime,
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with invalid_pushed_at
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "invalid_pushed_at" {
		t.Errorf("expected reason invalid_pushed_at, got %v", first["reason"])
	}
}

func TestPush_RejectsViewOnlyActor(t *testing.T) {
	// GIVEN an actor with view-only access (CanEdit=false)
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_viewer",
			Email: "viewer@peaky.local",
			Name:  "Viewer",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: false},
			},
		},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN the viewer pushes an upsert event
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-view-only",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_viewer",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_viewer")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the event is rejected with access_revoked
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected event, got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "access_revoked" {
		t.Errorf("expected reason access_revoked, got %v", first["reason"])
	}
}

func TestPush_ReviewScopedAuthResolution(t *testing.T) {
	// GIVEN alice with entitlement for review:review-001
	s, _, _, _ := setup(t)

	// WHEN pushing a review_answer scoped to review-001:q1
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-review-scoped",
				"entityType": "review_answer",
				"entityId":   "review-001:q1",
				"operation":  "upsert",
				"actorId":    "actor_alice",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_alice")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN auth resolves to parent review and the event is accepted
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	accepted := resp["accepted"].([]any)
	if len(accepted) != 1 || accepted[0] != "evt-review-scoped" {
		t.Errorf("expected evt-review-scoped in accepted, got %v", accepted)
	}
}

func TestPush_TemplateScopedAuthResolution(t *testing.T) {
	// GIVEN an actor with wildcard template entitlements
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_tmpl",
			Email: "tmpl@peaky.local",
			Name:  "Template Author",
			Entitlements: map[string]authz.Entitlement{
				"template:*": {CanView: true, CanEdit: true},
			},
		},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)

	// WHEN pushing a template_draft event
	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-tmpl-scoped",
				"entityType": "template_draft",
				"entityId":   "tmpl-001",
				"operation":  "upsert",
				"actorId":    "actor_tmpl",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_tmpl")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN auth resolves via template scope and the event is accepted
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	accepted := resp["accepted"].([]any)
	if len(accepted) != 1 || accepted[0] != "evt-tmpl-scoped" {
		t.Errorf("expected evt-tmpl-scoped in accepted, got %v", accepted)
	}
}

func TestPush_PartialHLCConflict(t *testing.T) {
	// GIVEN existing field versions for status and title
	s, _, _, _ := setup(t)
	body1 := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-base",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "draft", "hlc": "1748779200000:0001:actor_dev"},
					{"name": "title", "value": "Original", "hlc": "1748779200000:0001:actor_dev"},
				},
			},
		},
	}
	req1 := actorRequest(t, http.MethodPost, "/api/sync/push", body1, "actor_dev")
	rec1 := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("base push failed: %d %s", rec1.Code, rec1.Body.String())
	}

	// WHEN pushing one newer field (status) and one older field (title)
	body2 := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-partial",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:01:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "in-progress", "hlc": "1748779300000:0001:actor_dev"}, // newer — wins
					{"name": "title", "value": "Stale", "hlc": "1748779100000:0001:actor_dev"},        // older — loses
				},
			},
		},
	}
	req2 := actorRequest(t, http.MethodPost, "/api/sync/push", body2, "actor_dev")
	rec2 := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("partial push failed: %d %s", rec2.Code, rec2.Body.String())
	}

	// THEN partial_hlc_conflict is reported with 1 field conflict (title)
	var resp map[string]any
	_ = json.Unmarshal(rec2.Body.Bytes(), &resp)

	// The event is NOT accepted — client marks outbox as failed, which
	// drives isConflict=true on the Recent Changes side.
	accepted := resp["accepted"].([]any)
	if len(accepted) != 0 {
		t.Errorf("expected 0 accepted events for partial conflict, got %d", len(accepted))
	}

	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected entry (partial_hlc_conflict), got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "partial_hlc_conflict" {
		t.Errorf("expected reason partial_hlc_conflict, got %v", first["reason"])
	}
	conflicts := first["fieldConflicts"].([]any)
	if len(conflicts) != 1 {
		t.Errorf("expected 1 field conflict (title), got %d", len(conflicts))
	}

	// AND the cursor advances to the partial event's pushedAt: a partial accept
	// persists a pullable change, so it moves the high-water mark like a full
	// accept (decision 1.7, option b).
	if got := resp["newClientCursor"]; got != "2026-01-01T00:01:00Z" {
		t.Errorf("expected newClientCursor to advance to partial event pushedAt, got %v", got)
	}
}

func TestPush_FullHLCConflict(t *testing.T) {
	// GIVEN an existing field version with a high HLC
	s, _, _, _ := setup(t)
	body1 := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-base",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_alice",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "draft", "hlc": "1748779200000:0001:actor_alice"},
				},
			},
		},
	}
	req1 := actorRequest(t, http.MethodPost, "/api/sync/push", body1, "actor_alice")
	rec1 := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("base push failed: %d %s", rec1.Code, rec1.Body.String())
	}

	// WHEN bob pushes the same field with a strictly older HLC
	body2 := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-stale",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "upsert",
				"actorId":    "actor_bob",
				"pushedAt":   "2026-01-01T00:01:00Z",
				"fields": []map[string]any{
					{"name": "status", "value": "in-progress", "hlc": "1748779100000:0001:actor_bob"}, // older — loses
				},
			},
		},
	}
	req2 := actorRequest(t, http.MethodPost, "/api/sync/push", body2, "actor_bob")
	rec2 := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("stale push failed: %d %s", rec2.Code, rec2.Body.String())
	}

	// THEN the event is rejected with hlc_conflict (all fields lost)
	var resp map[string]any
	_ = json.Unmarshal(rec2.Body.Bytes(), &resp)
	rejected := resp["rejected"].([]any)
	if len(rejected) != 1 {
		t.Fatalf("expected 1 rejected entry (hlc_conflict), got %d", len(rejected))
	}
	first := rejected[0].(map[string]any)
	if first["reason"] != "hlc_conflict" {
		t.Errorf("expected reason hlc_conflict, got %v", first["reason"])
	}
	// No accepted events when all fields lose
	accepted := resp["accepted"].([]any)
	if len(accepted) != 0 {
		t.Errorf("expected 0 accepted events, got %d", len(accepted))
	}
	// AND the cursor does NOT advance: a wholly rejected event persists nothing,
	// so the high-water mark stays where it was (decision 1.7, option b).
	if got := resp["newClientCursor"]; got != "" {
		t.Errorf("expected newClientCursor to stay empty on full reject, got %v", got)
	}
}

func TestPush_StoredOperationInEvent(t *testing.T) {
	// GIVEN a delete event for a review
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_dev", Entitlements: map[string]authz.Entitlement{
			"review:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	h := syncengine.New(r, reg)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)
	fuego.Get(s, "/api/sync/pull", h.Pull)

	body := map[string]any{
		"clientCursor": nil,
		"events": []map[string]any{
			{
				"id":         "evt-delete-op",
				"entityType": "review",
				"entityId":   "review-001",
				"operation":  "delete",
				"actorId":    "actor_dev",
				"pushedAt":   "2026-01-01T00:00:00Z",
				"fields":     []map[string]any{},
			},
		},
	}

	// WHEN the actor pushes the delete event
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("push failed: %d %s", rec.Code, rec.Body.String())
	}

	// THEN pulling returns the event with operation "delete"
	pullReq := actorRequest(t, http.MethodGet, "/api/sync/pull?after=", nil, "actor_dev")
	pullRec := httptest.NewRecorder()
	s.Mux.ServeHTTP(pullRec, pullReq)

	var pullResp map[string]any
	_ = json.Unmarshal(pullRec.Body.Bytes(), &pullResp)
	events := pullResp["events"].([]any)
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	ev := events[0].(map[string]any)
	if ev["operation"] != "delete" {
		t.Errorf("expected operation 'delete', got %v", ev["operation"])
	}
}

// ── New pull tests ───────────────────────────────────────────────────────────

func TestPull_InvalidAfterCursor(t *testing.T) {
	// GIVEN a pull request with a non-date cursor value
	s, _, _, _ := setup(t)

	// WHEN the actor pulls with an invalid after cursor
	req := actorRequest(t, http.MethodGet, "/api/sync/pull?after=not-a-date", nil, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the handler returns a 400 Bad Request error
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestPull_AcceptsCompositeCursor(t *testing.T) {
	// GIVEN a pull request with a composite cursor (time:id)
	s, _, _, r := setup(t)

	r.SeedEvent(repo.SyncEvent{
		ID:         "evt-seed-001",
		EntityType: "review",
		EntityID:   "review-001",
		RootType:   "review",
		RootID:     "review-001",
		Operation:  "upsert",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:01:00Z",
	})

	// WHEN the actor pulls with a composite cursor
	compositeCursor := "2026-01-01T00:00:00Z:some-uuid"
	req := actorRequest(t, http.MethodGet, fmt.Sprintf("/api/sync/pull?after=%s", compositeCursor), nil, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the handler returns 200 (cursor is valid)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 1 {
		t.Errorf("expected 1 event after composite cursor, got %d", len(events))
	}

	// The response cursor must also be composite
	cursor := resp["cursor"].(string)
	if !strings.Contains(cursor, ":") {
		t.Errorf("expected composite cursor, got %q", cursor)
	}
}

func TestPull_AcceptsLegacyTimestampCursor(t *testing.T) {
	// GIVEN a pull request with a legacy timestamp-only cursor (no :id suffix)
	s, _, _, r := setup(t)

	r.SeedEvent(repo.SyncEvent{
		ID:         "evt-seed-001",
		EntityType: "review",
		EntityID:   "review-001",
		RootType:   "review",
		RootID:     "review-001",
		Operation:  "upsert",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:01:00Z",
	})

	// WHEN the actor pulls with a legacy RFC3339 cursor (no :id)
	legacyCursor := "2026-01-01T00:00:00Z"
	req := actorRequest(t, http.MethodGet, fmt.Sprintf("/api/sync/pull?after=%s", legacyCursor), nil, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the handler returns 200 (legacy cursor is valid)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 1 {
		t.Errorf("expected 1 event after legacy cursor, got %d", len(events))
	}
}

func TestPull_AcceptsNanoTimestampCursor(t *testing.T) {
	// GIVEN a pull request with an RFC3339Nano cursor (fractional seconds)
	s, _, _, r := setup(t)

	r.SeedEvent(repo.SyncEvent{
		ID:         "evt-seed-002",
		EntityType: "review",
		EntityID:   "review-001",
		RootType:   "review",
		RootID:     "review-001",
		Operation:  "upsert",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:01:00.123456789Z",
	})

	// WHEN the actor pulls with an RFC3339Nano composite cursor
	compositeNanoCursor := "2026-01-01T00:00:00.123456789Z:evt-seed-002"
	req := actorRequest(t, http.MethodGet, fmt.Sprintf("/api/sync/pull?after=%s", compositeNanoCursor), nil, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the handler returns 200 and respects the nano precision
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 1 {
		t.Errorf("expected 1 event after nano cursor, got %d", len(events))
	}
}

func TestPull_ReturnsOperationFromEvent(t *testing.T) {
	// GIVEN a seeded delete event in the repo
	s, _, _, r := setup(t)

	r.SeedEvent(repo.SyncEvent{
		ID:         "evt-delete-seed",
		EntityType: "review",
		EntityID:   "review-001",
		RootType:   "review",
		RootID:     "review-001",
		Operation:  "delete",
		ActorID:    "actor_dev",
		PushedAt:   "2026-01-01T00:01:00Z",
	})

	// WHEN the actor pulls all events
	req := actorRequest(t, http.MethodGet, "/api/sync/pull?after=", nil, "actor_dev")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN the returned event has operation "delete"
	var resp map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	events := resp["events"].([]any)
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	ev := events[0].(map[string]any)
	if ev["operation"] != "delete" {
		t.Errorf("expected operation 'delete', got %v", ev["operation"])
	}
}
