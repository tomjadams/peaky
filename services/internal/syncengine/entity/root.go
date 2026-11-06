package entity

import (
	"net/url"
	"strings"
)

// rootTypes are entity types that are their own root: root_type = entity_type,
// root_id = entity_id. A root type is a thing an actor can be granted access
// to (review, product) or a top-level aggregate that children hang off
// (template_draft). SSE family (channel.go) and pull root (registry.go) are
// distinct concerns — a type can be a root for stamping without being a pull
// root (e.g. template_draft is stamped now but becomes a pull root only in
// the Sync Templates effort).
//
// NOTE: template_draft is stamped as its own root type here, but
// authz/resource.go maps template_draft to the "template" resource family
// for access control. When template_draft becomes a pull root (Sync
// Templates), the pull handler will call ViewableEntities(actor,
// "template_draft"), which must resolve against the "template" resource
// mapping. That effort must align the pull-root type with the authz
// resource name — either by adding a template_draft → template_draft
// resource mapping in authz, or by having the pull handler translate
// pull-root types to authz resource names. This is intentionally deferred
// because template_draft is not a pull root in this MR.
var rootTypes = map[Type]bool{
	Review:        true,
	Product:       true,
	Template:      true,
	TemplateDraft: true,
}

// childToRoot maps a child entity type to its parent root type. The root_id
// is derived by splitting the composite entity_id on the first ':' and
// taking the prefix (e.g. "review-001:q1" → "review-001").
var childToRoot = map[Type]Type{
	ReviewCheckpoint:      Review,
	ReviewAnswer:          Review,
	ReviewNote:            Review,
	ReviewAttachment:      Review,
	TemplateDraftPillar:   TemplateDraft,
	TemplateDraftQuestion: TemplateDraft,
}

// childSharesRootID lists child types whose entity_id IS the root id
// (no composite {rootId}: prefix). review_checkpoint uses the review id
// directly because a checkpoint is review-scoped, not a separate entity.
var childSharesRootID = map[Type]bool{
	ReviewCheckpoint: true,
}

// typedReviewChildren are review children whose entity ID carries the type
// name as a prefix followed by '/'-separated percent-encoded segments:
// "<type>:<encodedReviewId>/<...>" (design Decision 3 of
// implement-maturity-score; the TypeScript encoder is
// app/services/handoff/practice.ts practiceEntityId). The owning review is
// the first decoded segment. The remaining segments are the child unit
// identity and are never parsed for meaning — templateRevisionId stays an
// opaque value. The value is the exact segment count the ID must carry.
var typedReviewChildren = map[Type]int{
	ReviewHandoffPractice:    4, // review / revision / question / practice
	ReviewHandoffAssociation: 2, // review / transition
	ReviewMaturityOverride:   2, // review / transition
}

// resolveTypedReviewChild extracts the owning review id from a typed,
// percent-encoded child entity ID. ok is false when the prefix, the segment
// count, or any segment is malformed — a child with no resolvable root would
// be invisible to every entitlement-scoped pull.
func resolveTypedReviewChild(entityType Type, entityID string, wantSegments int) (rootType, rootID string, ok bool) {
	rest, found := strings.CutPrefix(entityID, string(entityType)+":")
	if !found {
		return "", "", false
	}
	segments := strings.Split(rest, "/")
	if len(segments) != wantSegments {
		return "", "", false
	}
	decoded := make([]string, len(segments))
	for i, segment := range segments {
		value, err := url.PathUnescape(segment)
		if err != nil || value == "" {
			return "", "", false
		}
		decoded[i] = value
	}
	return string(Review), decoded[0], true
}

// RootFor resolves the root entity (rootType, rootID) for a given entity.
// Root types are their own root. Child types resolve to their parent root
// type and the {rootId} prefix of the composite entity_id (before the first
// ':'). Returns ok=false if the entity type is unknown or a child has no
// parseable {rootId}: prefix.
//
// This is the bridge between the fine-grained entity_type/entity_id on each
// event and the coarse root_type/root_id that entitlements are keyed on.
// The push handler calls this after Knows passes and stamps the result on
// the stored event; the pull handler filters on root_type/root_id.
func RootFor(entityType, entityID string) (rootType, rootID string, ok bool) {
	if entityID == "" {
		return "", "", false
	}

	t := Type(entityType)

	// Root type: self-rooted.
	if rootTypes[t] {
		return entityType, entityID, true
	}

	// Typed review children: "<type>:<encodedReviewId>/<...>".
	if wantSegments, isTyped := typedReviewChildren[t]; isTyped {
		return resolveTypedReviewChild(t, entityID, wantSegments)
	}

	// Child type: resolve to parent root + prefix before first ':'.
	parentRoot, isChild := childToRoot[t]
	if !isChild {
		return "", "", false
	}

	idx := strings.IndexByte(entityID, ':')
	if idx <= 0 { // no ':' or ':' at position 0 (empty prefix)
		// Child types whose entity_id IS the root id (no composite prefix).
		if childSharesRootID[t] {
			return string(parentRoot), entityID, true
		}
		return "", "", false
	}

	// Reject a trailing colon with no suffix (e.g. "review-001:") — the
	// child unit id is empty, which is not a valid entity.
	if idx == len(entityID)-1 {
		return "", "", false
	}

	return string(parentRoot), entityID[:idx], true
}
