package authz

import (
	"context"
	"fmt"
)

// This file is the single choke point for any future provider handoff
// network operation (authorization/REQ-007; AC-021; improvement-plans/
// AC-035; design Decision 7 of the maturity-score change).
//
// The handoff UI is always available — no public deployment flag gates it —
// and copy-text plus existing-ticket association never call a provider. Any
// future provider operation (reservation, creation, status sync) must pass
// AuthorizeProviderOperation BEFORE constructing or invoking a provider
// adapter: the private server capability must be enabled AND the actor must
// hold Review edit authorization for the owning Review.
//
// The policy fails closed in both dimensions:
//   - capability disabled → deny, without even consulting the authorizer,
//     so no downstream invocation (adapter, network) can be reached;
//   - authorization missing or erroring → deny.
//
// Handoff UI availability alone can never authorize a provider operation:
// the capability is server-only configuration, never serialized to the
// client.

// ProviderHandoffPolicy gates provider handoff operations on the private
// server capability composed with the shared Authorizer boundary.
type ProviderHandoffPolicy struct {
	capabilityEnabled bool
	base              Authorizer
}

// NewProviderHandoffPolicy constructs the choke point. capabilityEnabled is
// app.Config.ProviderHandoffIntegrationEnabled; base is the shared
// Authorizer (Registry today, Cedar later). No provider route registers in
// this change — the policy exists so the first future route has exactly one
// guard to call, and tests pin its fail-closed behavior.
func NewProviderHandoffPolicy(capabilityEnabled bool, base Authorizer) *ProviderHandoffPolicy {
	return &ProviderHandoffPolicy{capabilityEnabled: capabilityEnabled, base: base}
}

// AuthorizeProviderOperation decides whether actorID may perform a provider
// handoff operation on behalf of the owning review. It must be called
// before any provider adapter or network invocation. A disabled capability
// denies immediately — the authorizer is not consulted, mirroring the
// requirement that rejection happens before any downstream invocation.
func (p *ProviderHandoffPolicy) AuthorizeProviderOperation(ctx context.Context, actorID, reviewID string) (bool, error) {
	if !p.capabilityEnabled {
		return false, nil
	}
	canEdit, err := p.base.CanEdit(ctx, actorID, "review", reviewID)
	if err != nil {
		return false, fmt.Errorf("provider handoff policy: review edit check: %w", err)
	}
	return canEdit, nil
}
