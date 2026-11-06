package authz_test

import (
	"context"
	"errors"
	"testing"

	"github.com/peaky-team/peaky/services/internal/authz"
)

// spyAuthorizer records whether the boundary was consulted at all. When the
// private capability is disabled, the choke point must reject before any
// downstream call — the same ordering that keeps a provider adapter and its
// network invocation unreachable (authorization/REQ-007; AC-021).
type spyAuthorizer struct {
	authz.Authorizer
	canEditCalls int
	canEdit      bool
	err          error
}

func (s *spyAuthorizer) CanEdit(_ context.Context, _, _, _ string) (bool, error) {
	s.canEditCalls++
	return s.canEdit, s.err
}

func TestProviderHandoffPolicy_CapabilityDisabledDeniesBeforeAnyInvocation(t *testing.T) {
	// authorization/REQ-007; AC-021; improvement-plans/AC-035: the handoff UI
	// is always available (no public flag gates it), yet with the private
	// server capability disabled the server rejects every provider operation.
	// The rejection happens before the authorizer — and therefore before any
	// adapter or network call a caller would make next — is even consulted.
	spy := &spyAuthorizer{canEdit: true} // even a fully authorized actor
	policy := authz.NewProviderHandoffPolicy(false, spy)

	ok, err := policy.AuthorizeProviderOperation(context.Background(), "actor_alice", "review-001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("capability disabled must deny even an authorized actor")
	}
	if spy.canEditCalls != 0 {
		t.Errorf("authorizer consulted %d times with the capability off; want 0 (fail before invocation)", spy.canEditCalls)
	}
}

func TestProviderHandoffPolicy_EnabledActorWithReviewEditAccessAllowed(t *testing.T) {
	// AC-021: with the capability enabled, the actor must still be authorized
	// for the owning Review — actor_alice can edit review-001.
	policy := authz.NewProviderHandoffPolicy(true, makeTestRegistry(t))

	ok, err := policy.AuthorizeProviderOperation(context.Background(), "actor_alice", "review-001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("enabled capability plus Review edit access should allow")
	}
}

func TestProviderHandoffPolicy_EnabledActorWithoutReviewAuthorizationDenied(t *testing.T) {
	// AC-021: the capability alone is never sufficient — actor_alice is
	// view-only on review-002, and an actor with no entitlement at all is
	// denied too.
	policy := authz.NewProviderHandoffPolicy(true, makeTestRegistry(t))
	ctx := context.Background()

	for _, tc := range []struct {
		name     string
		actorID  string
		reviewID string
	}{
		{"view-only actor", "actor_alice", "review-002"},
		{"unknown review", "actor_alice", "review-999"},
	} {
		ok, err := policy.AuthorizeProviderOperation(ctx, tc.actorID, tc.reviewID)
		if err != nil {
			t.Fatalf("%s: unexpected error: %v", tc.name, err)
		}
		if ok {
			t.Errorf("%s: enabled capability without Review edit access must deny", tc.name)
		}
	}
}

func TestProviderHandoffPolicy_AuthorizationErrorFailsClosed(t *testing.T) {
	// A failed Review authorization lookup denies the operation — the choke
	// point never falls back to allowing on error.
	spy := &spyAuthorizer{err: errors.New("entitlement store unavailable")}
	policy := authz.NewProviderHandoffPolicy(true, spy)

	ok, err := policy.AuthorizeProviderOperation(context.Background(), "actor_alice", "review-001")
	if err == nil {
		t.Fatal("expected the authorization error to propagate")
	}
	if ok {
		t.Error("authorization failure must fail closed")
	}
}
