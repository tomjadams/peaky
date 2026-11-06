package authz

import (
	"net/url"
	"strings"
)

// resourceFor maps a domain entity to the resource whose access gates it — the
// entity graph the authorization boundary owns. A write to review_answer is
// gated by its parent review; a template_draft by its template; everything else
// gates on itself.
//
// Today this is a small switch. When the AuthZ service lands, this relationship
// moves into Cedar's entity store (each entity carries its `parents`), and the
// sync engine keeps sending the raw entity — it never learns the graph.
func resourceFor(entityType, entityID string) (string, string) {
	switch entityType {
	case "review_answer", "review_note", "review_attachment":
		reviewID, _, _ := strings.Cut(entityID, ":") // id is "reviewId:childId"
		return "review", reviewID
	case "review_maturity_override", "review_handoff_practice", "review_handoff_association":
		// Typed, percent-encoded ids: "<type>:<encodedReviewId>/<...>" — the
		// owning review is the first decoded path segment (the format is owned
		// by entity.RootFor and app/services/handoff/practice.ts). A malformed
		// id fails closed: it maps to itself, which no entitlement matches.
		if reviewID, ok := owningReviewSegment(entityType, entityID); ok {
			return "review", reviewID
		}
		return entityType, entityID
	case "review_checkpoint":
		return "review", entityID
	case "template_draft", "template_draft_pillar", "template_draft_question":
		return "template", entityID
	default: // review, product, template — gated on themselves
		return entityType, entityID
	}
}

// reviewChildSegments pins the exact unit-segment count each typed
// review-child id carries (owned by entity.RootFor and
// app/services/handoff/practice.ts): practice rows identify
// review/revision/question/practice; the transition streams identify
// review/transition. Enforcing the count here keeps authorization
// fail-closed even for callers that never consult entity.RootFor.
var reviewChildSegments = map[string]int{
	"review_maturity_override":   2,
	"review_handoff_association": 2,
	"review_handoff_practice":    4,
}

// owningReviewSegment decodes the first path segment of a typed review-child
// entity id ("<type>:<encodedReviewId>/<...>"). ok is false when the id has
// no type prefix, the wrong unit-segment count, an empty segment, or a
// segment that does not unescape.
func owningReviewSegment(entityType, entityID string) (string, bool) {
	rest, found := strings.CutPrefix(entityID, entityType+":")
	if !found {
		return "", false
	}
	segments := strings.Split(rest, "/")
	if len(segments) != reviewChildSegments[entityType] {
		return "", false
	}
	reviewID, err := url.PathUnescape(segments[0])
	if err != nil || reviewID == "" {
		return "", false
	}
	for _, segment := range segments[1:] {
		if decoded, err := url.PathUnescape(segment); err != nil || decoded == "" {
			return "", false
		}
	}
	return reviewID, true
}
