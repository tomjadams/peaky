package entity

import "testing"

func TestRootFor_RootTypesAreSelfRooted(t *testing.T) {
	cases := []struct {
		entityType Type
		entityID   string
	}{
		{Review, "review-001"},
		{Product, "prod-1"},
		{Template, "tmpl-1"},
		{TemplateDraft, "draft-7"},
	}
	for _, tc := range cases {
		rt, rid, ok := RootFor(string(tc.entityType), tc.entityID)
		if !ok {
			t.Fatalf("RootFor(%s, %s): expected ok=true", tc.entityType, tc.entityID)
		}
		if rt != string(tc.entityType) {
			t.Fatalf("RootFor(%s, %s): root_type=%s, want %s", tc.entityType, tc.entityID, rt, tc.entityType)
		}
		if rid != tc.entityID {
			t.Fatalf("RootFor(%s, %s): root_id=%s, want %s", tc.entityType, tc.entityID, rid, tc.entityID)
		}
	}
}

func TestRootFor_ChildTypesResolveToParentRoot(t *testing.T) {
	cases := []struct {
		entityType   Type
		entityID     string
		wantRootType string
		wantRootID   string
	}{
		{ReviewAnswer, "review-001:q1", "review", "review-001"},
		{ReviewNote, "review-001:q2", "review", "review-001"},
		{ReviewAttachment, "review-001:att-1", "review", "review-001"},
		{ReviewCheckpoint, "review-001:cp-1", "review", "review-001"},
		{TemplateDraftPillar, "draft-7:pillar-1", "template_draft", "draft-7"},
		{TemplateDraftQuestion, "draft-7:q3", "template_draft", "draft-7"},
	}
	for _, tc := range cases {
		rt, rid, ok := RootFor(string(tc.entityType), tc.entityID)
		if !ok {
			t.Fatalf("RootFor(%s, %s): expected ok=true", tc.entityType, tc.entityID)
		}
		if rt != tc.wantRootType {
			t.Fatalf("RootFor(%s, %s): root_type=%s, want %s", tc.entityType, tc.entityID, rt, tc.wantRootType)
		}
		if rid != tc.wantRootID {
			t.Fatalf("RootFor(%s, %s): root_id=%s, want %s", tc.entityType, tc.entityID, rid, tc.wantRootID)
		}
	}
}

func TestRootFor_ChildWithNoPrefixIsRejected(t *testing.T) {
	cases := []struct {
		entityType Type
		entityID   string
	}{
		{ReviewAnswer, "q1"},
		{ReviewNote, "note-1"},
		{TemplateDraftQuestion, "q3"},
	}
	for _, tc := range cases {
		_, _, ok := RootFor(string(tc.entityType), tc.entityID)
		if ok {
			t.Fatalf("RootFor(%s, %q): expected ok=false (no ':' prefix)", tc.entityType, tc.entityID)
		}
	}
}

// local-first/REQ-011; AC-018: the three new review-child types carry typed,
// percent-encoded entity IDs — "<type>:<encodedReviewId>/<...>" — and resolve
// to the owning review for push authorization, pull scoping, and SSE routing.
func TestRootFor_TypedReviewChildrenResolveToOwningReview(t *testing.T) {
	cases := []struct {
		entityType Type
		entityID   string
		wantRootID string
	}{
		{ReviewHandoffPractice, "review_handoff_practice:review-001/rev-a/q-1/cl-1", "review-001"},
		{ReviewHandoffAssociation, "review_handoff_association:review-001/trn-9", "review-001"},
		{ReviewMaturityOverride, "review_maturity_override:review-001/trn-7", "review-001"},
		// Percent-encoded segments decode before stamping the root: a review
		// id containing a space or slash stays one segment on the wire.
		{ReviewHandoffPractice, "review_handoff_practice:review%20001/rev-a/q-1/cl-1", "review 001"},
		{ReviewMaturityOverride, "review_maturity_override:review%2F002/trn-7", "review/002"},
	}
	for _, tc := range cases {
		rt, rid, ok := RootFor(string(tc.entityType), tc.entityID)
		if !ok {
			t.Fatalf("RootFor(%s, %s): expected ok=true", tc.entityType, tc.entityID)
		}
		if rt != "review" {
			t.Fatalf("RootFor(%s, %s): root_type=%s, want review", tc.entityType, tc.entityID, rt)
		}
		if rid != tc.wantRootID {
			t.Fatalf("RootFor(%s, %s): root_id=%s, want %s", tc.entityType, tc.entityID, rid, tc.wantRootID)
		}
	}
}

