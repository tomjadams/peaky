package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/peaky-team/peaky/services/internal/authz"
	"github.com/peaky-team/peaky/services/internal/middleware"
)

func makeRegistry(t *testing.T) *authz.Registry {
	t.Helper()
	return authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_dev",
			Email: "dev@peaky.local",
			Name:  "Dev",
			Entitlements: map[string]authz.Entitlement{
				"review:*": {CanView: true, CanEdit: true},
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
}

func TestActorMiddleware_HeaderExtraction(t *testing.T) {
	// GIVEN a request with x-actor-id, x-actor-email, x-actor-name
	reg := makeRegistry(t)
	mw := middleware.Actor(reg)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("x-actor-id", "actor_alice")
	req.Header.Set("x-actor-email", "alice@override.com")
	req.Header.Set("x-actor-name", "Alice Override")
	rec := httptest.NewRecorder()

	// WHEN the middleware processes the request
	called := false
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a := middleware.FromContext(r.Context())
		// THEN the actor is populated from headers
		if a.ID != "actor_alice" {
			t.Errorf("expected actor_alice, got %s", a.ID)
		}
		if a.Email != "alice@override.com" {
			t.Errorf("expected alice@override.com, got %s", a.Email)
		}
		if a.Name != "Alice Override" {
			t.Errorf("expected Alice Override, got %s", a.Name)
		}
		called = true
		w.WriteHeader(200)
	}))
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("handler not called")
	}
}

func TestActorMiddleware_DefaultFallback(t *testing.T) {
	// GIVEN a request with no x-actor-id header
	reg := makeRegistry(t)
	mw := middleware.Actor(reg)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	// WHEN the middleware processes the request
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a := middleware.FromContext(r.Context())
		// THEN actor_dev is used as fallback
		if a.ID != "actor_dev" {
			t.Errorf("expected actor_dev fallback, got %s", a.ID)
		}
		w.WriteHeader(200)
	}))
	handler.ServeHTTP(rec, req)
}

func TestActorMiddleware_MissingHeader_UsesDevFallback(t *testing.T) {
	// GIVEN a request explicitly without x-actor-id
	reg := makeRegistry(t)
	mw := middleware.Actor(reg)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	// WHEN middleware runs THEN actor_dev fallback is used
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a := middleware.FromContext(r.Context())
		if a.ID != "actor_dev" {
			t.Errorf("expected actor_dev for missing header, got %s", a.ID)
		}
		w.WriteHeader(200)
	}))
	handler.ServeHTTP(rec, req)
}

func TestActorMiddleware_RequestContext(t *testing.T) {
	// GIVEN a request with x-actor-id set to actor_alice
	reg := makeRegistry(t)
	mw := middleware.Actor(reg)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("x-actor-id", "actor_alice")
	rec := httptest.NewRecorder()

	// WHEN middleware runs
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// THEN the actor is also available via request context.Context
		a, ok := middleware.FromRequestContext(r.Context())
		if !ok {
			t.Fatal("actor not found in request context")
		}
		if a.ID != "actor_alice" {
			t.Errorf("expected actor_alice in request context, got %s", a.ID)
		}
		w.WriteHeader(200)
	}))
	handler.ServeHTTP(rec, req)
}

func TestActor_SanitizesLongHeader(t *testing.T) {
	// GIVEN a request with a 300-char x-actor-name header
	reg := makeRegistry(t)
	mw := middleware.Actor(reg)

	longName := make([]byte, 300)
	for i := range longName {
		longName[i] = 'A'
	}

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("x-actor-id", "actor_alice")
	req.Header.Set("x-actor-name", string(longName))
	rec := httptest.NewRecorder()

	// WHEN middleware processes the request
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a := middleware.FromContext(r.Context())
		// THEN the name is truncated to 256 chars
		nameRunes := []rune(a.Name)
		if len(nameRunes) > 256 {
			t.Errorf("expected name truncated to 256, got %d", len(nameRunes))
		}
		w.WriteHeader(200)
	}))
	handler.ServeHTTP(rec, req)
}

func TestActor_StripsControlCharacters(t *testing.T) {
	// GIVEN a request with control characters in x-actor-email
	reg := makeRegistry(t)
	mw := middleware.Actor(reg)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("x-actor-id", "actor_alice")
	req.Header.Set("x-actor-email", "alice\x00\x0a\x0d@peaky.local")
	rec := httptest.NewRecorder()

	// WHEN middleware processes the request
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		a := middleware.FromContext(r.Context())
		// THEN control characters are stripped from the email
		for _, r := range a.Email {
			if r < 0x20 || r == 0x7F {
				t.Errorf("email contains control character: %U", r)
			}
		}
		if a.Email != "alice@peaky.local" {
			t.Errorf("expected 'alice@peaky.local', got %q", a.Email)
		}
		w.WriteHeader(200)
	}))
	handler.ServeHTTP(rec, req)
}
