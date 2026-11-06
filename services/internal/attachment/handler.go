// Package attachment handles secure attachment downloads.
// Validates actor entitlement before serving a presigned URL.
package attachment

import (
	"context"
	"database/sql"
	"errors"

	"github.com/go-fuego/fuego"

	"github.com/peaky-team/peaky/services/internal/authz"
	appmiddleware "github.com/peaky-team/peaky/services/internal/middleware"
)

// Repo is the minimal persistence interface required by the attachment handler.
type Repo interface {
	// FindAttachmentReview returns the review_id for an attachment, or empty
	// string + sql.ErrNoRows if not found.
	FindAttachmentReview(ctx context.Context, attachmentID string) (reviewID string, err error)
}

// Handlers holds the handler dependencies.
type Handlers struct {
	repo  Repo
	authz authz.Authorizer
}

// New returns a ready Handlers instance.
func New(r Repo, az authz.Authorizer) *Handlers {
	return &Handlers{repo: r, authz: az}
}

// Download handles GET /api/attachments/:id
//
// Flow:
//  1. Resolve the attachment's parent review.
//  2. Verify the actor is entitled to view that review.
//  3. Return a presigned URL (stub: metadata only until S3 is wired).
func (h *Handlers) Download(c fuego.ContextNoBody) (map[string]string, error) {
	ctx := c.Context()
	attachmentID := c.PathParam("id")
	if attachmentID == "" {
		return map[string]string{}, fuego.BadRequestError{Title: "attachment id required"}
	}

	a := appmiddleware.FromContext(c.Context())

	// 1. Resolve parent review
	reviewID, err := h.repo.FindAttachmentReview(ctx, attachmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return map[string]string{}, fuego.NotFoundError{Title: "attachment not found"}
	}
	if err != nil {
		return map[string]string{}, fuego.HTTPError{Title: "failed to find attachment"}
	}

	// 2. Entitlement check
	canView, err := h.authz.CanView(ctx, a.ID, "review", reviewID)
	if err != nil {
		return map[string]string{}, fuego.HTTPError{Title: "entitlement check failed"}
	}
	if !canView {
		return map[string]string{}, fuego.ForbiddenError{Title: "not entitled to view this attachment"}
	}

	// 3. TODO: generate presigned URL and redirect:
	//    presignedURL, err := s3client.PresignGetObject(ctx, objectKey, 15*time.Minute)
	//    return c.Redirect(http.StatusFound, presignedURL)
	//
	// For MVP (no S3 wired) — return metadata stub.
	return map[string]string{
		"attachmentId": attachmentID,
		"reviewId":     reviewID,
		"message":      "presigned URL generation not yet implemented",
	}, nil
}
