// Package entity defines the sync-shape of each entity type: what the generic
// push/pull path needs to route it. Authorization deliberately lives elsewhere,
// at the authz boundary. What remains here is protocol shape: which types we
// sync, which operations they accept, which the client pulls in its own right,
// and which SSE family a type routes to (channel.go).
package entity

import "sort"

// Type is a known sync entity type. The constants below are the canonical list;
// referring to them (rather than raw strings) makes a typo a compile error.
// A value off the wire is a plain string until Knows passes judgement on it —
// the parse-at-the-edge that Pydantic/Zod do elsewhere.
type Type string

const (
	Review           Type = "review"
	ReviewCheckpoint Type = "review_checkpoint"
	ReviewAnswer     Type = "review_answer"
	ReviewNote       Type = "review_note"
	ReviewAttachment Type = "review_attachment"
	// Append-only review children from the maturity-score change (design
	// Decision 3): one row per Advisor override transition, one row per
	// selected handoff practice, one row per handoff association transition.
	// All three resolve their owning Review for push authorization, pull
	// scoping, and SSE family routing; none is a pull root.
	ReviewMaturityOverride   Type = "review_maturity_override"
	ReviewHandoffPractice    Type = "review_handoff_practice"
	ReviewHandoffAssociation Type = "review_handoff_association"
	Product                  Type = "product"
	Template                 Type = "template"
	TemplateDraft            Type = "template_draft"
	TemplateDraftPillar      Type = "template_draft_pillar"
	TemplateDraftQuestion    Type = "template_draft_question"
)

// Op is a push operation. Every entity accepts the same set today.
type Op string

const (
	OpCreate Op = "create"
	OpUpsert Op = "upsert"
	OpUpdate Op = "update"
	OpDelete Op = "delete"
)

var validOps = map[Op]bool{OpCreate: true, OpUpsert: true, OpUpdate: true, OpDelete: true}

// ValidOperation reports whether op is a push operation we accept.
func ValidOperation(op string) bool { return validOps[Op(op)] }

// Registry is the catalog of sync entity types used by the push/pull handlers:
// which types we sync, and which the client pulls in its own right.
type Registry struct {
	known map[Type]bool // every type we sync
	// pullRoots are the types the client pulls as their own entitlement-scoped
	// stream; every other type rides along under one of these (a review's
	// children share the review's visibility). This is a pull concern, not
	// domain modelling — template becomes a pull root only when its client
	// sync ships (Sync Templates effort).
	pullRoots map[Type]bool
}

// Knows reports whether entityType is a type we sync. Push rejects the rest as
// invalid_entity_type.
func (r Registry) Knows(entityType string) bool {
	return r.known[Type(entityType)]
}

// PullRootTypes returns the entity types the client pulls in their own right.
// Child rows are absent: they ride along under a parent pull root.
func (r Registry) PullRootTypes() []string {
	types := make([]string, 0, len(r.pullRoots))
	for entityType := range r.pullRoots {
		types = append(types, string(entityType))
	}
	sort.Strings(types)
	return types
}

// DefaultRegistry lists the sync entity types; review and product are the
// ones the client pulls in its own right.
func DefaultRegistry() Registry {
	known := []Type{
		Review, ReviewCheckpoint, ReviewAnswer, ReviewNote, ReviewAttachment,
		ReviewMaturityOverride, ReviewHandoffPractice, ReviewHandoffAssociation,
		Product, Template, TemplateDraft, TemplateDraftPillar, TemplateDraftQuestion,
	}
	pullRoots := []Type{Review, Product} // the client pulls these in their own right
	return newRegistry(known, pullRoots)
}

func newRegistry(known, pullRoots []Type) Registry {
	reg := Registry{
		known:     make(map[Type]bool, len(known)),
		pullRoots: make(map[Type]bool, len(pullRoots)),
	}
	for _, entityType := range known {
		reg.known[entityType] = true
	}
	for _, entityType := range pullRoots {
		reg.known[entityType] = true // a pull root is always a known type
		reg.pullRoots[entityType] = true
	}
	return reg
}
