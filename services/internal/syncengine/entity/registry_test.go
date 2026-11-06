package entity

import (
	"reflect"
	"testing"
)

func TestDefaultRegistryRejectsUnknownEntityType(t *testing.T) {
	if DefaultRegistry().Knows("unknown") {
		t.Fatal("expected unknown entity type to be rejected")
	}
}

func TestDefaultRegistryKnownTypes(t *testing.T) {
	for _, et := range []Type{Review, ReviewAnswer, Product, Template, TemplateDraft} {
		if !DefaultRegistry().Knows(string(et)) {
			t.Fatalf("expected %q to be a known entity type", et)
		}
	}
}

// local-first/REQ-011: the maturity override and handoff streams synchronize
// as review children. Registering them in the known set is what lets push
// accept them and pull carry them under the owning review's entitlement.
func TestDefaultRegistryKnowsMaturityAndHandoffTypes(t *testing.T) {
	for _, et := range []Type{ReviewMaturityOverride, ReviewHandoffPractice, ReviewHandoffAssociation} {
		if !DefaultRegistry().Knows(string(et)) {
			t.Fatalf("expected %q to be a known entity type", et)
		}
	}
}

func TestDefaultRegistryPullRoots(t *testing.T) {
	roots := DefaultRegistry().PullRootTypes()
	if !reflect.DeepEqual(roots, []string{"product", "review"}) {
		t.Fatalf("expected [product review] pull roots, got %v", roots)
	}
}

// design Decision 3: none of the three new types is a pull root — each rides
// along under the owning review's stream. A new pull root would change the
// client's bootstrap/pull contract, which this change must not do.
func TestMaturityAndHandoffTypesAreNotPullRoots(t *testing.T) {
	roots := DefaultRegistry().PullRootTypes()
	for _, et := range []Type{ReviewMaturityOverride, ReviewHandoffPractice, ReviewHandoffAssociation} {
		for _, root := range roots {
			if root == string(et) {
				t.Fatalf("%q must not be a pull root", et)
			}
		}
	}
}

func TestValidOperation(t *testing.T) {
	for _, op := range []string{"create", "upsert", "update", "delete"} {
		if !ValidOperation(op) {
			t.Fatalf("expected %q to be a valid operation", op)
		}
	}
	if ValidOperation("unknown") {
		t.Fatal("did not expect unknown to be a valid operation")
	}
}
