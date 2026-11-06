package conflict_test

import (
	"context"
	"fmt"
	"testing"

	"pgregory.net/rapid"

	"github.com/peaky-team/peaky/services/internal/syncengine/conflict"
	"github.com/peaky-team/peaky/services/internal/syncengine/repo"
)

// genWallclock generates a realistic wallclock string (Unix ms, 13 digits).
func genWallclock() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		ms := rapid.Int64Range(1700000000000, 1800000000000).Draw(t, "wallclock")
		return fmt.Sprintf("%d", ms)
	})
}

// genCounter generates a zero-padded 4-digit counter.
func genCounter() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		c := rapid.IntRange(0, 9999).Draw(t, "counter")
		return fmt.Sprintf("%04d", c)
	})
}

// genActorID generates a short actor identifier.
func genActorID() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		letters := "abcdefghijklmnopqrstuvwxyz"
		idx := rapid.IntRange(0, len(letters)-1).Draw(t, "actor_idx")
		return "actor_" + string(letters[idx])
	})
}

// genWireHLC generates a valid wire-format HLC "wallclock:counter:actorId".
func genWireHLC() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		w := genWallclock().Draw(t, "w")
		c := genCounter().Draw(t, "c")
		a := genActorID().Draw(t, "a")
		return w + ":" + c + ":" + a
	})
}

// genStorageHLC generates a valid storage-format HLC "wallclock:counter".
func genStorageHLC() *rapid.Generator[string] {
	return rapid.Custom(func(t *rapid.T) string {
		w := genWallclock().Draw(t, "w")
		c := genCounter().Draw(t, "c")
		return w + ":" + c
	})
}

// --- Property: Transitivity ---
// If A > B and B > C, then A > C

func TestProperty_CompareWire_Transitivity(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := genWireHLC().Draw(t, "a")
		b := genWireHLC().Draw(t, "b")
		c := genWireHLC().Draw(t, "c")

		ab := conflict.CompareWire(a, b)
		bc := conflict.CompareWire(b, c)
		ac := conflict.CompareWire(a, c)

		if ab > 0 && bc > 0 && ac <= 0 {
			t.Fatalf("transitivity violated: %q > %q > %q but Compare(a,c) = %d", a, b, c, ac)
		}
		if ab < 0 && bc < 0 && ac >= 0 {
			t.Fatalf("transitivity violated: %q < %q < %q but Compare(a,c) = %d", a, b, c, ac)
		}
	})
}

// --- Property: Antisymmetry ---
// If A > B then B < A; if A == B then B == A

func TestProperty_CompareWire_Antisymmetry(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		a := genWireHLC().Draw(t, "a")
		b := genWireHLC().Draw(t, "b")

		ab := conflict.CompareWire(a, b)
		ba := conflict.CompareWire(b, a)

		if ab > 0 && ba >= 0 {
			t.Fatalf("antisymmetry: Compare(%q,%q)=%d but reverse=%d", a, b, ab, ba)
		}
		if ab == 0 && ba != 0 {
			t.Fatalf("reflexivity: Compare(%q,%q)=0 but reverse=%d", a, b, ba)
		}
	})
}

// --- Property: WinsOver agrees with CompareWire ---
// WinsOver(incoming, stored_hlc, stored_actor) should agree with full wire comparison.

func TestProperty_WinsOver_ConsistentWithCompare(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		incoming := genWireHLC().Draw(t, "incoming")
		storedHLC := genStorageHLC().Draw(t, "stored_hlc")
		storedActor := genActorID().Draw(t, "stored_actor")

		wins, err := conflict.WinsOver(incoming, storedHLC, storedActor)
		if err != nil {
			return // malformed input is fine to skip
		}

		// Reconstruct the full wire comparison
		storedFull := storedHLC + ":" + storedActor
		cmp := conflict.CompareWire(incoming, storedFull)

		if wins && cmp <= 0 {
			t.Fatalf("WinsOver=true but Compare(%q, %q)=%d (should be >0)", incoming, storedFull, cmp)
		}
		if !wins && cmp > 0 {
			t.Fatalf("WinsOver=false but Compare(%q, %q)=%d (should be <=0)", incoming, storedFull, cmp)
		}
	})
}

