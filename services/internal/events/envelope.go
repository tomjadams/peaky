package events

import (
	"fmt"

	cloudevents "github.com/cloudevents/sdk-go/v2"
)

// ValidateEnvelope validates that a CloudEvents envelope has all required
// attributes. Returns nil if valid, or an error describing the violation.
// Used by tests and by the push handler for inbound event validation.
func ValidateEnvelope(event cloudevents.Event) error {
	if event.ID() == "" {
		return fmt.Errorf("missing required attribute: id")
	}
	if event.SpecVersion() == "" {
		return fmt.Errorf("missing required attribute: specversion")
	}
	if event.Type() == "" {
		return fmt.Errorf("missing required attribute: type")
	}
	if event.Source() == "" {
		return fmt.Errorf("missing required attribute: source")
	}
	if err := event.Validate(); err != nil {
		return fmt.Errorf("cloudevents validate: %w", err)
	}
	return nil
}
