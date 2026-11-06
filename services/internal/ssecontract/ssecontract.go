// Package ssecontract is the shared SSE wire contract between peaky-api (which
// NOTIFYs after a push) and peaky-sse (which LISTENs and streams to browsers).
// Holding the channel-name format and the payload shape in one place is what
// guarantees the doorbell a client subscribes to is exactly the one a push
// rings: a single source of truth instead of two artifacts drifting apart.
package ssecontract

// CatalogChannel returns the single per-family PostgreSQL LISTEN/NOTIFY channel,
// "sync:{family}:catalog" — the only SSE channel form there is.
//
// Wildcards are an entitlement concept, not a channel one. An actor entitled by
// "review:*" and one entitled by "review:review-001" collapse to the very same
// sync:review:catalog channel: the family is the unit of SSE routing, so a "*"
// never reaches a channel name (PostgreSQL LISTEN is exact-match and would treat
// "*" as a literal asterisk that no NOTIFY targets). Per-entity scope is
// re-applied by /pull, never by the channel.
func CatalogChannel(family string) string {
	return "sync:" + family + ":catalog"
}

// CursorNotification is the SSE wire payload: a cursor pointer plus the family
// that changed, carrying no domain data. The client calls pullChanges() on
// receipt; the entitlement-scoped /pull endpoint stays the authorization boundary.
type CursorNotification struct {
	Cursor string `json:"cursor"`
	Family string `json:"family"`
}
