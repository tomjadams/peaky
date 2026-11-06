package sse

import (
	"slices"
	"strings"
	"testing"

	"github.com/peaky-team/peaky/services/internal/authz"
	"github.com/peaky-team/peaky/services/internal/ssecontract"
	"github.com/peaky-team/peaky/services/internal/syncengine/entity"
)

func actorWith(ents map[string]authz.Entitlement) authz.Actor {
	return authz.Actor{Entitlements: ents}
}

func TestEntitlementChannels_WildcardAndSpecificCollapseToFamilyCatalog(t *testing.T) {
	// GIVEN an actor entitled by both a wildcard and a specific review key
	a := actorWith(map[string]authz.Entitlement{
		"review:*":          {CanView: true},
		"review:review-001": {CanView: true},
	})

	// WHEN deriving LISTEN channels
	// THEN both collapse to the single sync:review:catalog channel
	want := []string{ssecontract.CatalogChannel("review")}
	if got := entitlementChannels(a); !slices.Equal(got, want) {
		t.Errorf("entitlementChannels = %v, want %v", got, want)
	}
}

func TestEntitlementChannels_DerivesOneChannelPerFamily(t *testing.T) {
	a := actorWith(map[string]authz.Entitlement{
		"review:*":   {CanView: true},
		"product:*":  {CanView: true},
		"template:*": {CanView: true},
	})

	got := entitlementChannels(a)
	want := []string{
		ssecontract.CatalogChannel("review"),
		ssecontract.CatalogChannel("product"),
		ssecontract.CatalogChannel("template"),
	}
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Errorf("entitlementChannels = %v, want %v", got, want)
	}
}

func TestEntitlementChannels_LimitedViewActorScopesToOneFamily(t *testing.T) {
	// GIVEN a non-admin actor entitled to view products only
	a := actorWith(map[string]authz.Entitlement{
		"product:*": {CanView: true},
	})

	// WHEN deriving LISTEN channels
	// THEN it subscribes to the product family channel only — never review's.
	// (Per-entity scope is NOT a channel concept; /pull enforces it.)
	want := []string{ssecontract.CatalogChannel("product")}
	if got := entitlementChannels(a); !slices.Equal(got, want) {
		t.Errorf("entitlementChannels = %v, want %v", got, want)
	}
}

func TestEntitlementChannels_NoLiteralWildcardInDerivedChannels(t *testing.T) {
	a := actorWith(map[string]authz.Entitlement{
		"review:*":   {CanView: true},
		"product:*":  {CanView: true},
		"template:*": {CanView: true},
	})

	for _, ch := range entitlementChannels(a) {
		if strings.Contains(ch, "*") {
			t.Errorf("derived channel %q contains a literal '*'; PG LISTEN is exact-match", ch)
		}
	}
}

func TestEntitlementChannels_SkipsNonViewableAndNonFamilyKeys(t *testing.T) {
	a := actorWith(map[string]authz.Entitlement{
		"review:*":          {CanView: false}, // not viewable
		"team:payments":     {CanView: true},  // not a routable family
		"review:review-001": {CanView: true},  // the only one that survives
	})

	want := []string{ssecontract.CatalogChannel("review")}
	if got := entitlementChannels(a); !slices.Equal(got, want) {
		t.Errorf("entitlementChannels = %v, want %v", got, want)
	}
}

// TestEntitlementChannels_AlignsWithPushNotifyChannel is the cross-service
// alignment guard (invariant I2): the channel a review push NOTIFYs is exactly
// one a review-entitled actor LISTENs on. Both sides resolve through
// entity.Family + ssecontract.CatalogChannel, so they cannot drift apart.
func TestEntitlementChannels_AlignsWithPushNotifyChannel(t *testing.T) {
	a := actorWith(map[string]authz.Entitlement{"review:*": {CanView: true}})

	pushFamily, ok := entity.Family(entity.Review)
	if !ok {
		t.Fatal("entity.Family(Review) must resolve to a family")
	}
	pushChannel := ssecontract.CatalogChannel(pushFamily)

	if got := entitlementChannels(a); !slices.Contains(got, pushChannel) {
		t.Errorf("review-entitled LISTEN set %v does not contain push channel %q", got, pushChannel)
	}
}
