## ADDED Requirements

### Requirement: Question Editor View Modes

The Template Studio SHALL provide two view modes for editing questions: Guided Mode (default) and Compact Mode (opt-in).

#### Scenario: Default to Guided Mode

- **WHEN** user expands a question card for the first time
- **THEN** the question editor displays in Guided Mode
- **AND** sections are shown one at a time in vertical layout

#### Scenario: Guided Mode section navigation

- **WHEN** editing a question in Guided Mode
- **THEN** the editor shows sections in order: Question, Why This Matters, Leading Practices, Resources
- **AND** a step indicator displays current step (e.g., "Step 1 of 4")
- **AND** a progress bar shows visual completion progress
- **AND** Next/Back buttons navigate between sections
- **AND** a Skip button allows skipping optional sections (Why This Matters, Leading Practices, Resources)

#### Scenario: Guided Mode section labels

- **WHEN** viewing each section in Guided Mode
- **THEN** Question section shows "(Required)" label
- **AND** Why This Matters section shows "(Recommended)" label
- **AND** Leading Practices section shows "(Optional)" label
- **AND** Resources section shows "(Optional)" label

#### Scenario: Guided Mode final step

- **WHEN** user reaches the last section (Resources) in Guided Mode
- **THEN** the Next button is replaced with a Done button
- **AND** clicking Done collapses the question card

#### Scenario: Compact Mode layout

- **WHEN** user switches to Compact Mode
- **THEN** the question editor displays the current 2-column layout
- **AND** all sections are visible simultaneously
- **AND** the Done button is visible at the bottom

### Requirement: View Mode Toggle

The Template Studio SHALL provide a toggle to switch between Guided and Compact modes.

#### Scenario: Toggle location

- **WHEN** a question card is expanded
- **THEN** a view mode toggle appears in the card header area
- **AND** the toggle displays the current mode label ("Guided" or "Compact")

#### Scenario: Toggle interaction

- **WHEN** user clicks the view mode toggle
- **THEN** the editor immediately switches to the other mode
- **AND** if switching from Guided to Compact, all sections become visible
- **AND** if switching from Compact to Guided, the first section (Question) is shown

### Requirement: View Mode Persistence

The Template Studio SHALL persist the user's view mode preference.

#### Scenario: Preference storage

- **WHEN** user changes the view mode
- **THEN** the preference is saved to localStorage with key "templateStudio.viewMode"
- **AND** the value is either "guided" or "compact"

#### Scenario: Preference restoration

- **WHEN** user returns to Template Studio in a new session
- **THEN** the previously selected view mode is restored
- **AND** all expanded question cards use the restored preference

#### Scenario: Global preference application

- **WHEN** user sets a view mode preference
- **THEN** the preference applies to all questions across all pillars
- **AND** the preference applies to all templates the user edits
