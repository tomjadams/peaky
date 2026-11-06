package handoff

import (
	"strings"
	"testing"
)

// Unit tests for the versioned HandoffLimits validators
// (improvement-plans/REQ-011; AC-039 through AC-043). Boundary parity with
// the TypeScript contract is proven by fixture_test.go against the shared
// vectors — these tests pin shape rules the fixture does not cover.

func TestValidateRationale_CharacterBoundary(t *testing.T) {
	if v := ValidateRationale(strings.Repeat("a", RationaleChars)); len(v) != 0 {
		t.Fatalf("at-limit rationale must pass, got %v", v)
	}
	v := ValidateRationale(strings.Repeat("a", RationaleChars+1))
	if len(v) != 1 || v[0].Code != CodeCharacterLimit || v[0].Field != "rationale" {
		t.Fatalf("over-limit rationale must fail field-addressably, got %v", v)
	}
	if v[0].Limit != RationaleChars || v[0].Actual != RationaleChars+1 {
		t.Fatalf("violation must carry limit and actual, got %+v", v[0])
	}
}

func TestValidateRationale_CountsCharactersNotBytes(t *testing.T) {
	// AC-040: 2000 rocket emoji are 2000 code points but 8000 UTF-8 bytes —
	// accepted because limits count characters, never encoded bytes.
	multibyte := strings.Repeat("🚀", RationaleChars)
	if len(multibyte) <= RationaleChars {
		t.Fatalf("test premise broken: byte length %d should exceed the limit", len(multibyte))
	}
	if v := ValidateRationale(multibyte); len(v) != 0 {
		t.Fatalf("multi-byte rationale at the character limit must pass, got %v", v)
	}
}

func TestValidateHTTPSURL_SchemeAndLength(t *testing.T) {
	atLimit := "https://example.com/" + strings.Repeat("p", URLChars-len("https://example.com/"))
	if v := ValidateHTTPSURL(atLimit, "url"); len(v) != 0 {
		t.Fatalf("at-limit https URL must pass, got %v", v)
	}
	if v := ValidateHTTPSURL("http://example.com/t", "url"); len(v) == 0 || v[len(v)-1].Code != CodeInvalidURLScheme {
		t.Fatalf("non-https URL must be rejected regardless of length, got %v", v)
	}
	over := "https://example.com/" + strings.Repeat("p", URLChars-len("https://example.com/")+1)
	if v := ValidateHTTPSURL(over, "url"); len(v) == 0 || v[0].Code != CodeCharacterLimit {
		t.Fatalf("over-limit URL must be rejected, got %v", v)
	}
}

func TestValidateEventFields_PracticeSnapshotCollections(t *testing.T) {
	snapshot := map[string]any{
		"title": "Practice",
		"helpfulLinks": []any{
			map[string]any{"title": "L0", "url": "https://example.com/0"},
		},
		"evidenceIdentifiers": []any{"ev-1"},
	}
	fields := []Field{
		{Name: "orderKey", Value: "a"},
		{Name: "snapshot", Value: snapshot},
		{Name: "rationale", Value: "why"},
		{Name: "selectionState", Value: "selected"},
	}
	if v := ValidateEventFields("review_handoff_practice", fields); len(v) != 0 {
		t.Fatalf("valid practice fields must pass, got %v", v)
	}

	snapshot["helpfulLinks"] = make([]any, HelpfulLinksPerPractice+1)
	for i := range HelpfulLinksPerPractice + 1 {
		snapshot["helpfulLinks"].([]any)[i] = map[string]any{"title": "L", "url": "https://example.com/x"}
	}
	v := ValidateEventFields("review_handoff_practice", fields)
	if len(v) == 0 {
		t.Fatal("over-limit helpfulLinks must be rejected")
	}
	found := false
	for _, violation := range v {
		if violation.Field == "helpfulLinks" && violation.Code == CodeCollectionLimit {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected a helpfulLinks collection violation, got %v", v)
	}
}

func TestValidateEventFields_AssociationShape(t *testing.T) {
	associate := []Field{
		{Name: "action", Value: "associate"},
		{Name: "provider", Value: "gitlab"},
		{Name: "externalId", Value: "TEAM-1"},
		{Name: "url", Value: "https://example.com/t/1"},
		{Name: "priorTransitionId", Value: nil},
	}
	if v := ValidateEventFields("review_handoff_association", associate); len(v) != 0 {
		t.Fatalf("valid associate transition must pass, got %v", v)
	}

	revoke := []Field{
		{Name: "action", Value: "revoke"},
		{Name: "provider", Value: nil},
		{Name: "externalId", Value: nil},
		{Name: "url", Value: nil},
	}
	if v := ValidateEventFields("review_handoff_association", revoke); len(v) != 0 {
		t.Fatalf("valid revoke transition must pass, got %v", v)
	}

	badAction := []Field{{Name: "action", Value: "close"}}
	if v := ValidateEventFields("review_handoff_association", badAction); len(v) == 0 {
		t.Fatal("unknown action must be rejected")
	}

	revokeWithRef := append([]Field{}, revoke...)
	revokeWithRef[1] = Field{Name: "provider", Value: "gitlab"}
	if v := ValidateEventFields("review_handoff_association", revokeWithRef); len(v) == 0 {
		t.Fatal("a revoke transition carrying a reference must be rejected")
	}

	missingRef := []Field{{Name: "action", Value: "replace"}}
	if v := ValidateEventFields("review_handoff_association", missingRef); len(v) == 0 {
		t.Fatal("a replace transition missing its reference must be rejected")
	}
}

func TestValidateEventFields_OtherTypesUnaffected(t *testing.T) {
	if v := ValidateEventFields("review_answer", []Field{{Name: "answer", Value: "yes"}}); v != nil {
		t.Fatalf("non-handoff types carry no handoff validation, got %v", v)
	}
	if v := ValidateEventFields("review_maturity_override", []Field{{Name: "action", Value: "create"}}); v != nil {
		t.Fatalf("override transitions carry no handoff limits, got %v", v)
	}
}
