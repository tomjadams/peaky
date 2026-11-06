package handoff

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// Fixture-driven parity test (improvement-plans/REQ-011; AC-039 through
// AC-043; local-first/REQ-013; AC-021 through AC-023).
//
// The single shared fixture tests/fixtures/handoff-limits.v1.json holds every
// boundary vector; this is the one table-driven Go consumer, mirroring
// tests/unit/services/handoff/limits.test.ts on the TypeScript side. The
// version assertion makes contract drift loud: bump the fixture version
// without updating this package (or vice versa) and this test fails.

const fixturePath = "../../../../tests/fixtures/handoff-limits.v1.json"

type fixtureVector struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Field  string `json:"field"`
	Char   string `json:"char"`
	Length int    `json:"length"`
	Count  int    `json:"count"`
	Value  string `json:"value"`
	Expect string `json:"expect"`
}

type limitsFixture struct {
	Version string `json:"version"`
	Limits  struct {
		RationaleChars                 int `json:"rationaleChars"`
		IdentifierChars                int `json:"identifierChars"`
		URLChars                       int `json:"urlChars"`
		HelpfulLinksPerPractice        int `json:"helpfulLinksPerPractice"`
		EvidenceIdentifiersPerPractice int `json:"evidenceIdentifiersPerPractice"`
		PracticesPerHandoff            int `json:"practicesPerHandoff"`
	} `json:"limits"`
	PushContract struct {
		MaxEventsPerPush  int    `json:"maxEventsPerPush"`
		MaxFieldsPerEvent int    `json:"maxFieldsPerEvent"`
		Source            string `json:"source"`
	} `json:"pushContract"`
	Vectors           []fixtureVector `json:"vectors"`
	LimitMaximalDraft struct {
		PracticeCount                  int `json:"practiceCount"`
		RationaleChars                 int `json:"rationaleChars"`
		HelpfulLinksPerPractice        int `json:"helpfulLinksPerPractice"`
		EvidenceIdentifiersPerPractice int `json:"evidenceIdentifiersPerPractice"`
		URLChars                       int `json:"urlChars"`
		IdentifierChars                int `json:"identifierChars"`
	} `json:"limitMaximalDraft"`
}

func loadFixture(t *testing.T) limitsFixture {
	t.Helper()
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f limitsFixture
	if err := json.Unmarshal(data, &f); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	return f
}

// The Go contract must be the fixture's contract, version included. A silent
// constant drift on either side fails here before any vector runs.
func TestFixtureParity(t *testing.T) {
	f := loadFixture(t)
	if f.Version != LimitsVersion {
		t.Fatalf("fixture version %q != Go contract version %q — the versioned contract drifted", f.Version, LimitsVersion)
	}
	limits := map[string][2]int{
		"rationaleChars":                 {f.Limits.RationaleChars, RationaleChars},
		"identifierChars":                {f.Limits.IdentifierChars, IdentifierChars},
		"urlChars":                       {f.Limits.URLChars, URLChars},
		"helpfulLinksPerPractice":        {f.Limits.HelpfulLinksPerPractice, HelpfulLinksPerPractice},
		"evidenceIdentifiersPerPractice": {f.Limits.EvidenceIdentifiersPerPractice, EvidenceIdentifiersPerPractice},
		"practicesPerHandoff":            {f.Limits.PracticesPerHandoff, PracticesPerHandoff},
	}
	for name, pair := range limits {
		if pair[0] != pair[1] {
			t.Errorf("limit %s: fixture %d != Go %d", name, pair[0], pair[1])
		}
	}
	// The push contract the limit-maximal draft must fit: 500 events per push,
	// 100 fields per event (services/internal/syncengine/push.go — the drift
	// guard pins those constants to the threat model, and this assertion pins
	// the fixture to them).
	if f.PushContract.MaxEventsPerPush != 500 || f.PushContract.MaxFieldsPerEvent != 100 {
		t.Errorf("push contract drifted: got %d events / %d fields, want 500/100",
			f.PushContract.MaxEventsPerPush, f.PushContract.MaxFieldsPerEvent)
	}
}

const urlPrefix = "https://example.com/"

