# Improvement Plans Specification

## ADDED Requirements

### Requirement: Practice-Level Handoff Projection

Follow-ups SHALL expose each unmet checklist item as one selectable practice and SHALL expose a negative Yes/No question as one standalone practice.
**ID:** REQ-005

#### Scenario: Checklist practices are independent

- **WHEN** one checklist question contains several unmet practices
- **THEN** each unmet practice SHALL have an independent handoff selection state
- **AND** selecting one practice SHALL NOT select or block its sibling practices
- **ID:** AC-015

#### Scenario: Yes or No question becomes one practice

- **WHEN** a Yes or No question is answered No
- **THEN** the handoff projection SHALL use the question ID as both question ID and practice ID
- **ID:** AC-016

#### Scenario: Practice identity is versioned

- **WHEN** the system identifies a handoff practice
- **THEN** it SHALL use review ID, opaque TemplateRevision ID (`templateRevisionId`), question ID, and practice ID
- **AND** it SHALL compare `templateRevisionId` values exactly without parsing their format
- **ID:** AC-017

#### Scenario: Practice row preserves actionable context

- **WHEN** an unmet practice is displayed for handoff
- **THEN** its row SHALL identify the pinned TemplateRevision, question and practice, current evidence state, and evidence provenance
- **AND** it SHALL provide a deep link to the source assessment question
- **AND** it SHALL display any current external reference for that practice
- **ID:** AC-018

#### Scenario: Evidence state is binary

- **WHEN** the projection reports a practice's evidence state
- **THEN** that state SHALL be exactly one of met or unmet, derived from the recorded answer
- **AND** practices whose recorded answer is N/A SHALL be excluded from the projection
- **AND** the system SHALL NOT expose or persist any third evidence state such as "needs validation"
- **ID:** AC-019

#### Scenario: Selection spans pinned templates

- **WHEN** a review contains unmet practices from several pinned TemplateRevisions
- **THEN** a user SHALL be able to select any combination of practices that have not belonged to a completed handoff
- **AND** practices already owned by the active handoff SHALL remain removable and reselectable within that handoff
- **AND** the resulting draft SHALL preserve every practice's TemplateRevision identity
- **ID:** AC-020

### Requirement: Handoff Draft and Local Lifecycle

The system SHALL synchronize ordered practice snapshots and SHALL keep handoff lifecycle history on the current device.
**ID:** REQ-006

#### Scenario: Draft preserves ordered context

- **WHEN** a user saves a handoff draft
- **THEN** the system SHALL persist the selected order, practice text, rationale, leading practices, helpful links, review ID, `templateRevisionId`, question ID, practice ID, evidence IDs, and source identifiers
- **AND** the device SHALL persist the practice's immutable local handoff owner without adding that field to the sync payload
- **ID:** AC-021

#### Scenario: Draft has no provider side effect

- **WHEN** a draft is created, edited, cancelled, or reordered
- **THEN** the system SHALL make no Jira, YouTrack, or ITSM network request
- **ID:** AC-022

#### Scenario: Active handoff editing is reversible

- **WHEN** a user reviews the active handoff
- **THEN** the user SHALL be able to remove practices and reorder them with pointer or keyboard controls
- **AND** a removed practice SHALL remain reselectable only within that same active handoff
- **AND** refreshing or leaving Follow-ups SHALL NOT delete its saved practice context
- **ID:** AC-023

#### Scenario: Keyboard reorder announces the new position

- **WHEN** a user moves a selected practice with keyboard controls
- **THEN** the reorder control SHALL expose the practice title, its current position, the total practice count, and the movement keys
- **AND** completing the move SHALL announce the moved practice's new position out of the total to assistive technology
- **AND** focus SHALL remain on the moved practice after the move
- **ID:** AC-024

#### Scenario: Draft has no separate title

- **WHEN** the system displays or persists a handoff draft
- **THEN** it SHALL identify the draft by its review and selected practices
- **AND** it SHALL NOT require or expose a separate editable handoff title
- **ID:** AC-025

#### Scenario: Active handoff has no naming task

- **WHEN** Follow-ups displays the active handoff
- **THEN** the heading SHALL be "Handoff" and SHALL NOT expose a separate editable title
- **AND** completed history MAY use its local sequence number to distinguish cycles
- **AND** no Peaky handoff label SHALL be included in any payload sent to a provider
- **ID:** AC-026

#### Scenario: Empty selection shows an explicit empty state

- **WHEN** a review has no practices selected for handoff
- **THEN** the handoff surface SHALL render an explicit empty state that names the action which adds practices
- **AND** it SHALL NOT render an empty draft list in place of that empty state
- **ID:** AC-027

