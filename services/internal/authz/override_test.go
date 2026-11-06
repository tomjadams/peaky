package authz_test

import (
	"context"
	"errors"
	"testing"

	"github.com/peaky-team/peaky/services/internal/authz"
)

// fakeParticipantLookup is an in-memory ReviewParticipantLookup for policy
// unit tests — keyed "reviewID/actorID" → persisted role.
type fakeParticipantLookup struct {
	roles map[string]string
	err   error
}

func (f fakeParticipantLookup) ParticipantRole(_ context.Context, reviewID, actorID string) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	return f.roles[reviewID+"/"+actorID], nil
}

func makeOverridePolicy(t *testing.T, roles map[string]string) *authz.MaturityOverridePolicy {
	t.Helper()
	return authz.NewMaturityOverridePolicy(makeTestRegistry(t), fakeParticipantLookup{roles: roles})
}

func TestOverridePolicy_CurrentAdvisorMayTransition(t *testing.T) {
	// authorization/REQ-008; AC-022: a currently assigned persisted `reviewer`
	// with Review edit access may create, supersede, or revoke — and any
	// current Advisor may transition, so two distinct reviewers both pass.
	policy := makeOverridePolicy(t, map[string]string{
		"review-001/actor_alice": "reviewer",
		"review-001/actor_carol": "reviewer",
	})
	ctx := context.Background()

	for _, action := range []authz.OverrideAction{
		authz.OverrideActionCreate,
		authz.OverrideActionSupersede,
		authz.OverrideActionRevoke,
	} {
		ok, err := policy.Authorize(ctx, "actor_alice", "review-001", action)
		if err != nil || !ok {
			t.Errorf("reviewer+edit actor_alice action %s: got ok=%v err=%v, want ok=true", action, ok, err)
		}
	}

	// AC-043: a second current Advisor supersedes the first Advisor's override.
	carol := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_carol",
			Email: "carol@peaky.local",
			Name:  "Carol",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: true},
			},
		},
	})
	carolPolicy := authz.NewMaturityOverridePolicy(carol, fakeParticipantLookup{roles: map[string]string{
		"review-001/actor_carol": "reviewer",
	}})
	ok, err := carolPolicy.Authorize(ctx, "actor_carol", "review-001", authz.OverrideActionSupersede)
	if err != nil || !ok {
		t.Errorf("second current Advisor supersede: got ok=%v err=%v, want ok=true", ok, err)
	}
}

func TestOverridePolicy_EditAccessAloneIsInsufficient(t *testing.T) {
	// AC-023: an actor with Review edit access but no current persisted
	// `reviewer` assignment is rejected, and no transition is written.
	// AC-024: a bare view-or-edit capability check cannot authorize the
	// mutation — CanEdit alone says yes while the action-specific policy,
	// resolving the participant role server-side, says no.
	reg := makeTestRegistry(t)
	ctx := context.Background()

	bob := authz.NewRegistryFromActors([]authz.Actor{
		{
			ID:    "actor_bob",
			Email: "bob@peaky.local",
			Name:  "Bob",
			Entitlements: map[string]authz.Entitlement{
				"review:review-001": {CanView: true, CanEdit: true},
			},
		},
	})

	for _, actor := range []struct {
		name string
		reg  *authz.Registry
		id   string
	}{
		{"assessor participant", reg, "actor_alice"},
		{"non-participant", bob, "actor_bob"},
	} {
		p := authz.NewMaturityOverridePolicy(actor.reg, fakeParticipantLookup{roles: map[string]string{
			"review-001/actor_alice": "assessor",
		}})

		canEdit, err := actor.reg.CanEdit(ctx, actor.id, "review", "review-001")
		if err != nil || !canEdit {
			t.Fatalf("%s: fixture must hold edit access, got canEdit=%v err=%v", actor.name, canEdit, err)
		}
		for _, action := range []authz.OverrideAction{
			authz.OverrideActionCreate,
			authz.OverrideActionSupersede,
			authz.OverrideActionRevoke,
		} {
			ok, err := p.Authorize(ctx, actor.id, "review-001", action)
			if err != nil {
				t.Fatalf("%s action %s: unexpected error: %v", actor.name, action, err)
			}
			if ok {
				t.Errorf("%s action %s: edit-access-only actor must be denied", actor.name, action)
			}
		}
	}
}

func TestOverridePolicy_ReviewerWithoutEditAccessDenied(t *testing.T) {
	// AC-022: the participant role alone is insufficient — Review edit access
	// is also required. actor_alice is view-only on review-002.
	policy := makeOverridePolicy(t, map[string]string{
		"review-002/actor_alice": "reviewer",
	})
	ok, err := policy.Authorize(context.Background(), "actor_alice", "review-002", authz.OverrideActionCreate)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("reviewer without edit access must be denied")
	}
}

func TestOverridePolicy_UnknownActionDenied(t *testing.T) {
	// AC-024: the authorization call carries the specific override action;
	// an unknown action is never authorized.
	policy := makeOverridePolicy(t, map[string]string{
		"review-001/actor_alice": "reviewer",
	})
	ok, err := policy.Authorize(context.Background(), "actor_alice", "review-001", authz.OverrideAction("delete"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("unknown action must be denied even for a reviewer with edit access")
	}
}

func TestOverridePolicy_LookupErrorFailsClosed(t *testing.T) {
	// A failed server-side participant lookup denies the mutation — the
	// policy never falls back to a bare capability check on error.
	policy := authz.NewMaturityOverridePolicy(makeTestRegistry(t), fakeParticipantLookup{
		err: errors.New("participant store unavailable"),
	})
	ok, err := policy.Authorize(context.Background(), "actor_alice", "review-001", authz.OverrideActionCreate)
	if err == nil {
		t.Fatal("expected the lookup error to propagate")
	}
	if ok {
		t.Error("lookup failure must fail closed")
	}
}
