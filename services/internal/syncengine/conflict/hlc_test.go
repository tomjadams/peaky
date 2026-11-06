package conflict_test

import (
	"testing"

	"github.com/peaky-team/peaky/services/internal/syncengine/conflict"
)

// TestParseWire covers valid and invalid wire-format HLC strings.
func TestParseWire(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		// GIVEN a well-formed wire HLC string
		// WHEN parsing it
		w, c, a, err := conflict.ParseWire("1716220800000:0001:actor_alice")

		// THEN all three parts are extracted without error
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if w != "1716220800000" || c != "0001" || a != "actor_alice" {
			t.Errorf("unexpected parts: %q %q %q", w, c, a)
		}
	})

	t.Run("too few parts", func(t *testing.T) {
		// GIVEN a wire string with only 2 colon-separated parts
		// WHEN parsing it THEN an error is returned
		_, _, _, err := conflict.ParseWire("1716220800000:0001")
		if err == nil {
			t.Fatal("expected error for 2-part HLC")
		}
	})

	t.Run("empty string", func(t *testing.T) {
		// GIVEN an empty string WHEN parsing THEN an error is returned
		_, _, _, err := conflict.ParseWire("")
		if err == nil {
			t.Fatal("expected error for empty HLC")
		}
	})
}

// TestParseStorage covers valid and invalid storage-format HLC strings.
func TestParseStorage(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		// GIVEN a well-formed storage HLC "wallclock:counter"
		// WHEN parsing it
		w, c, err := conflict.ParseStorage("1716220800000:0001")

		// THEN both parts are extracted without error
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if w != "1716220800000" || c != "0001" {
			t.Errorf("unexpected parts: %q %q", w, c)
		}
	})

	t.Run("invalid", func(t *testing.T) {
		// GIVEN a string without a colon WHEN parsing THEN error
		_, _, err := conflict.ParseStorage("nocolon")
		if err == nil {
			t.Fatal("expected error")
		}
	})
}

// TestToStorage converts wire format to storage format.
func TestToStorage(t *testing.T) {
	// GIVEN a wire-format HLC with actor suffix
	// WHEN converting to storage format
	storage, err := conflict.ToStorage("1716220800000:0001:actor_alice")

	// THEN the actor is stripped, leaving wallclock:counter
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if storage != "1716220800000:0001" {
		t.Errorf("expected '1716220800000:0001', got %q", storage)
	}
}

// TestCompareWire verifies lexicographic ordering.
func TestCompareWire(t *testing.T) {
	// GIVEN pairs of wire-format HLCs with known ordering
	cases := []struct {
		name string
		a, b string
		want int
	}{
		{"newer wallclock wins", "1000:0001:alice", "0999:0001:alice", 1},
		{"older wallclock loses", "0999:0001:alice", "1000:0001:alice", -1},
		{"same wallclock higher counter wins", "1000:0002:alice", "1000:0001:alice", 1},
		{"same wallclock+counter higher actorId wins", "1000:0001:bob", "1000:0001:alice", 1},
		{"identical", "1000:0001:alice", "1000:0001:alice", 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// WHEN comparing the two HLCs
			got := conflict.CompareWire(tc.a, tc.b)

			// THEN the expected ordering is returned
			if got != tc.want {
				t.Errorf("CompareWire(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

// TestWinsOver covers all winning/losing scenarios.
func TestWinsOver(t *testing.T) {
	t.Run("newer wallclock wins", func(t *testing.T) {
		// GIVEN an incoming HLC newer than stored
		// WHEN checking if it wins
		wins, err := conflict.WinsOver("1000:0001:alice", "0999:0001", "alice")

		// THEN it wins
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !wins {
			t.Error("newer HLC should win")
		}
	})

	t.Run("older wallclock loses", func(t *testing.T) {
		// GIVEN an incoming HLC older than stored
		// WHEN checking if it wins THEN it loses
		wins, err := conflict.WinsOver("0999:0001:alice", "1000:0001", "alice")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if wins {
			t.Error("older HLC should lose")
		}
	})

	t.Run("same wallclock+counter, actor tiebreaker: bob > alice", func(t *testing.T) {
		// GIVEN identical wallclock:counter but bob > alice
		// WHEN checking if bob wins THEN yes (lexicographic)
		wins, err := conflict.WinsOver("1000:0001:bob", "1000:0001", "alice")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !wins {
			t.Error("bob should win tiebreaker against alice (lexicographic)")
		}
	})

	t.Run("same wallclock+counter, actor tiebreaker: alice < bob", func(t *testing.T) {
		// GIVEN identical wallclock:counter but alice < bob
		// WHEN checking if alice wins THEN no
		wins, err := conflict.WinsOver("1000:0001:alice", "1000:0001", "bob")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if wins {
			t.Error("alice should lose tiebreaker against bob")
		}
	})

	t.Run("no stored version: incoming always wins", func(t *testing.T) {
		// GIVEN no stored version (empty strings)
		// WHEN checking if incoming wins THEN it always wins
		wins, err := conflict.WinsOver("1000:0001:alice", "", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !wins {
			t.Error("incoming should win when no stored version")
		}
	})

	t.Run("malformed incoming HLC returns error", func(t *testing.T) {
		// GIVEN a malformed incoming HLC
		// WHEN checking WinsOver THEN an error is returned
		_, err := conflict.WinsOver("bad-hlc", "1000:0001", "alice")
		if err == nil {
			t.Fatal("expected error for malformed HLC")
		}
	})

	t.Run("padding: zero-padded counters compare correctly", func(t *testing.T) {
		// GIVEN zero-padded counters where 0010 > 0009
		// "0010" > "0009" lexicographically ✓ but "0010" < "0100"
		wins, err := conflict.WinsOver("1000:0010:alice", "1000:0009", "alice")

		// WHEN comparing THEN 0010 wins
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !wins {
			t.Error("counter 0010 should beat 0009")
		}
	})
}

// TestGenerate covers monotonicity and counter increment.
func TestGenerate(t *testing.T) {
	t.Run("fresh clock: counter starts at 0", func(t *testing.T) {
		// GIVEN no previous HLC (empty last)
		// WHEN generating THEN counter starts at 0000
		hlc, err := conflict.Generate(1000, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hlc != "1000:0000" {
			t.Errorf("expected '1000:0000', got %q", hlc)
		}
	})

	t.Run("advancing wall clock resets counter", func(t *testing.T) {
		// GIVEN wall clock advanced past last HLC
		// WHEN generating THEN counter resets to 0000
		hlc, err := conflict.Generate(1001, "1000:0005")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hlc != "1001:0000" {
			t.Errorf("expected '1001:0000', got %q", hlc)
		}
	})

	t.Run("same wall clock increments counter", func(t *testing.T) {
		// GIVEN same wall clock as last HLC
		// WHEN generating THEN counter increments by 1
		hlc, err := conflict.Generate(1000, "1000:0003")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if hlc != "1000:0004" {
			t.Errorf("expected '1000:0004', got %q", hlc)
		}
	})

	t.Run("generated HLC is monotonically greater than last", func(t *testing.T) {
		// GIVEN a last HLC value
		last := "1000:0005"

		// WHEN generating a new HLC at the same wall clock
		hlc, err := conflict.Generate(1000, last)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// THEN the new HLC compares greater than last
		if conflict.CompareWire(hlc+":z", last+":z") <= 0 {
			t.Errorf("generated HLC %q not greater than last %q", hlc, last)
		}
	})
}
