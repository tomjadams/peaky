package conflict_test

import (
	"strings"
	"testing"

	"github.com/peaky-team/peaky/services/internal/syncengine/conflict"
)

// FuzzParseWire throws adversarial HLC strings at ParseWire to find panics
// or unexpected accepts. Any string that doesn't have exactly 3 colon-separated
// parts must return an error.
func FuzzParseWire(f *testing.F) {
	f.Add("1716220800000:0001:actor_alice")
	f.Add("0:0:a")
	f.Add("")
	f.Add("no-colons")
	f.Add("one:two")
	f.Add("a:b:c:d")
	f.Add("::::")
	f.Add("1000:0001:actor:with:colons")

	f.Fuzz(func(t *testing.T, hlc string) {
		w, c, a, err := conflict.ParseWire(hlc)
		parts := strings.SplitN(hlc, ":", 3)
		if len(parts) != 3 || parts[0] == "" || parts[1] == "" || parts[2] == "" {
			if err == nil {
				t.Errorf("ParseWire(%q) should error for malformed input, got w=%q c=%q a=%q", hlc, w, c, a)
			}
			return
		}
		if err != nil {
			t.Errorf("ParseWire(%q) errored on valid 3-part input: %v", hlc, err)
		}
	})
}

// FuzzCompareWire checks that lexicographic comparison never panics and
// satisfies antisymmetry: if Compare(a,b) > 0 then Compare(b,a) < 0.
func FuzzCompareWire(f *testing.F) {
	f.Add("1000:0001:alice", "0999:0001:alice")
	f.Add("1000:0001:alice", "1000:0001:alice")
	f.Add("1000:0001:bob", "1000:0001:alice")
	f.Add("", "")
	f.Add("z", "a")

	f.Fuzz(func(t *testing.T, a, b string) {
		ab := conflict.CompareWire(a, b)
		ba := conflict.CompareWire(b, a)

		// Antisymmetry
		if ab > 0 && ba >= 0 {
			t.Errorf("antisymmetry violated: Compare(%q,%q)=%d but Compare(%q,%q)=%d", a, b, ab, b, a, ba)
		}
		if ab < 0 && ba <= 0 {
			t.Errorf("antisymmetry violated: Compare(%q,%q)=%d but Compare(%q,%q)=%d", a, b, ab, b, a, ba)
		}
		if ab == 0 && ba != 0 {
			t.Errorf("equality violated: Compare(%q,%q)=0 but Compare(%q,%q)=%d", a, b, b, a, ba)
		}
	})
}

// FuzzWinsOver checks that WinsOver never panics on arbitrary input and that
// malformed incoming HLCs are either rejected or handled safely.
func FuzzWinsOver(f *testing.F) {
	f.Add("1000:0001:alice", "0999:0001", "alice")
	f.Add("bad-hlc", "1000:0001", "alice")
	f.Add("1000:0001:alice", "", "")
	f.Add("", "", "")
	f.Add("::::", ":::", "")

	f.Fuzz(func(t *testing.T, incoming, storedHLC, storedActor string) {
		// Must not panic — that's the primary assertion.
		wins, err := conflict.WinsOver(incoming, storedHLC, storedActor)

		// If incoming is malformed, WinsOver should return an error or false.
		parts := strings.SplitN(incoming, ":", 3)
		if len(parts) != 3 {
			if err == nil && wins {
				t.Errorf("WinsOver accepted malformed HLC %q", incoming)
			}
		}
	})
}

// FuzzGenerate checks monotonicity: Generate(wall, last) must produce an HLC
// that compares greater than `last` (when both are in storage format).
func FuzzGenerate(f *testing.F) {
	f.Add(int64(1000), "1000:0005")
	f.Add(int64(999), "1000:0005")
	f.Add(int64(1001), "1000:0005")
	f.Add(int64(0), "")
	f.Add(int64(1716220800000), "1716220800000:9999")

	f.Fuzz(func(t *testing.T, wallMs int64, last string) {
		if wallMs < 0 {
			return // negative wall clocks are not meaningful
		}

		hlc, err := conflict.Generate(wallMs, last)
		if err != nil {
			return // parse errors on garbage `last` are fine
		}

		// If last was valid, the new HLC must be strictly greater.
		if last != "" {
			_, _, parseErr := conflict.ParseStorage(last)
			if parseErr == nil {
				cmp := conflict.CompareWire(hlc+":z", last+":z")
				if cmp <= 0 {
					t.Errorf("Generate(%d, %q) = %q not greater than last", wallMs, last, hlc)
				}
			}
		}
	})
}
