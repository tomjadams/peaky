// Package handoff implements the versioned HandoffLimits contract at the Go
// sync boundary (improvement-plans/REQ-011; local-first/REQ-013; AC-021
// through AC-023, AC-039 through AC-043).
//
// The same contract is enforced in TypeScript by
// app/services/handoff/limits.ts; parity between the two runtimes is proven
// against the shared boundary vectors in
// tests/fixtures/handoff-limits.v1.json (see fixture_test.go), not by
// duplicated constants drifting silently. Bumping the contract means bumping
// LimitsVersion, the fixture, and both validators in one change.
//
// Every text limit counts Unicode code points, never encoded bytes (AC-040):
// a 2,000-character multi-byte rationale is valid however many bytes it
// encodes to. Rejection is atomic and field-addressable: ValidateEventFields
// reports every violation of a mutation and the push handler rejects the
// whole event — no value is truncated and no collection member is dropped.
package handoff

import (
	"strconv"
	"strings"
	"unicode/utf8"
)

// LimitsVersion is the contract version shared with the TypeScript domain
// (HANDOFF_LIMITS_VERSION) and the boundary fixture. The Go fixture test
// asserts equality so drift is loud.
const LimitsVersion = "handoff-limits/v1"

// The versioned limits. Field names mirror the fixture's limits object.
const (
	RationaleChars                 = 2000 // rationale characters (code points)
	IdentifierChars                = 128  // external and evidence identifier characters each
	URLChars                       = 2048 // HTTPS URL characters
	HelpfulLinksPerPractice        = 10   // helpful links per practice
	EvidenceIdentifiersPerPractice = 20   // evidence identifiers per practice
	PracticesPerHandoff            = 50   // practices per handoff
)

// Violation codes. The three limit codes mirror the TypeScript
// HandoffLimitViolation codes exactly; the shape codes cover mutations whose
// fields are structurally wrong before any limit applies.
const (
	CodeCharacterLimit      = "character_limit_exceeded"
	CodeCollectionLimit     = "collection_limit_exceeded"
	CodeInvalidURLScheme    = "invalid_url_scheme"
	CodeInvalidShape        = "invalid_shape"
	CodeInvalidAction       = "invalid_action"
	CodeMissingReference    = "missing_reference"
	CodeUnexpectedReference = "unexpected_reference"
)

// Violation is one field-addressable limit or shape violation.
type Violation struct {
	Field  string // field path, e.g. "rationale", "helpfulLinks[3].url"
	Code   string
	Limit  int
	Actual int
}

// Field is one decoded push field — the wire value already JSON-decoded.
type Field struct {
	Name  string
	Value any
}

// Link is one helpful-link entry of a practice snapshot.
type Link struct {
	Title string
	URL   string
}

// characterCount counts Unicode code points — never UTF-16 units or encoded
// bytes. Matches [...value].length in TypeScript for valid JSON strings.
func characterCount(value string) int {
	return utf8.RuneCountInString(value)
}

func textViolation(value, field string, limit int) []Violation {
	actual := characterCount(value)
	if actual <= limit {
		return nil
	}
	return []Violation{{Field: field, Code: CodeCharacterLimit, Limit: limit, Actual: actual}}
}

// ValidateRationale enforces the 2,000-character rationale limit (AC-039).
func ValidateRationale(value string) []Violation {
	return textViolation(value, "rationale", RationaleChars)
}

// ValidateIdentifier enforces the 128-character identifier limit (AC-039).
func ValidateIdentifier(value, field string) []Violation {
	return textViolation(value, field, IdentifierChars)
}

// ValidateHTTPSURL enforces the HTTPS scheme and 2,048-character limit
// (AC-039). Unsafe schemes are rejected regardless of length.
func ValidateHTTPSURL(value, field string) []Violation {
	violations := textViolation(value, field, URLChars)
	if !strings.HasPrefix(value, "https://") {
		violations = append(violations, Violation{Field: field, Code: CodeInvalidURLScheme})
	}
	return violations
}

// ValidateHelpfulLinks enforces the per-practice helpful-links limit: at most
// 10 entries, each a bounded HTTPS URL (AC-041). Entries are never dropped.
func ValidateHelpfulLinks(links []Link) []Violation {
	var violations []Violation
	if len(links) > HelpfulLinksPerPractice {
		violations = append(violations, Violation{
			Field: "helpfulLinks", Code: CodeCollectionLimit,
			Limit: HelpfulLinksPerPractice, Actual: len(links),
		})
	}
	for i, link := range links {
		violations = append(violations, ValidateHTTPSURL(link.URL, "helpfulLinks["+itoa(i)+"].url")...)
	}
	return violations
}

// ValidateEvidenceIdentifiers enforces the per-practice evidence-identifier
// limit: at most 20 entries, each at most 128 characters (AC-041).
func ValidateEvidenceIdentifiers(identifiers []string) []Violation {
	var violations []Violation
	if len(identifiers) > EvidenceIdentifiersPerPractice {
		violations = append(violations, Violation{
			Field: "evidenceIdentifiers", Code: CodeCollectionLimit,
			Limit: EvidenceIdentifiersPerPractice, Actual: len(identifiers),
		})
	}
	for i, identifier := range identifiers {
		violations = append(violations, ValidateIdentifier(identifier, "evidenceIdentifiers["+itoa(i)+"]")...)
	}
	return violations
}

