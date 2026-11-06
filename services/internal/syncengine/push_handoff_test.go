package syncengine_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
	"github.com/peaky-team/peaky/services/internal/syncengine"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// Push-boundary tests for the three review-child entity types registered in
// group 6 (local-first/REQ-011, REQ-013; authorization/REQ-007, REQ-008;
// AC-018, AC-021 through AC-024).
//
// Override mutations route through the action-specific MaturityOverridePolicy
// (participant lookup + Review edit access); handoff practice and association
// mutations require Review edit access via the owning Review. The policy is
// wired with WithOverridePolicy, mirroring cmd/peaky-api/main.go.

// setupHandoff builds a push/pull server whose registry grants actor_advisor
// edit access to review-001 (plus a persisted reviewer assignment) and
// actor_editor edit access without any participant assignment.
func setupHandoff(t *testing.T) (*fuego.Server, *repo.FakeSyncRepo, *repo.FakeNotifier) {
	t.Helper()
	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_advisor", Entitlements: map[string]authz.Entitlement{
			"review:review-001": {CanView: true, CanEdit: true},
		}},
		{ID: "actor_editor", Entitlements: map[string]authz.Entitlement{
			"review:review-001": {CanView: true, CanEdit: true},
		}},
		{ID: "actor_outside", Entitlements: map[string]authz.Entitlement{
			"product:*": {CanView: true, CanEdit: true},
		}},
	})
	r := repo.NewFakeSyncRepo()
	// actor_advisor is a current persisted reviewer (product: Advisor) on
	// review-001; actor_editor holds edit access without the assignment.
	r.AddParticipant("review-001", "actor_advisor", "reviewer")
	notifier := &repo.FakeNotifier{}
	h := syncengine.New(r, reg).
		WithOverridePolicy(authz.NewMaturityOverridePolicy(reg, r)).
		WithNotifier(notifier)
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Post(s, "/api/sync/push", h.Push)
	fuego.Get(s, "/api/sync/pull", h.Pull)
	return s, r, notifier
}

const pushedAt = "2026-01-01T00:00:00Z"
const hlcStamp = "1000000000000:0001:actor"

func practiceEvent(id, rationale string) map[string]any {
	return practiceEventFor(id, "review_handoff_practice:review-001/rev-a/q-1/cl-1", rationale)
}

func practiceEventFor(id, entityID, rationale string) map[string]any {
	return map[string]any{
		"id":         id,
		"entityType": "review_handoff_practice",
		"entityId":   entityID,
		"operation":  "upsert",
		"pushedAt":   pushedAt,
		"fields": []map[string]any{
			{"name": "orderKey", "value": "a", "hlc": hlcStamp},
			{"name": "snapshot", "value": map[string]any{
				"title":               "Practice",
				"helpfulLinks":        []any{},
				"evidenceIdentifiers": []any{},
			}, "hlc": hlcStamp},
			{"name": "rationale", "value": rationale, "hlc": hlcStamp},
			{"name": "selectionState", "value": "selected", "hlc": hlcStamp},
		},
	}
}

func associationEvent(id, action string, reference map[string]any) map[string]any {
	fields := make([]map[string]any, 0, 6)
	fields = append(fields,
		map[string]any{"name": "practiceEntityId", "value": "review_handoff_practice:review-001/rev-a/q-1/cl-1", "hlc": hlcStamp},
		map[string]any{"name": "action", "value": action, "hlc": hlcStamp},
		map[string]any{"name": "priorTransitionId", "value": nil, "hlc": hlcStamp},
	)
	for _, name := range []string{"provider", "externalId", "url"} {
		var value any
		if reference != nil {
			value = reference[name]
		}
		fields = append(fields, map[string]any{"name": name, "value": value, "hlc": hlcStamp})
	}
	return map[string]any{
		"id":         id,
		"entityType": "review_handoff_association",
		"entityId":   "review_handoff_association:review-001/" + id,
		"operation":  "upsert",
		"pushedAt":   pushedAt,
		"fields":     fields,
	}
}