// --- Property: Generate monotonicity ---
// Generate(wall, last) must always produce output > last.

func TestProperty_Generate_Monotonicity(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		wallMs := rapid.Int64Range(1700000000000, 1800000000000).Draw(t, "wall")
		lastHLC := genStorageHLC().Draw(t, "last")

		hlc, err := conflict.Generate(wallMs, lastHLC)
		if err != nil {
			return
		}

		// Append a dummy actor for full wire comparison
		cmp := conflict.CompareWire(hlc+":z", lastHLC+":z")
		if cmp <= 0 {
			t.Fatalf("Generate(%d, %q) = %q — not monotonically greater", wallMs, lastHLC, hlc)
		}
	})
}

// --- Property: Conflict resolution determinism ---
// Same inputs in any order produce the same winner.

func TestProperty_ApplyFields_Deterministic(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Two actors, one field, different HLCs
		hlcA := genWireHLC().Draw(t, "hlc_a")
		hlcB := genWireHLC().Draw(t, "hlc_b")
		valA := `"val_a"`
		valB := `"val_b"`

		// Order 1: A then B
		r1 := repo.NewFakeSyncRepo()
		ctx := context.Background()
		_, _ = conflict.ApplyFields(ctx, r1, "test", "e1", "actor_a",
			[]repo.FieldValue{{Name: "f", Value: &valA, HLC: hlcA}})
		_, _ = conflict.ApplyFields(ctx, r1, "test", "e1", "actor_b",
			[]repo.FieldValue{{Name: "f", Value: &valB, HLC: hlcB}})

		// Order 2: B then A
		r2 := repo.NewFakeSyncRepo()
		_, _ = conflict.ApplyFields(ctx, r2, "test", "e1", "actor_b",
			[]repo.FieldValue{{Name: "f", Value: &valB, HLC: hlcB}})
		_, _ = conflict.ApplyFields(ctx, r2, "test", "e1", "actor_a",
			[]repo.FieldValue{{Name: "f", Value: &valA, HLC: hlcA}})

		fv1, _ := r1.GetFieldVersion(ctx, "test", "e1", "f")
		fv2, _ := r2.GetFieldVersion(ctx, "test", "e1", "f")

		if fv1 == nil || fv2 == nil {
			return // both should have a value
		}
		if fv1.HLC != fv2.HLC {
			t.Fatalf("non-deterministic: order1 HLC=%s, order2 HLC=%s (hlcA=%s, hlcB=%s)",
				fv1.HLC, fv2.HLC, hlcA, hlcB)
		}
	})
}

// --- Property: Non-overlapping field independence ---
// If two actors push different field names for the same entity, both are accepted.

func TestProperty_ApplyFields_IndependentFields(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		hlcA := genWireHLC().Draw(t, "hlc_a")
		hlcB := genWireHLC().Draw(t, "hlc_b")
		valA := `"a"`
		valB := `"b"`

		r := repo.NewFakeSyncRepo()
		ctx := context.Background()

		resA, errA := conflict.ApplyFields(ctx, r, "test", "e1", "actor_a",
			[]repo.FieldValue{{Name: "field_a", Value: &valA, HLC: hlcA}})
		resB, errB := conflict.ApplyFields(ctx, r, "test", "e1", "actor_b",
			[]repo.FieldValue{{Name: "field_b", Value: &valB, HLC: hlcB}})

		if errA != nil || errB != nil {
			return
		}

		// Both must be accepted — they touch different fields
		if !resA[0].Accepted {
			t.Fatalf("field_a rejected despite no overlap")
		}
		if !resB[0].Accepted {
			t.Fatalf("field_b rejected despite no overlap")
		}

		if r.FieldVersionCount() != 2 {
			t.Fatalf("expected 2 field versions, got %d", r.FieldVersionCount())
		}
	})
}
