package authz

import (
	"testing"

	"github.com/peaky-team/peaky/services/internal/syncengine/entity"
)

// authorization/REQ-007, REQ-008: every new review-child entity maps to the
// owning review resource, so a mutation is gated by Review edit access
// resolved from the typed, percent-encoded entity ID — never by the child id.
func TestResourceFor_TypedReviewChildrenGateOnOwningReview(t *testing.T) {
	cases := []struct {
		entityType     string
		entityID       string
		wantResourceID string
	}{
		{"review_handoff_practice", "review_handoff_practice:review-001/rev-a/q-1/cl-1", "review-001"},
		{"review_handoff_association", "review_handoff_association:review-001/trn-9", "review-001"},
		{"review_maturity_override", "review_maturity_override:review-001/trn-7", "review-001"},
		// Percent-encoded segments decode to the entitlement key.
		{"review_handoff_practice", "review_handoff_practice:review%20001/rev-a/q-1/cl-1", "review 001"},
	}
	for _, tc := range cases {
		rt, rid := resourceFor(tc.entityType, tc.entityID)
		if rt != "review" {
			t.Errorf("resourceFor(%s, %s): resource type=%s, want review", tc.entityType, tc.entityID, rt)
		}
		if rid != tc.wantResourceID {
			t.Errorf("resourceFor(%s, %s): resource id=%s, want %s", tc.entityType, tc.entityID, rid, tc.wantResourceID)
		}
	}
}

// A malformed typed review-child ID fails closed: it maps to a resource no
// entitlement will ever match, so the mutation is denied rather than
// accidentally gated on the child id or a wildcard.
func TestResourceFor_MalformedTypedReviewChildFailsClosed(t *testing.T) {
	cases := []struct {
		name       string
		entityType string
		entityID   string
	}{
		{"missing type prefix", "review_handoff_practice", "review-001/rev-a/q-1/cl-1"},
		{"empty review segment", "review_handoff_practice", "review_handoff_practice:/rev-a/q-1/cl-1"},
		{"bad percent escape", "review_maturity_override", "review_maturity_override:review%2/trn-7"},
		{"no unit segment", "review_handoff_association", "review_handoff_association:review-001"},
		// Segment-count contract (merge-check finding): too few or too many
		// unit segments must fail closed, never resolve to the owning review.
		{"practice too few segments", "review_handoff_practice", "review_handoff_practice:review-001/rev-a"},
		{"practice too many segments", "review_handoff_practice", "review_handoff_practice:review-001/rev-a/q-1/cl-1/extra"},
		{"override too many segments", "review_maturity_override", "review_maturity_override:review-001/trn-7/extra"},
		{"empty unit segment", "review_handoff_association", "review_handoff_association:review-001/"},
	}
	for _, tc := range cases {
		rt, rid := resourceFor(tc.entityType, tc.entityID)
		if rt == "review" && rid != "" && rid != tc.entityID {
			t.Errorf("%s: resourceFor(%s, %q) must fail closed, got review:%s", tc.name, tc.entityType, tc.entityID, rid)
		}
	}
}

// The exact segment-count contract is owned twice: entity.RootFor (pull/push
// rooting) and resourceFor (authorization). This guard fails when either map
// changes without the other — the two resolvers must never disagree on which
// typed review-child IDs are valid (merge-check finding).
func TestTypedReviewChildSegmentContractAgreesWithEntityRoot(t *testing.T) {
	types := []string{
		"review_maturity_override",
		"review_handoff_association",
		"review_handoff_practice",
	}
	valid := map[string]string{
		"review_maturity_override":   "review_maturity_override:rev-1/trn-1",
		"review_handoff_association": "review_handoff_association:rev-1/trn-1",
		"review_handoff_practice":    "review_handoff_practice:rev-1/rev-a/q-1/cl-1",
	}
	for _, entityType := range types {
		rootType, rootID, ok := entity.RootFor(entityType, valid[entityType])
		if !ok || rootType != "review" || rootID != "rev-1" {
			t.Errorf("RootFor(%s, %q) = (%s, %s, %v), want (review, rev-1, true)",
				entityType, valid[entityType], rootType, rootID, ok)
		}
		rt, rid := resourceFor(entityType, valid[entityType])
		if rt != "review" || rid != "rev-1" {
			t.Errorf("resourceFor(%s, %q) = (%s, %s), want (review, rev-1)",
				entityType, valid[entityType], rt, rid)
		}

		// Every other segment count must fail closed in BOTH resolvers.
		prefix := entityType + ":rev-1"
		candidates := []string{prefix, prefix + "/a", prefix + "/a/b", prefix + "/a/b/c", prefix + "/a/b/c/d"}
		for _, id := range candidates {
			_, _, rootOK := entity.RootFor(entityType, id)
			rt, _ := resourceFor(entityType, id)
			authzOK := rt == "review"
			if rootOK != authzOK {
				t.Errorf("resolver disagreement on %q: RootFor ok=%v, resourceFor review=%v",
					id, rootOK, authzOK)
			}
		}
	}
}