func overrideEvent(id, action string) map[string]any {
	return map[string]any{
		"id":         id,
		"entityType": "review_maturity_override",
		"entityId":   "review_maturity_override:review-001/" + id,
		"operation":  "upsert",
		"pushedAt":   pushedAt,
		"fields": []map[string]any{
			{"name": "action", "value": action, "hlc": hlcStamp},
			{"name": "templateRevisionId", "value": "rev-a", "hlc": hlcStamp},
			{"name": "reviewedPercent", "value": 55, "hlc": hlcStamp},
			{"name": "reviewedStage", "value": 3, "hlc": hlcStamp},
			{"name": "explanation", "value": "Evidence reviewed on site", "hlc": hlcStamp},
			{"name": "evidence", "value": []any{"ev-1"}, "hlc": hlcStamp},
			{"name": "priorTransitionId", "value": nil, "hlc": hlcStamp},
		},
	}
}

func push(t *testing.T, s *fuego.Server, actorID string, events ...map[string]any) map[string]any {
	t.Helper()
	body := map[string]any{"events": events}
	req := actorRequest(t, http.MethodPost, "/api/sync/push", body, actorID)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	return resp
}

func acceptedIDs(resp map[string]any) []any {
	accepted, _ := resp["accepted"].([]any)
	return accepted
}

func rejectionReason(resp map[string]any, eventID string) string {
	rejected, _ := resp["rejected"].([]any)
	for _, entry := range rejected {
		e, _ := entry.(map[string]any)
		if e["id"] == eventID {
			reason, _ := e["reason"].(string)
			return reason
		}
	}
	return ""
}

// local-first/REQ-011: a handoff practice upsert from an actor with Review
// edit access is accepted and stamped with the owning review root, so pull
// scoping and SSE routing follow the review.
func TestPush_HandoffPracticeAcceptedWithReviewEditAccess(t *testing.T) {
	s, r, notifier := setupHandoff(t)
	resp := push(t, s, "actor_editor", practiceEvent("evt-hp-1", "why"))

	if got := rejectionReason(resp, "evt-hp-1"); got != "" {
		t.Fatalf("practice upsert must be accepted, rejected with %s", got)
	}
	if len(acceptedIDs(resp)) != 1 {
		t.Fatalf("expected 1 accepted event, got %v", resp["accepted"])
	}
	stored := r.StoredEventByID("evt-hp-1")
	if stored == nil {
		t.Fatal("accepted event must be persisted")
	}
	if stored.RootType != "review" || stored.RootID != "review-001" {
		t.Fatalf("root must resolve to the owning review, got %s/%s", stored.RootType, stored.RootID)
	}
	if r.FieldVersionCount() != 4 {
		t.Fatalf("expected 4 field versions stored, got %d", r.FieldVersionCount())
	}
	// SSE family routing: the review family doorbell rings once for the batch.
	calls := notifier.Calls()
	if len(calls) != 1 || calls[0].Channel != "sync:review:catalog" {
		t.Fatalf("expected one review-family notification, got %v", calls)
	}
}

func TestPush_HandoffAssociationAcceptedWithReviewEditAccess(t *testing.T) {
	s, r, _ := setupHandoff(t)
	resp := push(t, s, "actor_editor", associationEvent("trn-1", "associate", map[string]any{
		"provider":   "gitlab",
		"externalId": "TEAM-1",
		"url":        "https://example.com/t/1",
	}))
	if got := rejectionReason(resp, "trn-1"); got != "" {
		t.Fatalf("association transition must be accepted, rejected with %s", got)
	}
	stored := r.StoredEventByID("trn-1")
	if stored == nil || stored.RootType != "review" || stored.RootID != "review-001" {
		t.Fatalf("association must persist under the owning review, got %+v", stored)
	}
}