#### Scenario: Handoff section lives in Follow-ups

- **WHEN** review Follow-ups renders
- **THEN** handoff selection, ordering, copy-text, and existing-ticket association SHALL compose as one section of that view
- **AND** no separate flat practice-selection list SHALL duplicate the Follow-up evidence rows
- **ID:** AC-046

#### Scenario: One local handoff is active

- **WHEN** the first eligible practice is selected after no handoff is active
- **THEN** the device SHALL create the next local handoff sequence for that Review
- **AND** the device SHALL keep at most one active handoff for the Review
- **AND** `Clear all` SHALL mark every selected practice removed in one atomic local action
- **AND** removing every practice SHALL hide completion while retaining the empty active cycle for later reselection
- **ID:** AC-047

#### Scenario: Assessment completion closes resolved work

- **WHEN** at least one practice is selected and every selected practice becomes met or N/A in the assessment
- **THEN** the device SHALL close the active handoff automatically
- **AND** it SHALL freeze the selected practice IDs, completion time, actor, unresolved count zero, and automatic mode
- **ID:** AC-048

#### Scenario: Manual closing records unresolved intent

- **WHEN** a user closes an active handoff with unresolved selected practices
- **THEN** the UI SHALL require a closing note
- **AND** it SHALL state that closing records the handoff without changing assessment answers or marking practices complete
- **AND** the device SHALL freeze the selected practice IDs, completion time, actor, note, unresolved count, and manual mode
- **ID:** AC-049

#### Scenario: Active practice ownership is exclusive

- **WHEN** a practice belongs to an active local handoff
- **THEN** it SHALL NOT belong to another active handoff at the same time
- **AND** manually closing SHALL release unresolved practices back to Available while preserving their closed-handoff history
- **AND** a Handoff status filter SHALL reveal previous handoffs with a hover and keyboard message stating that Assessment evidence is still needed
- **ID:** AC-050

#### Scenario: Local history preserves reporting inputs

- **WHEN** a local handoff closes
- **THEN** history SHALL retain its sequence, created and completed timestamps, completion mode, actors, note, selected practice IDs, unresolved count, and duration
- **AND** the UI SHALL state that completion history is saved on the current device
- **AND** the active workspace SHALL rely on row ownership markers and history rather than a persistent completion banner
- **AND** the latest manually closed handoff MAY be reopened when no newer handoff is active
- **ID:** AC-051

### Requirement: Existing External Ticket Association

The system SHALL let a user associate one existing provider ticket with every selected practice in a handoff without changing the external ticket.
**ID:** REQ-007

#### Scenario: Existing ticket is associated

- **WHEN** a user confirms a provider, external ticket ID, and URL for an ordered handoff
- **THEN** each selected practice SHALL reference the same external work item
- **AND** Peaky SHALL NOT edit the ticket
- **ID:** AC-028

#### Scenario: First release associates existing work only

- **WHEN** a user links an existing work item in the first release
- **THEN** the UI SHALL request one validated HTTPS URL
- **AND** it SHALL derive the provider and external ticket ID from Jira, GitLab, YouTrack, or the URL host and final path segment
- **AND** it SHALL show the detected provider and ID before confirmation
- **AND** it SHALL NOT offer provider ticket creation
- **ID:** AC-029

#### Scenario: One external work item covers the handoff

- **WHEN** several selected practices are associated
- **THEN** every selected practice SHALL reference the same external work item
- **AND** Peaky SHALL NOT model the handoff as an epic with child issues or as one provider ticket per practice
- **AND** Peaky SHALL NOT edit provider-owned title or content
- **ID:** AC-030

### Requirement: One Current Association Per Practice

The system SHALL keep at most one current external-work-item association for each practice reference.
**ID:** REQ-008

#### Scenario: Duplicate selection is blocked

- **WHEN** any selected practice already has a current association
- **THEN** handoff confirmation SHALL be rejected
- **AND** the UI SHALL identify every conflicting practice and its current external reference
- **ID:** AC-031

#### Scenario: Association is explicitly replaced

- **WHEN** a user replaces a practice's current external reference
- **THEN** the new reference SHALL become current
- **AND** the previous reference SHALL remain in immutable replacement history
- **AND** associations for other practices SHALL remain unchanged
- **ID:** AC-032

#### Scenario: Completed practice keeps reference

- **WHEN** an associated practice becomes complete in the assessment
- **THEN** its current external reference SHALL remain unchanged
- **AND** Peaky SHALL make no external ticket update
- **ID:** AC-033

### Requirement: Provider-Neutral Handoff Actions

