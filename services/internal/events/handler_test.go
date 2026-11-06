package events_test

import (
	"testing"

	cloudevents "github.com/cloudevents/sdk-go/v2"

	"github.com/peaky-team/peaky/services/internal/events"
)

func validEvent() cloudevents.Event {
	e := cloudevents.NewEvent()
	e.SetID("evt-001")
	e.SetType("ReviewAnswerRecorded.v1")
	e.SetSource("peaky.client")
	return e
}

// ── ValidateEnvelope ─────────────────────────────────────────────────────────

func TestValidateEnvelope_Valid_ReturnsNil(t *testing.T) {
	// GIVEN a valid CloudEvent WHEN validating THEN no error
	e := validEvent()
	if err := events.ValidateEnvelope(e); err != nil {
		t.Errorf("expected nil, got %v", err)
	}
}

func TestValidateEnvelope_MissingID_ReturnsError(t *testing.T) {
	// GIVEN a CloudEvent with empty ID WHEN validating THEN error
	e := validEvent()
	e.SetID("")
	if err := events.ValidateEnvelope(e); err == nil {
		t.Error("expected error for missing id, got nil")
	}
}

func TestValidateEnvelope_MissingType_ReturnsError(t *testing.T) {
	// GIVEN a CloudEvent with empty type WHEN validating THEN error
	e := validEvent()
	e.SetType("")
	if err := events.ValidateEnvelope(e); err == nil {
		t.Error("expected error for missing type, got nil")
	}
}

func TestValidateEnvelope_MissingSource_ReturnsError(t *testing.T) {
	// GIVEN a CloudEvent with empty source WHEN validating THEN error
	e := validEvent()
	e.SetSource("")
	if err := events.ValidateEnvelope(e); err == nil {
		t.Error("expected error for missing source, got nil")
	}
}

func TestValidateEnvelope_MissingSpecVersion_ReturnsError(t *testing.T) {
	// GIVEN a CloudEvent with empty specversion
	e := cloudevents.NewEvent()
	e.SetID("evt-001")
	e.SetType("ReviewAnswerRecorded.v1")
	e.SetSource("peaky.client")
	e.SetSpecVersion("")

	// WHEN validating THEN error is returned
	if err := events.ValidateEnvelope(e); err == nil {
		t.Error("expected error for missing specversion, got nil")
	}
}

func TestValidateEnvelope_InvalidSpecVersion_ReturnsError(t *testing.T) {
	// GIVEN a CloudEvent with unsupported specversion "99.0"
	e := cloudevents.NewEvent()
	e.SetID("evt-001")
	e.SetType("ReviewAnswerRecorded.v1")
	e.SetSource("peaky.client")
	e.SetSpecVersion("99.0")

	// WHEN validating THEN error is returned
	if err := events.ValidateEnvelope(e); err == nil {
		t.Error("expected error for invalid specversion 99.0, got nil")
	}
}

func TestValidateEnvelope_AllRequired_Passes(t *testing.T) {
	// GIVEN a CloudEvent with all required fields populated
	e := cloudevents.NewEvent()
	e.SetID("abc-123")
	e.SetType("FieldsSynced.v1")
	e.SetSource("peaky.sync")
	e.SetSubject("review-001")

	// WHEN validating THEN no error
	if err := events.ValidateEnvelope(e); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}
