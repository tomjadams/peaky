// Package middleware provides HTTP middleware for the peaky-api server.
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/peaky-team/peaky/services/internal/authz"
)

type contextKey string

const actorContextKey contextKey = "actor"

// Actor extracts the actor from request headers and attaches it to the request
// context. Phase 1: headers are trusted. Phase 3: Okta JWT replaces this.
//
// Headers (set by Lambda Web Adapter / Nuxt proxy / test harness):
//
//	x-actor-id    — required; falls back to "actor_dev" when missing
//	x-actor-email — optional display field
//	x-actor-name  — optional display field
func Actor(reg *authz.Registry) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get("x-actor-id")
			if id == "" {
				id = "actor_dev"
			}
			email := r.Header.Get("x-actor-email")
			name := r.Header.Get("x-actor-name")

			roles := r.Header.Get("x-actor-roles")

			var a authz.Actor
			if hasRole(roles, "admin") {
				a = buildAdminActor(id, email, name)
			} else {
				a = reg.Get(id)
			}
			// Overlay display fields from headers so integration tests can pass
			// any actor identity without adding it to seed/actors.json.
			// Sanitize: truncate to 256 chars and strip control characters.
			if email != "" {
				a.Email = sanitizeHeader(email)
			}
			if name != "" {
				a.Name = sanitizeHeader(name)
			}

			// Store in request context for handlers and repository calls.
			ctx := context.WithValue(r.Context(), actorContextKey, a)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// FromContext retrieves the actor attached by the Actor middleware.
// Panics if called outside a request context — that's a programmer error.
func FromContext(ctx context.Context) authz.Actor {
	a, ok := ctx.Value(actorContextKey).(authz.Actor)
	if !ok {
		panic("middleware.Actor not applied: actor missing from context")
	}
	return a
}

// GetActor retrieves the actor from a plain context.Context without panicking.
// Returns the actor and whether it was found. Useful for repository layers that
// may or may not have the middleware applied.
func GetActor(ctx context.Context) (authz.Actor, bool) {
	a, ok := ctx.Value(actorContextKey).(authz.Actor)
	return a, ok
}

// FromRequestContext is an alias for [GetActor].
// Deprecated: use [GetActor] instead.
func FromRequestContext(ctx context.Context) (authz.Actor, bool) {
	return GetActor(ctx)
}

// sanitizeHeader truncates a header value to 256 chars and strips control characters
// to prevent log injection or response-splitting attacks.
func sanitizeHeader(s string) string {
	runes := []rune(s)
	if len(runes) > 256 {
		runes = runes[:256]
	}
	out := make([]rune, 0, len(runes))
	for _, r := range runes {
		if r >= 0x20 && r != 0x7F {
			out = append(out, r)
		}
	}
	return string(out)
}

// SetActorOnContext injects an actor directly into a context.Context.
// Intended for unit tests that bypass the Actor middleware.
func SetActorOnContext(ctx context.Context, a authz.Actor) context.Context {
	return context.WithValue(ctx, actorContextKey, a)
}

// hasRole checks whether a comma-separated roles string contains the target role.
func hasRole(roles, target string) bool {
	for r := range strings.SplitSeq(roles, ",") {
		if strings.TrimSpace(r) == target {
			return true
		}
	}
	return false
}

// buildAdminActor creates an actor with wildcard entitlements for all entity types.
// Used when x-actor-roles contains "admin" so that unknown actor IDs (not in the
// registry) are accepted with their original identity preserved.
func buildAdminActor(id, email, name string) authz.Actor {
	allAccess := authz.Entitlement{CanView: true, CanEdit: true}
	return authz.Actor{
		ID:    id,
		Email: sanitizeHeader(email),
		Name:  sanitizeHeader(name),
		Entitlements: map[string]authz.Entitlement{
			"review:*":   allAccess,
			"product:*":  allAccess,
			"template:*": allAccess,
		},
	}
}
