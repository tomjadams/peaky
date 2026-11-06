package catalog_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/catalog"
)

func newHandlers(t *testing.T) *catalog.Handlers {
	t.Helper()
	h, err := catalog.New()
	if err != nil {
		t.Fatalf("catalog.New(): %v", err)
	}
	return h
}

func setupServer(t *testing.T, h *catalog.Handlers) *fuego.Server {
	t.Helper()
	s := fuego.NewServer()
	fuego.Get(s, "/api/catalog-directory-mirror", h.Bootstrap)
	fuego.Get(s, "/api/catalog-directory-mirror/meta", h.Meta)
	fuego.Get(s, "/api/catalog-directory-mirror/users", h.Users)
	fuego.Get(s, "/api/catalog-directory-mirror/groups", h.Groups)
	fuego.Get(s, "/api/catalog-directory-mirror/components", h.Components)
	return s
}

func TestMeta_Returns200WithCorrectShape(t *testing.T) {
	// GIVEN a catalog handler
	h := newHandlers(t)
	s := setupServer(t, h)

	// WHEN requesting the meta endpoint
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/catalog-directory-mirror/meta", nil)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN 200 with all expected keys in the JSON body
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	for _, key := range []string{"version", "generatedAt", "usersCount", "groupsCount", "componentsCount"} {
		if _, ok := body[key]; !ok {
			t.Errorf("missing key %q in meta response", key)
		}
	}
}

func TestMeta_SetsCacheHeaders(t *testing.T) {
	// GIVEN a catalog handler
	h := newHandlers(t)
	s := setupServer(t, h)

	// WHEN requesting meta
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/catalog-directory-mirror/meta", nil)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN Cache-Control header is set
	cc := rec.Header().Get("Cache-Control")
	if cc == "" {
		t.Error("expected Cache-Control header to be set")
	}
}

func TestUsers_ReturnsNonEmptyArray(t *testing.T) {
	// GIVEN a catalog handler WHEN requesting users
	h := newHandlers(t)
	s := setupServer(t, h)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/catalog-directory-mirror/users", nil)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN 200 with a non-empty JSON array
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var users []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &users); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(users) == 0 {
		t.Error("expected non-empty users array")
	}
}

func TestGroups_ReturnsNonEmptyArray(t *testing.T) {
	// GIVEN a catalog handler WHEN requesting groups
	h := newHandlers(t)
	s := setupServer(t, h)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/catalog-directory-mirror/groups", nil)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN 200 with a non-empty JSON array
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var groups []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &groups); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(groups) == 0 {
		t.Error("expected non-empty groups array")
	}
}

func TestComponents_ReturnsNonEmptyArray(t *testing.T) {
	// GIVEN a catalog handler WHEN requesting components
	h := newHandlers(t)
	s := setupServer(t, h)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/catalog-directory-mirror/components", nil)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN 200 with a non-empty JSON array
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var components []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &components); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if len(components) == 0 {
		t.Error("expected non-empty components array")
	}
}

func TestBootstrap_ReturnsFullSnapshot(t *testing.T) {
	// GIVEN a catalog handler
	h := newHandlers(t)
	s := setupServer(t, h)

	// WHEN requesting the bootstrap endpoint
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/catalog-directory-mirror", nil)
	rec := httptest.NewRecorder()
	s.Mux.ServeHTTP(rec, req)

	// THEN 200 with a full snapshot containing all expected keys
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	for _, key := range []string{"version", "generatedAt", "users", "groups", "components"} {
		if _, ok := body[key]; !ok {
			t.Errorf("missing key %q in bootstrap response", key)
		}
	}
}
