> **Note:** The `specs/layout/` domain no longer exists. Review history and lineage requirements now live in `openspec/specs/reviews/spec.md`.

## ADDED Requirements

### Requirement: Assessment Session History

The application SHALL display assessment session history on the Review Details page, showing chronological progress snapshots.

#### Scenario: History section display
- **WHEN** viewing the Review Details page
- **THEN** a "History" section is displayed below the Breakdown section
- **AND** the section shows a timeline of assessment sessions
- **AND** sessions are ordered chronologically (most recent on right)
- **AND** the section shows an empty state when no sessions exist

#### Scenario: Timeline visualization
- **WHEN** viewing the History section with sessions
- **THEN** a horizontal timeline displays session nodes
- **AND** each node shows the date below
- **AND** progress percentage is shown below the date
- **AND** delta indicators (+N answers) are shown between nodes
- **AND** the current/latest session is visually highlighted

#### Scenario: Timeline interaction
- **WHEN** clicking on a timeline node
- **THEN** the corresponding session card is expanded
- **AND** the timeline node shows selected state
- **AND** the view scrolls to the session card if needed

### Requirement: Session Cards

The application SHALL display expandable session cards showing who made changes and what changed.

#### Scenario: Collapsed session card display
- **WHEN** viewing a session card in collapsed state
- **THEN** the card shows the session date and time
- **AND** shows the author's name
- **AND** shows a brief summary (e.g., "+5 answers, 3 pillars affected")
- **AND** shows a "Compare" button for diff selection

#### Scenario: Expanded session card display
- **WHEN** a session card is expanded
- **THEN** the card shows per-pillar progress deltas
- **AND** each pillar shows before and after percentages
- **AND** pillars with changes are visually distinct from unchanged pillars
- **AND** the optional session note is displayed if present

#### Scenario: Session card interaction
- **WHEN** clicking on a collapsed session card
- **THEN** the card expands with a smooth animation
- **AND** clicking again collapses the card
- **AND** keyboard navigation is supported (Enter to toggle)

### Requirement: Session Comparison Diff View

The application SHALL provide a diff view for comparing any two assessment sessions.

#### Scenario: Diff selection mode
- **WHEN** clicking "Compare" on a session card
- **THEN** the session enters comparison selection mode
- **AND** clicking "Compare" on a second session shows the diff view
- **AND** the UI indicates which sessions are selected for comparison
- **AND** clicking elsewhere cancels the selection

#### Scenario: Diff view display
- **WHEN** two sessions are selected for comparison
- **THEN** a diff panel opens showing changes between sessions
- **AND** changes are grouped by pillar
- **AND** each pillar shows overall progress delta badge
- **AND** individual question changes are listed within pillars

#### Scenario: Question-level diff rendering
- **WHEN** viewing question changes in the diff
- **THEN** added answers are styled with green text/background
- **AND** removed/changed answers show the old value with red text/strikethrough
- **AND** evidence changes are shown with appropriate styling
- **AND** unchanged questions are collapsed or hidden by default

#### Scenario: Diff view navigation
- **WHEN** the diff view is open
- **THEN** users can close the diff view to return to normal history view
- **AND** users can select a different session pair without closing first
- **AND** keyboard shortcut (Escape) closes the diff view

### Requirement: Session Creation Policy

The application SHALL only create assessment sessions when meaningful changes have been made.

#### Scenario: Session created on save with changes
- **WHEN** a user clicks "Save Progress" in the assessment
- **AND** at least one answer has changed since the last session
- **THEN** a new session is created with the current snapshot
- **AND** the session appears in the history timeline

#### Scenario: No session created for view-only visits
- **WHEN** a user opens an assessment without making changes
- **AND** navigates away or closes the page
- **THEN** no new session is created
- **AND** the history timeline remains unchanged

#### Scenario: No session created when save has no changes
- **WHEN** a user clicks "Save Progress" in the assessment
- **AND** no answers have changed since the last session
- **THEN** no new session is created
- **AND** the user receives feedback that there are no changes to save

#### Scenario: Change detection comparison
- **WHEN** determining if changes exist
- **THEN** the backend compares current answers against the last session snapshot
- **AND** only answer value changes count (not just opening/viewing questions)
- **AND** evidence and attachment changes also count as meaningful changes