// authorization/REQ-007; AC-021: an actor without Review edit access cannot
// write handoff children — the owning review's entitlement gates the mutation.
func TestPush_HandoffRejectedWithoutReviewEditAccess(t *testing.T) {
	s, r, _ := setupHandoff(t)
	resp := push(t, s, "actor_outside",
		practiceEvent("evt-hp-denied", "why"),
		associationEvent("trn-denied", "associate", map[string]any{
			"provider": "gitlab", "externalId": "TEAM-1", "url": "https://example.com/t/1",
		}),
	)
	if got := rejectionReason(resp, "evt-hp-denied"); got != "access_revoked" {
		t.Fatalf("practice push without review access must be access_revoked, got %q", got)
	}
	if got := rejectionReason(resp, "trn-denied"); got != "access_revoked" {
		t.Fatalf("association push without review access must be access_revoked, got %q", got)
	}
	if r.EventCount() != 0 || r.FieldVersionCount() != 0 {
		t.Fatal("nothing may persist for a denied mutation")
	}
}

// Malformed identity fields are rejected before authorization or storage.
func TestPush_TypedReviewChildrenRejectMalformedIdentity(t *testing.T) {
	s, r, _ := setupHandoff(t)
	bad := practiceEvent("evt-bad-id", "why")
	bad["entityId"] = "review_handoff_practice:review-001/rev-a/q-1" // segment short
	resp := push(t, s, "actor_editor", bad)
	if got := rejectionReason(resp, "evt-bad-id"); got != "invalid_entity_id" {
		t.Fatalf("malformed practice id must be invalid_entity_id, got %q", got)
	}
	if r.EventCount() != 0 {
		t.Fatal("a malformed identity must never persist")
	}
}

// authorization/REQ-007, REQ-008; AC-021 through AC-024: the Review embedded
// in the entity ID is the authorization root. An actor entitled on one
// Review cannot write handoff practices, association transitions, or
// override transitions under another Review by naming it in the entity ID.
func TestPush_ReviewChildrenRejectCrossReviewOwnership(t *testing.T) {
	s, r, _ := setupHandoff(t)

	practice := practiceEvent("evt-x-review-p", "why")
	practice["entityId"] = "review_handoff_practice:review-002/rev-a/q-1/cl-1"

	association := associationEvent("trn-x-review", "associate", map[string]any{
		"provider": "gitlab", "externalId": "TEAM-1", "url": "https://example.com/t/1",
	})
	association["entityId"] = "review_handoff_association:review-002/trn-x-review"

	override := overrideEvent("ov-x-review", "create")
	override["entityId"] = "review_maturity_override:review-002/ov-x-review"

	// actor_editor and actor_advisor are both entitled on review-001 only.
	resp := push(t, s, "actor_editor", practice, association)
	if got := rejectionReason(resp, "evt-x-review-p"); got != "access_revoked" {
		t.Fatalf("cross-review practice write must be access_revoked, got %q", got)
	}
	if got := rejectionReason(resp, "trn-x-review"); got != "access_revoked" {
		t.Fatalf("cross-review association write must be access_revoked, got %q", got)
	}
	resp = push(t, s, "actor_advisor", override)
	if got := rejectionReason(resp, "ov-x-review"); got != "access_revoked" {
		t.Fatalf("cross-review override write must be access_revoked, got %q", got)
	}
	if r.EventCount() != 0 || r.FieldVersionCount() != 0 {
		t.Fatal("nothing may persist under a Review the actor is not entitled to")
	}
}

// authorization/REQ-008; AC-022: a current persisted reviewer with Review edit
// access creates, supersedes, and revokes overrides through the
// action-specific policy.
func TestPush_OverrideAuthorizedViaAdvisorPolicy(t *testing.T) {
	s, r, _ := setupHandoff(t)
	resp := push(t, s, "actor_advisor", overrideEvent("ov-1", "create"))
	if got := rejectionReason(resp, "ov-1"); got != "" {
		t.Fatalf("Advisor override must be accepted, rejected with %s", got)
	}
	stored := r.StoredEventByID("ov-1")
	if stored == nil || stored.RootType != "review" || stored.RootID != "review-001" {
		t.Fatalf("override must persist under the owning review, got %+v", stored)
	}
}

