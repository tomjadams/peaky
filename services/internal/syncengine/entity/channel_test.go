package entity

import "testing"

// Every type the registry syncs must resolve to an SSE family. A persisted push
// of a familyless type would silently never ring a doorbell, so this guards the
// drift between DefaultRegistry's known set and Family's switch.
func TestEveryKnownTypeResolvesToAFamily(t *testing.T) {
	for et := range DefaultRegistry().known {
		fam, ok := Family(et)
		if !ok {
			t.Errorf("known type %q has no SSE family — add it to Family()", et)
			continue
		}
		if !IsFamily(fam) {
			t.Errorf("known type %q maps to %q, which is not a routable family", et, fam)
		}
	}
}

func TestFamilyRejectsUnknownType(t *testing.T) {
	if _, ok := Family(Type("revieww")); ok {
		t.Fatal("expected an unknown type to have no SSE family")
	}
}