The handoff UI SHALL always be available and SHALL offer copying an ordered, provider-neutral Markdown rendering of the draft as its primary action. Every future provider call SHALL require a separate server capability.
**ID:** REQ-009

#### Scenario: Copy Markdown is the primary handoff action

- **WHEN** a user reviews a handoff draft
- **THEN** the primary action SHALL copy the ordered draft as provider-neutral Markdown to the clipboard
- **AND** the Markdown SHALL be paste-ready for any tracker or message surface that accepts Markdown without assuming one provider
- **ID:** AC-034

#### Scenario: UI availability cannot authorize provider calls

- **WHEN** the handoff UI is available and the server integration capability is false
- **THEN** users MAY use synchronized drafts, copy-text, and existing-ticket association
- **AND** the server SHALL reject every provider network operation
- **ID:** AC-035

#### Scenario: Enabled experience remains provider-neutral

- **WHEN** a user acts on a handoff draft
- **THEN** selection, draft, copy, and association labels SHALL use provider-neutral work-item terminology
- **AND** no Jira-specific epic, child-work, or creation-preview semantics SHALL appear
- **AND** a future provider integration SHALL appear as one option in the handoff action group and MAY become the default action only when that provider is available
- **ID:** AC-036

### Requirement: Handoff Markdown Rendering

The system SHALL render an ordered handoff draft as structured Markdown for user-directed copy.
**ID:** REQ-012

#### Scenario: Copied Markdown preserves ordered context

- **WHEN** a user copies a handoff draft
- **THEN** the Markdown SHALL lead with a review-derived heading and optional review link
- **AND** it SHALL include an ordered summary table and detailed sections for every selected practice
- **AND** each detail SHALL include its source TemplateRevision and question context, evidence state, optional rationale, helpful links, and assessment deep link
- **AND** user-authored content SHALL be escaped so it cannot change the Markdown structure
- **ID:** AC-044

#### Scenario: Copy interaction reports outcome

- **WHEN** a user invokes the copy action
- **THEN** the system SHALL write Markdown text to the clipboard from a user gesture
- **AND** it SHALL confirm success or surface a copy-failure state without altering the draft
- **ID:** AC-045

### Requirement: External Lifecycle Ownership Boundary

Peaky SHALL NOT own external ticket content, assignment, priority, sequencing after handoff, or provider lifecycle.
**ID:** REQ-010

#### Scenario: Practice completion has no outbound behavior

- **WHEN** a linked practice changes completion state
- **THEN** Peaky SHALL update only assessment-derived state
- **AND** no outbound provider message SHALL be sent
- **ID:** AC-037

#### Scenario: Future outbound update remains separate

- **WHEN** a future integration consumes a practice-completion event
- **THEN** it MUST require an explicit product policy, server capability, idempotency key, and audit record
- **AND** a failed provider update SHALL NOT roll back assessment completion
- **ID:** AC-038

### Requirement: Versioned Handoff Limits

The system SHALL enforce one centrally versioned handoff-limits contract at every TypeScript and Go validation boundary. Invalid values SHALL be rejected without truncation or partial persistence.
**ID:** REQ-011

#### Scenario: Text and identifier limits are enforced

- **WHEN** a handoff mutation contains rationale longer than 2,000 characters, an external or evidence identifier longer than 128 characters, or an HTTPS URL longer than 2,048 characters
- **THEN** the complete mutation SHALL be rejected with field-addressable limit errors
- **AND** no value SHALL be silently truncated
- **ID:** AC-039

#### Scenario: Limits count characters, not encoded bytes

- **WHEN** a handoff mutation contains a rationale of exactly 2,000 characters composed of multi-byte characters
- **THEN** the mutation SHALL be accepted
- **AND** every text and URL limit SHALL be evaluated in characters rather than encoded bytes
- **ID:** AC-040

#### Scenario: Per-practice collection limits are enforced

- **WHEN** a practice snapshot contains more than 10 helpful links or more than 20 evidence identifiers
- **THEN** the complete mutation SHALL be rejected
- **AND** no collection member SHALL be silently dropped
- **ID:** AC-041

#### Scenario: Handoff practice count is bounded

- **WHEN** a handoff draft would contain more than 50 practices
- **THEN** the complete mutation SHALL be rejected
- **AND** the UI SHALL prevent confirmation while identifying the 50-practice maximum
- **ID:** AC-042

#### Scenario: Runtime contracts do not drift

- **WHEN** the versioned handoff-limits contract changes
- **THEN** shared boundary tests SHALL prove TypeScript and Go enforce identical character, count, and URL limits
- **ID:** AC-043
