package attachment_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/attachment"
	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
)

// ── Fakes ─────────────────────────────────────────────────────────────────

type fakeAttachmentRepo struct {
	attachments map[string]string // attachmentID → reviewID
}

func (f *fakeAttachmentRepo) FindAttachmentReview(_ context.Context, id string) (string, error) {
	if reviewID, ok := f.attachments[id]; ok {
		return reviewID, nil
	}
	return "", sql.ErrNoRows
}

type fakeAuthZ struct {
	viewable map[string]bool // "entityType:entityID"
}

func (f *fakeAuthZ) CanView(_ context.Context, _, entityType, entityID string) (bool, error) {
	return f.viewable[entityType+":"+entityID], nil
}

func (f *fakeAuthZ) CanEdit(_ context.Context, _, entityType, entityID string) (bool, error) {
	return false, nil
}

func (f *fakeAuthZ) ViewableEntities(_ context.Context, _, _ string) ([]string, error) {
	return nil, nil
}

func (f *fakeAuthZ) Entitlements(_ context.Context, _ string) (map[string]authz.Entitlement, error) {
	return nil, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────

func makeRequest(t *testing.T, attachmentID string, r attachment.Repo, az authz.Authorizer) *httptest.ResponseRecorder {
	t.Helper()
	h := attachment.New(r, az)
	rec := httptest.NewRecorder()

	// Empty attachmentID can't be routed through the mux (Go's ServeMux
	// cleans the double-slash and returns 307). Test the handler directly
	// via Fuego's MockContext so the empty-path-param validation is covered.
	if attachmentID == "" {
		mockCtx := fuego.NewMockContextNoBody()
		mockCtx.CommonCtx = appmiddleware.SetActorOnContext(context.Background(), authz.Actor{ID: "actor_alice"})
		mockCtx.PathParams["id"] = ""
		result, err := h.Download(mockCtx)
		if err != nil {
			fuego.SendJSONError(rec, nil, err)
		} else {
			_ = json.NewEncoder(rec).Encode(result)
		}
		return rec
	}

	reg := authz.NewRegistryFromActors([]authz.Actor{
		{ID: "actor_alice", Email: "alice@peaky.local", Name: "Alice",
			Entitlements: map[string]authz.Entitlement{
				"review:*": {CanView: true, CanEdit: true},
			}},
	})
	s := fuego.NewServer()
	fuego.Use(s, appmiddleware.Actor(reg))
	fuego.Get(s, "/api/attachments/{id}/download", h.Download)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/attachments/"+attachmentID+"/download", nil)
	req.Header.Set("x-actor-id", "actor_alice")
	s.Mux.ServeHTTP(rec, req)
	return rec
}

// ── Tests ─────────────────────────────────────────────────────────────────

func TestDownload_AuthorizedActor_Returns200(t *testing.T) {
	// GIVEN an attachment linked to a review the actor can view
	r := &fakeAttachmentRepo{attachments: map[string]string{"att-001": "review-001"}}
	az := &fakeAuthZ{viewable: map[string]bool{"review:review-001": true}}

	// WHEN downloading THEN 200 is returned
	rec := makeRequest(t, "att-001", r, az)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDownload_UnauthorizedActor_Returns403(t *testing.T) {
	// GIVEN an attachment the actor has no view access to
	r := &fakeAttachmentRepo{attachments: map[string]string{"att-001": "review-001"}}
	az := &fakeAuthZ{viewable: map[string]bool{}}

	// WHEN downloading THEN 403 is returned
	rec := makeRequest(t, "att-001", r, az)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDownload_EmptyAttachmentID_Returns400(t *testing.T) {
	// GIVEN an empty attachment ID
	r := &fakeAttachmentRepo{attachments: map[string]string{}}
	az := &fakeAuthZ{viewable: map[string]bool{}}

	// WHEN downloading THEN 400 is returned
	rec := makeRequest(t, "", r, az)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

type errorAttachmentRepo struct{}

func (e *errorAttachmentRepo) FindAttachmentReview(_ context.Context, _ string) (string, error) {
	return "", fmt.Errorf("database connection lost")
}

func TestDownload_RepoError_Returns500(t *testing.T) {
	// GIVEN a repo that returns a database error
	r := &errorAttachmentRepo{}
	az := &fakeAuthZ{viewable: map[string]bool{}}

	// WHEN downloading THEN 500 is returned
	rec := makeRequest(t, "att-001", r, az)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", rec.Code, rec.Body.String())
	}
}

type errorAuthZ struct {
	fakeAuthZ
}

func (e *errorAuthZ) CanView(_ context.Context, _, _, _ string) (bool, error) {
	return false, fmt.Errorf("authz service unavailable")
}

func TestDownload_AuthzError_Returns500(t *testing.T) {
	// GIVEN an authz service that returns an error
	r := &fakeAttachmentRepo{attachments: map[string]string{"att-001": "review-001"}}
	az := &errorAuthZ{}

	// WHEN downloading THEN 500 is returned
	rec := makeRequest(t, "att-001", r, az)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestDownload_MissingAttachment_Returns404(t *testing.T) {
	// GIVEN an attachment ID that does not exist in the repo
	r := &fakeAttachmentRepo{attachments: map[string]string{}}
	az := &fakeAuthZ{viewable: map[string]bool{}}

	// WHEN downloading THEN 404 is returned
	rec := makeRequest(t, "att-999", r, az)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rec.Code, rec.Body.String())
	}
}