// Malformed identity fields are rejected (authorization/REQ-007): a typed
// review child whose ID has the wrong prefix, the wrong segment count, an
// empty segment, or a bad escape can never resolve to an entitlement root,
// so push rejects it as invalid_entity_id instead of guessing.
func TestRootFor_TypedReviewChildrenRejectMalformedIDs(t *testing.T) {
	cases := []struct {
		name       string
		entityType Type
		entityID   string
	}{
		{"missing type prefix", ReviewHandoffPractice, "review-001/rev-a/q-1/cl-1"},
		{"wrong type prefix", ReviewHandoffPractice, "review_handoff_association:review-001/rev-a/q-1/cl-1"},
		{"empty review segment", ReviewHandoffPractice, "review_handoff_practice:/rev-a/q-1/cl-1"},
		{"too few segments", ReviewHandoffPractice, "review_handoff_practice:review-001/rev-a/q-1"},
		{"too many segments", ReviewHandoffPractice, "review_handoff_practice:review-001/rev-a/q-1/cl-1/extra"},
		{"empty unit segment", ReviewHandoffPractice, "review_handoff_practice:review-001/rev-a//cl-1"},
		{"bad percent escape", ReviewHandoffPractice, "review_handoff_practice:review%2/rev-a/q-1/cl-1"},
		{"bare transition id", ReviewMaturityOverride, "review_maturity_override:trn-7"},
		{"empty transition id", ReviewHandoffAssociation, "review_handoff_association:review-001/"},
	}
	for _, tc := range cases {
		_, _, ok := RootFor(string(tc.entityType), tc.entityID)
		if ok {
			t.Errorf("%s: RootFor(%s, %q): expected ok=false", tc.name, tc.entityType, tc.entityID)
		}
	}
}

func TestRootFor_UnknownTypeIsRejected(t *testing.T) {
	_, _, ok := RootFor("team", "payments-scalability")
	if ok {
		t.Fatal("RootFor(team, ...): expected ok=false (unknown type)")
	}
}

func TestRootFor_EmptyEntityIDIsRejected(t *testing.T) {
	_, _, ok := RootFor("review", "")
	if ok {
		t.Fatal("RootFor(review, \"\"): expected ok=false (empty entity_id)")
	}
}

func TestRootFor_CheckpointSharesRootID(t *testing.T) {
	// review_checkpoint uses the review id directly (no composite prefix).
	// The client sends entityId = reviewId, so RootFor must resolve it.
	rt, rid, ok := RootFor("review_checkpoint", "review-001")
	if !ok {
		t.Fatal("RootFor(review_checkpoint, review-001): expected ok=true (shares root id)")
	}
	if rt != "review" {
		t.Fatalf("root_type=%s, want review", rt)
	}
	if rid != "review-001" {
		t.Fatalf("root_id=%s, want review-001", rid)
	}
}

func TestRootFor_ChildWithTrailingColonIsRejected(t *testing.T) {
	// A child entity_id like "review-001:" has a valid prefix but an empty
	// suffix — the child unit id is missing, so the root is rejected.
	_, _, ok := RootFor("review_answer", "review-001:")
	if ok {
		t.Fatal("RootFor(review_answer, \"review-001:\"): expected ok=false (trailing colon, empty suffix)")
	}
}

// TestRegistryKnownTypesAllResolveViaRootFor ensures every type in the
// DefaultRegistry's known list has a valid RootFor mapping. A new entity
// type added to the registry without a corresponding entry in rootTypes
// or childToRoot would return ok=false at runtime — this test catches
// that at test time instead.
func TestRegistryKnownTypesAllResolveViaRootFor(t *testing.T) {
	reg := DefaultRegistry()
	// Root types resolve with their own entity_id.
	rootIDs := map[Type]string{
		Review:        "review-001",
		Product:       "prod-1",
		Template:      "tmpl-1",
		TemplateDraft: "draft-7",
	}
	// Child types resolve with a composite "rootId:child" entity_id.
	childIDs := map[Type]string{
		ReviewCheckpoint:         "review-001",
		ReviewAnswer:             "review-001:q1",
		ReviewNote:               "review-001:note-1",
		ReviewAttachment:         "review-001:att-1",
		TemplateDraftPillar:      "draft-7:pillar-1",
		TemplateDraftQuestion:    "draft-7:q3",
		ReviewMaturityOverride:   "review_maturity_override:review-001/trn-1",
		ReviewHandoffPractice:    "review_handoff_practice:review-001/rev-a/q-1/cl-1",
		ReviewHandoffAssociation: "review_handoff_association:review-001/trn-2",
	}

	// Iterate the registry's known map directly (same package) so a
	// newly added type that's missing from the maps above is caught
	// by the "no test entity_id" check below, not silently skipped.
	for typ := range reg.known {
		id, ok := rootIDs[typ]
		if !ok {
			id = childIDs[typ]
		}
		if id == "" {
			t.Fatalf("no test entity_id for type %q — add it to rootIDs or childIDs in this test", typ)
		}
		_, _, resolved := RootFor(string(typ), id)
		if !resolved {
			t.Errorf("RootFor(%q, %q): expected ok=true but got false — type is in registry but has no root mapping", typ, id)
		}
	}
}
