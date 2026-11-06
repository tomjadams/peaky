package entity

// This file classifies each sync entity type into its SSE routing family: a
// static, persistence-free property, the same sync-shape the rest of this
// package describes. The wire contract it feeds (the channel-name format and
// the notification payload) lives in the shared ssecontract package, so this
// file stays pure domain classification with no transport knowledge.

// families are the routable SSE families. "team" is deliberately absent: it is
// neither an entitlement key nor a synced entity type, only a review's owning
// subject, so it is not a routing concept.
var families = map[string]bool{
	"review":   true,
	"product":  true,
	"template": true,
}

// IsFamily reports whether s is a routable SSE family (review, product, template).
func IsFamily(s string) bool { return families[s] }

// Family maps a sync entity type to its SSE catalog family: a review and its
// children share the review family; a template and its drafts share the
// template family. ok is false for types that have no family channel.
func Family(t Type) (family string, ok bool) {
	switch t {
	case Review, ReviewCheckpoint, ReviewAnswer, ReviewNote, ReviewAttachment,
		ReviewMaturityOverride, ReviewHandoffPractice, ReviewHandoffAssociation:
		return "review", true
	case Product:
		return "product", true
	case Template, TemplateDraft, TemplateDraftPillar, TemplateDraftQuestion:
		return "template", true
	default:
		return "", false
	}
}