// AC-023: Review edit access alone is insufficient — an actor with edit
// access but no persisted reviewer assignment is rejected and no transition
// field is written. A bare CanEdit would have said yes (AC-024).
func TestPush_OverrideEditAccessAloneIsInsufficient(t *testing.T) {
	s, r, _ := setupHandoff(t)
	resp := push(t, s, "actor_editor", overrideEvent("ov-denied", "create"))
	if got := rejectionReason(resp, "ov-denied"); got != "access_revoked" {
		t.Fatalf("edit-access-only override must be access_revoked, got %q", got)
	}
	if r.EventCount() != 0 || r.FieldVersionCount() != 0 {
		t.Fatal("no override transition field may be written for a denied actor")
	}
}

// The policy denies unknown and missing actions even for a current Advisor.
func TestPush_OverrideRejectsUnknownOrMissingAction(t *testing.T) {
	s, r, _ := setupHandoff(t)

	unknown := overrideEvent("ov-unknown", "delete")
	missing := overrideEvent("ov-missing", "create")
	missing["fields"] = missing["fields"].([]map[string]any)[1:] // drop action

	resp := push(t, s, "actor_advisor", unknown, missing)
	if got := rejectionReason(resp, "ov-unknown"); got != "access_revoked" {
		t.Fatalf("unknown override action must be denied, got %q", got)
	}
	if got := rejectionReason(resp, "ov-missing"); got != "access_revoked" {
		t.Fatalf("missing override action must be denied, got %q", got)
	}
	if r.EventCount() != 0 {
		t.Fatal("no transition may persist without a valid action")
	}
}

// local-first/REQ-013; AC-021: an over-limit handoff mutation is rejected
// atomically — every field of the event is refused and nothing persists.
func TestPush_OverLimitHandoffMutationRejectedAtomically(t *testing.T) {
	s, r, _ := setupHandoff(t)
	overLimit := practiceEvent("evt-over", strings.Repeat("a", 2001))
	resp := push(t, s, "actor_editor", overLimit)
	if got := rejectionReason(resp, "evt-over"); got != "handoff_limit_exceeded" {
		t.Fatalf("over-limit rationale must be handoff_limit_exceeded, got %q", got)
	}
	if r.EventCount() != 0 || r.FieldVersionCount() != 0 {
		t.Fatal("an over-limit mutation must persist no truncated or partial state")
	}

	badURL := associationEvent("trn-http", "associate", map[string]any{
		"provider": "gitlab", "externalId": "TEAM-1", "url": "http://example.com/t/1",
	})
	resp = push(t, s, "actor_editor", badURL)
	if got := rejectionReason(resp, "trn-http"); got != "handoff_limit_exceeded" {
		t.Fatalf("non-https association URL must be handoff_limit_exceeded, got %q", got)
	}
	if r.EventCount() != 0 {
		t.Fatal("an invalid reference must persist nothing")
	}
}

// AC-022: a boundary-sized mutation — multi-byte rationale at exactly the
// character limit — flows through normal authorization and HLC resolution.
func TestPush_ExactBoundaryHandoffMutationAccepted(t *testing.T) {
	s, r, _ := setupHandoff(t)
	atLimit := practiceEvent("evt-boundary", strings.Repeat("🚀", 2000))
	resp := push(t, s, "actor_editor", atLimit)
	if got := rejectionReason(resp, "evt-boundary"); got != "" {
		t.Fatalf("exact-boundary mutation must be accepted, rejected with %s", got)
	}
	if r.FieldVersionCount() != 4 {
		t.Fatalf("expected 4 field versions stored, got %d", r.FieldVersionCount())
	}
}