// ValidatePracticeCount enforces the 50-practice handoff maximum (AC-042).
func ValidatePracticeCount(count int) []Violation {
	if count <= PracticesPerHandoff {
		return nil
	}
	return []Violation{{
		Field: "practices", Code: CodeCollectionLimit,
		Limit: PracticesPerHandoff, Actual: count,
	}}
}

// itoa formats a collection index for a field path.
func itoa(i int) string {
	return strconv.Itoa(i)
}

// ValidateEventFields validates every handoff field of one pushed mutation
// against the versioned contract (local-first/REQ-013). Entity types outside
// the handoff streams carry no handoff limits and return nil.
func ValidateEventFields(entityType string, fields []Field) []Violation {
	switch entityType {
	case "review_handoff_practice":
		return validatePracticeFields(fields)
	case "review_handoff_association":
		return validateAssociationFields(fields)
	default:
		return nil
	}
}

// validatePracticeFields checks the rationale and the snapshot's bounded
// collections. Fields absent from the event carry no new value (field-level
// HLC writes are partial), so only present fields are validated.
func validatePracticeFields(fields []Field) []Violation {
	var violations []Violation
	for _, f := range fields {
		switch f.Name {
		case "rationale":
			if f.Value == nil {
				continue
			}
			value, ok := f.Value.(string)
			if !ok {
				violations = append(violations, Violation{Field: "rationale", Code: CodeInvalidShape})
				continue
			}
			violations = append(violations, ValidateRationale(value)...)
		case "snapshot":
			violations = append(violations, validateSnapshot(f.Value)...)
		}
	}
	return violations
}

// validateSnapshot extracts and validates the snapshot's bounded collections.
func validateSnapshot(value any) []Violation {
	if value == nil {
		return nil
	}
	snapshot, ok := value.(map[string]any)
	if !ok {
		return []Violation{{Field: "snapshot", Code: CodeInvalidShape}}
	}
	var violations []Violation
	if raw, present := snapshot["helpfulLinks"]; present && raw != nil {
		entries, ok := raw.([]any)
		if !ok {
			violations = append(violations, Violation{Field: "helpfulLinks", Code: CodeInvalidShape})
		} else {
			links := make([]Link, 0, len(entries))
			for i, entry := range entries {
				object, ok := entry.(map[string]any)
				url, urlOK := "", false
				if ok {
					url, urlOK = object["url"].(string)
				}
				if !ok || !urlOK {
					violations = append(violations, Violation{Field: "helpfulLinks[" + itoa(i) + "].url", Code: CodeInvalidShape})
					continue
				}
				links = append(links, Link{URL: url})
			}
			violations = append(violations, ValidateHelpfulLinks(links)...)
		}
	}
	if raw, present := snapshot["evidenceIdentifiers"]; present && raw != nil {
		entries, ok := raw.([]any)
		if !ok {
			violations = append(violations, Violation{Field: "evidenceIdentifiers", Code: CodeInvalidShape})
		} else {
			identifiers := make([]string, 0, len(entries))
			for i, entry := range entries {
				identifier, ok := entry.(string)
				if !ok {
					violations = append(violations, Violation{Field: "evidenceIdentifiers[" + itoa(i) + "]", Code: CodeInvalidShape})
					continue
				}
				identifiers = append(identifiers, identifier)
			}
			violations = append(violations, ValidateEvidenceIdentifiers(identifiers)...)
		}
	}
	return violations
}

// validateAssociationFields checks the transition shape: associate and
// replace carry a bounded external reference; revoke carries none. The
// transition stream is append-only, so a pushed event carries the full field
// set of one transition.
func validateAssociationFields(fields []Field) []Violation {
	byName := make(map[string]any, len(fields))
	for _, f := range fields {
		byName[f.Name] = f.Value
	}

	action, _ := byName["action"].(string)
	switch action {
	case "associate", "replace", "revoke":
	default:
		return []Violation{{Field: "action", Code: CodeInvalidAction}}
	}

	provider, hasProvider := byName["provider"]
	externalID, hasExternalID := byName["externalId"]
	rawURL, hasURL := byName["url"]
	carriesReference := (hasProvider && provider != nil) || (hasExternalID && externalID != nil) || (hasURL && rawURL != nil)

	if action == "revoke" {
		if carriesReference {
			return []Violation{{Field: "provider", Code: CodeUnexpectedReference}}
		}
		return nil
	}

	// associate | replace — the full bounded reference is required.
	if !carriesReference {
		return []Violation{{Field: "provider", Code: CodeMissingReference}}
	}
	var violations []Violation
	providerText, ok := provider.(string)
	if !ok {
		violations = append(violations, Violation{Field: "provider", Code: CodeMissingReference})
	} else {
		violations = append(violations, ValidateIdentifier(providerText, "provider")...)
	}
	externalIDText, ok := externalID.(string)
	if !ok {
		violations = append(violations, Violation{Field: "externalId", Code: CodeMissingReference})
	} else {
		violations = append(violations, ValidateIdentifier(externalIDText, "externalId")...)
	}
	urlText, ok := rawURL.(string)
	if !ok {
		violations = append(violations, Violation{Field: "url", Code: CodeMissingReference})
	} else {
		violations = append(violations, ValidateHTTPSURL(urlText, "url")...)
	}
	return violations
}
