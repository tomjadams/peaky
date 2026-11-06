## MODIFIED Requirements

### Requirement: Shared Answer Toggle Component
The system SHALL provide a reusable `AnswerToggle` component for Yes/No/N/A answer selection.

#### Scenario: User selects Yes answer
- **WHEN** user clicks the "Yes" button
- **THEN** the button shows green highlight
- **AND** the selected state meets WCAG AA contrast in light and dark themes
- **AND** the component emits the answer value

#### Scenario: User selects No answer
- **WHEN** user clicks the "No" button
- **THEN** the button shows amber highlight
- **AND** the selected state meets WCAG AA contrast in light and dark themes
- **AND** the component emits the answer value

#### Scenario: User selects N/A answer
- **WHEN** user clicks the "N/A" button
- **THEN** the component emits an 'na-click' event
- **AND** the N/A control uses neutral styling with WCAG AA contrast in light and dark themes
- **AND** the parent component opens the NA reason modal

#### Scenario: User deselects current answer
- **WHEN** user clicks the currently selected answer button
- **THEN** the answer is cleared (set to null)
- **AND** no button is highlighted

### Requirement: Not Applicable Answer Option

The application SHALL provide a "Not Applicable" (N/A) answer option for questions that do not apply to the user's specific context, infrastructure, or operational model.

#### Scenario: N/A button display in dashboard view

- **WHEN** viewing questions in dashboard view
- **THEN** a third "N/A" button is displayed alongside Yes and No buttons
- **AND** the N/A button uses neutral styling with WCAG AA contrast to distinguish it from Yes/No options
- **AND** the button is positioned as the rightmost option in the answer toggle group
- **AND** the button includes proper ARIA attributes for accessibility

#### Scenario: N/A option display in survey view

- **WHEN** viewing questions in survey view
- **THEN** a "not applicable" link is displayed below the Yes and No buttons
- **AND** the link uses subtle underlined text styling
- **AND** the link meets contrast requirements in both light and dark themes
- **AND** the link includes proper ARIA label for accessibility
- **AND** clicking the link opens the N/A reason modal

#### Scenario: N/A button interaction

- **WHEN** a user clicks the N/A button or link
- **THEN** a modal dialog appears requiring reason selection
- **AND** the modal title reads "Why is this question not applicable?"
- **AND** the modal includes explanatory text "Please choose a reason and share more if necessary."
- **AND** the modal displays the full question text in a bordered container with question mark icon
- **AND** the modal prevents interaction with background content (backdrop with blur effect)

#### Scenario: N/A button selected state in dashboard view

- **WHEN** a question is marked as N/A in dashboard view
- **THEN** the N/A button shows active state with ring styling
- **AND** the active state remains high‑contrast in light and dark themes
- **AND** the question row applies subtle opacity and grayscale effect
- **AND** the Yes and No buttons return to unselected state
- **AND** the N/A state persists until changed by the user