// local-first/AC-023; improvement-plans/AC-043: a limit-maximal draft — 50
// practice upserts plus 50 association transitions — is one 100-event push
// under the 500-event cap and is not rejected for exceeding either cap.
func TestPush_LimitMaximalDraftFitsPushContract(t *testing.T) {
	s, _, _ := setupHandoff(t)
	reference := map[string]any{
		"provider":   "p",
		"externalId": strings.Repeat("x", 128),
		"url":        "https://example.com/" + strings.Repeat("u", 2048-len("https://example.com/")),
	}
	events := make([]map[string]any, 0, 100)
	for i := 0; i < 50; i++ {
		id := string(rune('a'+i/26)) + string(rune('a'+i%26))
		// Distinct practices carry distinct deterministic entity IDs.
		entityID := "review_handoff_practice:review-001/rev-a/q-" + id + "/cl-" + id
		events = append(events, practiceEventFor("evt-max-"+id, entityID, strings.Repeat("r", 2000)))
		events = append(events, associationEvent("trn-max-"+id, "associate", reference))
	}
	resp := push(t, s, "actor_editor", events...)
	if got := len(acceptedIDs(resp)); got != 100 {
		rejected, _ := resp["rejected"].([]any)
		t.Fatalf("limit-maximal draft must be fully accepted: %d/100 accepted, rejected: %v", got, rejected)
	}
}

// local-first/AC-018: re-pushing the same stable transition ID cannot
// duplicate history — the second push persists no second event record.
func TestPush_StableTransitionIDCannotDuplicateHistory(t *testing.T) {
	s, r, _ := setupHandoff(t)
	event := associationEvent("trn-replay", "associate", map[string]any{
		"provider": "gitlab", "externalId": "TEAM-1", "url": "https://example.com/t/1",
	})
	if resp := push(t, s, "actor_editor", event); len(acceptedIDs(resp)) != 1 {
		t.Fatalf("first push must be accepted, got %v", resp["rejected"])
	}
	// Replay: the already-stored fields lose the HLC comparison, so the event
	// is reported as a conflict and SaveEvent never runs again.
	push(t, s, "actor_editor", event)
	if r.EventCount() != 1 {
		t.Fatalf("replayed transition must not duplicate history, got %d events", r.EventCount())
	}
}

// Pulled events for the new types ride along under the owning review's
// entitlement scope — no new pull root.
func TestPull_HandoffChildrenRideTheReviewRoot(t *testing.T) {
	s, _, _ := setupHandoff(t)
	push(t, s, "actor_editor",
		practiceEvent("evt-pull-p", "why"),
		associationEvent("trn-pull", "associate", map[string]any{
			"provider": "gitlab", "externalId": "TEAM-1", "url": "https://example.com/t/1",
		}),
	)
	// Overrides require the Advisor policy — pushed by the reviewer actor.
	push(t, s, "actor_advisor", overrideEvent("ov-pull", "create"))

	// actor_editor can view review-001; the pull must carry all three types.
	req := actorRequest(t, http.MethodGet, "/api/sync/pull", nil, "actor_editor")
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("pull failed: %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Events []struct {
			ID         string `json:"id"`
			EntityType string `json:"entityType"`
		} `json:"events"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid pull response: %v", err)
	}
	seen := map[string]bool{}
	for _, ev := range resp.Events {
		seen[ev.EntityType] = true
	}
	for _, entityType := range []string{"review_handoff_practice", "review_handoff_association", "review_maturity_override"} {
		if !seen[entityType] {
			t.Errorf("pull must carry %s under the review root, got %v", entityType, seen)
		}
	}

	// actor_outside has no review entitlement: the children stay invisible.
	req = actorRequest(t, http.MethodGet, "/api/sync/pull", nil, "actor_outside")
	rec = httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)
	var outside struct {
		Events []any `json:"events"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &outside)
	if len(outside.Events) != 0 {
		t.Fatalf("unentitled actor must not pull review children, got %v", outside.Events)
	}
}
