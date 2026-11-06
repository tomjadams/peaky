## MODIFIED Requirements

### Requirement: Question Severity Levels

The system SHALL support only meaningful action-plan severity levels for template questions.

#### Scenario: Supported severity values

- **WHEN** a question severity is stored, returned, or edited
- **THEN** the supported non-empty values are `critical`, `high`, and `medium`
- **AND** `low` is not a supported severity value
- **AND** every question has a severity level (null severity is not supported in the plan model)

#### Scenario: Severity display

- **WHEN** severity is displayed in plan, assessment, or template authoring UI
- **THEN** Critical, High, and Medium are the available severity labels
- **AND** no Low option is displayed

#### Scenario: Existing low-severity data

- **WHEN** existing data contains `low` question severity
- **THEN** the migration converts that value to `medium`
- **AND** the migrated question remains available in templates and reviews
- **AND** the conversion from low to medium is intentional to avoid the type-system complexity of nullable severity across projection, filtering, and display
