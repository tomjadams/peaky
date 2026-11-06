// Package catalog serves the directory mirror snapshot with cache headers.
//
// The snapshot JSON (≈1.3 MB) is embedded at compile time so the binary is
// self-contained. Startup parses it once into typed structs. Sub-slice
// responses (users, groups, components) marshal on-demand; the full-snapshot
// Bootstrap endpoint serves the raw embedded bytes to avoid a second marshal.
//
// Memory layout (startup, never freed):
//
//	snapshotRaw  []byte  — original embedded JSON (≈1.3 MB)
//	snapshot     *Snapshot — parsed struct for sub-slice endpoints (≈3–4 MB)
//
// Total idle overhead: ≈4–5 MB. Cached at process level; zero heap per request
// for Bootstrap, one marshal per sub-slice request.
package catalog

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-fuego/fuego"
)

//go:embed data/catalog-directory-mirror.snapshot.json
var snapshotFS embed.FS

const snapshotPath = "data/catalog-directory-mirror.snapshot.json"

// Snapshot mirrors the structure of catalog-directory-mirror.snapshot.json.
type Snapshot struct {
	Version     string      `json:"version"`
	GeneratedAt string      `json:"generatedAt"`
	Users       []User      `json:"users"`
	Groups      []Group     `json:"groups"`
	Components  []Component `json:"components"`
}

// User is a slim directory user record.
type User struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
}

// Group is a directory group record with optional metadata.
type Group struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Description string `json:"description,omitempty"`
	MemberCount int    `json:"memberCount,omitempty"`
}

// Component is a catalog component record.
// Fields mirror shared/catalog-directory-mirror.ts CatalogComponent.
type Component struct {
	ID             string `json:"id"`
	DisplayName    string `json:"displayName"`
	Description    string `json:"description,omitempty"`
	Type           string `json:"type,omitempty"`
	OwnerGroupID   string `json:"ownerGroupId,omitempty"`
	OwnerGroupName string `json:"ownerGroupName,omitempty"`
	Lifecycle      string `json:"lifecycle,omitempty"`
	System         string `json:"system,omitempty"`
}

// Handlers holds the pre-parsed snapshot and raw bytes for zero-cost Bootstrap.
type Handlers struct {
	snapshot    *Snapshot
	snapshotRaw []byte // served byte-for-byte by Bootstrap — no re-marshal
}

// New reads the embedded snapshot once and returns ready Handlers.
// Returns an error if the JSON cannot be read or parsed.
func New() (*Handlers, error) {
	raw, err := snapshotFS.ReadFile(snapshotPath)
	if err != nil {
		return nil, fmt.Errorf("read catalog snapshot: %w", err)
	}
	var s Snapshot
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, fmt.Errorf("parse catalog snapshot: %w", err)
	}
	return &Handlers{snapshot: &s, snapshotRaw: raw}, nil
}

func setCacheHeaders(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400")
}

// Meta returns lightweight metadata (counts only, no arrays).
func (h *Handlers) Meta(c fuego.ContextNoBody) (map[string]any, error) {
	setCacheHeaders(c.Response())
	return map[string]any{
		"version":         h.snapshot.Version,
		"generatedAt":     h.snapshot.GeneratedAt,
		"usersCount":      len(h.snapshot.Users),
		"groupsCount":     len(h.snapshot.Groups),
		"componentsCount": len(h.snapshot.Components),
	}, nil
}

// Users returns all directory users as a JSON array.
func (h *Handlers) Users(c fuego.ContextNoBody) ([]User, error) {
	setCacheHeaders(c.Response())
	return h.snapshot.Users, nil
}

// Groups returns all directory groups as a JSON array.
func (h *Handlers) Groups(c fuego.ContextNoBody) ([]Group, error) {
	setCacheHeaders(c.Response())
	return h.snapshot.Groups, nil
}

// Components returns all catalog components as a JSON array.
func (h *Handlers) Components(c fuego.ContextNoBody) ([]Component, error) {
	setCacheHeaders(c.Response())
	return h.snapshot.Components, nil
}

// Bootstrap serves the full snapshot JSON.
// Uses the raw embedded bytes directly — no intermediate marshal/unmarshal.
// json.RawMessage implements json.Marshaler so Fuego sends the bytes as-is
// rather than base64-encoding them (which a plain []byte return would do).
func (h *Handlers) Bootstrap(c fuego.ContextNoBody) (json.RawMessage, error) {
	setCacheHeaders(c.Response())
	c.Response().Header().Set("Content-Type", "application/json")
	return json.RawMessage(h.snapshotRaw), nil
}