// runVector evaluates one fixture vector against the Go validators. Returns
// the violations; an empty slice means accepted.
func runVector(t *testing.T, v fixtureVector) []Violation {
	t.Helper()
	switch v.Kind {
	case "text":
		value := strings.Repeat(v.Char, v.Length)
		if v.Field == "rationale" {
			return ValidateRationale(value)
		}
		return ValidateIdentifier(value, v.Field)
	case "url":
		padding := v.Length - len(urlPrefix)
		return ValidateHTTPSURL(urlPrefix+strings.Repeat("p", padding), v.Field)
	case "url-explicit":
		return ValidateHTTPSURL(v.Value, v.Field)
	case "collection":
		if v.Field == "helpfulLinks" {
			links := make([]Link, v.Count)
			for i := range links {
				links[i] = Link{Title: "Link", URL: urlPrefix + "x"}
			}
			return ValidateHelpfulLinks(links)
		}
		identifiers := make([]string, v.Count)
		for i := range identifiers {
			identifiers[i] = "ev"
		}
		return ValidateEvidenceIdentifiers(identifiers)
	case "practice-count":
		return ValidatePracticeCount(v.Count)
	default:
		t.Fatalf("unknown vector kind %q", v.Kind)
		return nil
	}
}

func TestBoundaryVectors(t *testing.T) {
	f := loadFixture(t)
	for _, vector := range f.Vectors {
		t.Run(vector.ID, func(t *testing.T) {
			violations := runVector(t, vector)
			switch vector.Expect {
			case "accept":
				if len(violations) != 0 {
					t.Fatalf("vector %s must be accepted, got %v", vector.ID, violations)
				}
			case "reject":
				if len(violations) == 0 {
					t.Fatalf("vector %s must be rejected", vector.ID)
				}
				// Rejection is field-addressable: the violation names the
				// field, the limit, and the actual size (AC-039).
				base := strings.SplitN(vector.Field, "[", 2)[0]
				if !strings.HasPrefix(violations[0].Field, base) {
					t.Errorf("violation field %q must address %q", violations[0].Field, vector.Field)
				}
				if violations[0].Code != CodeInvalidURLScheme && violations[0].Actual <= violations[0].Limit {
					t.Errorf("size violation must carry actual > limit, got %+v", violations[0])
				}
			default:
				t.Fatalf("unknown expect %q", vector.Expect)
			}
		})
	}
}

// AC-023: a draft at every limit serializes to 50 practice upsert events plus
// 50 association events — 100 events, under the 500-event push cap — and each
// event carries well under the 100-field cap. Every event passes Go sync
// validation, so no spec-valid draft is permanently unsyncable.
func TestLimitMaximalDraftFitsPushContract(t *testing.T) {
	f := loadFixture(t)
	m := f.LimitMaximalDraft

	rationale := strings.Repeat("r", m.RationaleChars)
	url := urlPrefix + strings.Repeat("u", m.URLChars-len(urlPrefix))
	identifier := strings.Repeat("x", m.IdentifierChars)

	links := make([]any, m.HelpfulLinksPerPractice)
	for i := range links {
		links[i] = map[string]any{"title": "L", "url": urlPrefix + "x"}
	}
	evidence := make([]any, m.EvidenceIdentifiersPerPractice)
	for i := range evidence {
		evidence[i] = "ev"
	}
	snapshot := map[string]any{
		"title":               "Practice",
		"helpfulLinks":        links,
		"evidenceIdentifiers": evidence,
	}

	practiceFields := []Field{
		{Name: "orderKey", Value: "a"},
		{Name: "snapshot", Value: snapshot},
		{Name: "rationale", Value: rationale},
		{Name: "selectionState", Value: "selected"},
	}
	associationFields := []Field{
		{Name: "practiceEntityId", Value: "review_handoff_practice:review-001/rev-a/q-1/cl-1"},
		{Name: "action", Value: "associate"},
		{Name: "provider", Value: "p"},
		{Name: "externalId", Value: identifier},
		{Name: "url", Value: url},
		{Name: "priorTransitionId", Value: nil},
	}

	if len(practiceFields) > f.PushContract.MaxFieldsPerEvent || len(associationFields) > f.PushContract.MaxFieldsPerEvent {
		t.Fatal("serialized rows must fit the 100-field event cap")
	}

	eventCount := m.PracticeCount * 2 // one practice upsert + one association per practice
	if eventCount > f.PushContract.MaxEventsPerPush {
		t.Fatalf("limit-maximal draft needs %d events, over the %d cap", eventCount, f.PushContract.MaxEventsPerPush)
	}

	for i := 0; i < m.PracticeCount; i++ {
		if v := ValidateEventFields("review_handoff_practice", practiceFields); len(v) != 0 {
			t.Fatalf("practice %d at every limit must be accepted, got %v", i, v)
		}
		if v := ValidateEventFields("review_handoff_association", associationFields); len(v) != 0 {
			t.Fatalf("association %d at every limit must be accepted, got %v", i, v)
		}
	}
}
