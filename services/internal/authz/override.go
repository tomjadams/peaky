package authz

import (
	"context"
	"fmt"
)

// This file is the action-specific Advisor maturity override policy
// (authorization/REQ-008; AC-022, AC-023, AC-024).
//
// The initial server policy authorizes override creation, supersession, and
// revocation when the actor is currently assigned to the owning Review with
// persisted participant role `reviewer` (product surfaces label that role
// Advisor without changing its persisted value) AND has Review edit access.
//
// Two properties make this an action-specific policy rather than a bare
// capability check (AC-024):
//   - the call carries the specific OverrideAction being authorized;
//   - the participant role is resolved through a server-side
//     review-participants lookup (ReviewParticipantLookup), never from
//     client-supplied claims.
//
// A view-or-edit capability answer alone is never sufficient.

// OverrideAction is the specific maturity override mutation being authorized.
type OverrideAction string

const (
	OverrideActionCreate    OverrideAction = "create"
	OverrideActionSupersede OverrideAction = "supersede"
	OverrideActionRevoke    OverrideAction = "revoke"
)

// ValidOverrideAction reports whether action is a known override action.
func ValidOverrideAction(action string) bool {
	switch OverrideAction(action) {
	case OverrideActionCreate, OverrideActionSupersede, OverrideActionRevoke:
		return true
	}
	return false
}

// persistedReviewerRole is the review_participants.role value that product
// surfaces label "Advisor" (authorization/REQ-008). The persisted value is
// never renamed.
const persistedReviewerRole = "reviewer"

// ReviewParticipantLookup resolves an actor's current persisted
// review-participant role through a server-side lookup. Returns "" when the
// actor has no current participant row on the review.
//
// Production: PostgresSyncRepo (internal/syncengine/repo) against
// review_participants. Tests: in-memory fakes.
type ReviewParticipantLookup interface {
	ParticipantRole(ctx context.Context, reviewID, actorID string) (string, error)
}

// MaturityOverridePolicy is the action-specific override authorization policy.
// It composes the shared Authorizer (Review edit access) with a server-side
// review-participants lookup (persisted `reviewer` role).
type MaturityOverridePolicy struct {
	base         Authorizer
	participants ReviewParticipantLookup
}

// NewMaturityOverridePolicy constructs the policy. Group 6 wires it into the
// sync push boundary for review_maturity_override events.
func NewMaturityOverridePolicy(base Authorizer, participants ReviewParticipantLookup) *MaturityOverridePolicy {
	return &MaturityOverridePolicy{base: base, participants: participants}
}

// Authorize decides whether actorID may perform the given override action on
// the owning review. It fails closed: an unknown action, missing edit access,
// a lookup error, or any persisted role other than `reviewer` denies the
// mutation, and the caller writes no transition.
func (p *MaturityOverridePolicy) Authorize(ctx context.Context, actorID, reviewID string, action OverrideAction) (bool, error) {
	if !ValidOverrideAction(string(action)) {
		return false, nil
	}
	canEdit, err := p.base.CanEdit(ctx, actorID, "review", reviewID)
	if err != nil {
		return false, fmt.Errorf("override policy: review edit check: %w", err)
	}
	if !canEdit {
		return false, nil
	}
	role, err := p.participants.ParticipantRole(ctx, reviewID, actorID)
	if err != nil {
		return false, fmt.Errorf("override policy: participant lookup: %w", err)
	}
	return role == persistedReviewerRole, nil
}
