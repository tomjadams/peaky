## MODIFIED Requirements

### Requirement: Pillar Navigation Sidebar

The Template Studio SHALL provide a space-efficient pillar navigation sidebar.

#### Scenario: Expanded sidebar display

- **WHEN** the pillar sidebar is expanded
- **THEN** each pillar shows its name and question count

#### Scenario: Collapsed sidebar display

- **WHEN** the pillar sidebar is collapsed
- **THEN** only pillar icons or abbreviated names are shown
- **AND** tooltips reveal full pillar names on hover
- **AND** clicking a pillar icon activates that pillar

#### Scenario: Pillar management

- **WHEN** managing pillars in the sidebar
- **THEN** pillars can be added with a name and slug
- **AND** pillars can be renamed inline
- **AND** pillars can be deleted (with confirmation if questions exist)
- **AND** pillar order affects question slug IDs

#### Scenario: Pillar delete button visibility

- **WHEN** a pillar tab is not hovered
- **THEN** the delete button SHALL be hidden with zero width and zero opacity
- **AND** the button SHALL not occupy layout space

#### Scenario: Pillar delete button reveal on hover

- **WHEN** a user hovers over a pillar tab
- **THEN** the delete button SHALL animate into view with a width and opacity transition
- **AND** the button SHALL be vertically centered within the pillar tab
- **AND** the transition SHALL be smooth (no layout jank)

#### Scenario: Pillar delete button interaction

- **WHEN** a user clicks the revealed delete button on a pillar with questions
- **THEN** a confirmation popover SHALL appear
- **AND** the delete button SHALL remain visible while the popover is open
