# system-diagnostics Specification

## Purpose

This specification covers the authenticated member-facing `/system` page:
device-local health, schema and storage status, synchronization activity,
plain-language education, tiered recovery, and deliberate security exclusions.
The local-first and auditing specifications own the underlying engine and event
mechanics; this capability owns how members inspect and recover their device.

## Requirements

### Requirement: Member-Facing System Diagnostics

The application SHALL expose `/system` to authenticated members as a device-local diagnostics surface for database, schema, storage, synchronization, and recovery state.
**ID:** REQ-001

#### Scenario: Authenticated member opens system diagnostics

- **WHEN** an authenticated member navigates to `/system`
- **THEN** the page renders regardless of whether the member is an admin
- **AND** no admin-only data appears
- **ID:** AC-001

#### Scenario: Bootstrap failure remains recoverable

- **WHEN** local database bootstrap has failed
- **THEN** the page renders an error alert with retry and local-database recreation actions
- **AND** the alert states that server-held data remains safe
- **ID:** AC-002

### Requirement: Diagnostic Status Summary

The System page SHALL summarize Database, Schema, Storage, and Sync state in responsive status tiles backed by local operational evidence.
**ID:** REQ-002

#### Scenario: Healthy status is scannable

- **WHEN** all local subsystems are healthy
- **THEN** each tile renders a plain-language headline
- **AND** implementation details remain behind optional educational disclosure
- **ID:** AC-003

#### Scenario: Failure state identifies the affected subsystem

- **WHEN** a database, migration, storage, or sync failure is recorded
- **THEN** the corresponding tile renders a non-healthy state and actionable supporting detail
- **AND** unrelated healthy tiles remain independently readable
- **ID:** AC-004

#### Scenario: Refresh recomputes tile state

- **WHEN** the member activates Refresh
- **THEN** the page re-reads local events, migration state, storage measurement, and outbox depth
- **ID:** AC-005

### Requirement: Recent System Activity

The System page SHALL show a bounded list of recent `peaky.system` events and link to the complete Events view.
**ID:** REQ-003

#### Scenario: Activity list is system-scoped

- **WHEN** recent system activity renders
- **THEN** only events with source `peaky.system` are included
- **AND** no more than ten rows are shown in descending event-time order
- **ID:** AC-006

#### Scenario: Full history remains discoverable

- **WHEN** the activity list renders
- **THEN** it links to `/events?source=peaky.system`
- **ID:** AC-007

### Requirement: Tiered Local Recovery

The System page SHALL provide Clear cache as the lighter recovery action and Recreate local DB as the heavier recovery action, with explicit scope and confirmation.
**ID:** REQ-004

#### Scenario: Clear cache preserves durable local identity and data

- **WHEN** a member confirms Clear cache
- **THEN** service-worker registrations, Cache Storage entries, ephemeral session storage, and matching PWA cache keys are cleared
- **AND** authentication identity, Peaky UI preferences, IndexedDB, and OPFS data are preserved
- **AND** the application reloads with cache-busting enabled
- **ID:** AC-008

#### Scenario: Database recreation discloses unsynced work

- **WHEN** a member requests Recreate local DB
- **THEN** the confirmation displays the current unsynced outbox count
- **AND** offers Sync now and Recreate anyway actions
- **AND** states that server-held data is safe and will be downloaded again
- **ID:** AC-009

#### Scenario: Database recreation uses pre-initialization reset

- **WHEN** a member confirms Recreate anyway
- **THEN** the application sets the existing local reset flag and reloads
- **AND** database files are removed before the local database worker starts
- **AND** the successful recreation emits `LocalDbRecreated.v1` with a user trigger
- **ID:** AC-010

### Requirement: Plain-Language Diagnostic Education

The System page SHALL explain technical subsystem terms progressively without using unfamiliar implementation acronyms as primary status language.
**ID:** REQ-005

#### Scenario: Technical explanations are optional

- **WHEN** a status tile renders
- **THEN** its primary status uses member-facing language
- **AND** technical context is available from a disclosure that is closed by default
- **ID:** AC-011

#### Scenario: Risk increases down the page

- **WHEN** the page renders
- **THEN** read-only status and activity precede local-impact recovery actions
- **ID:** AC-012

### Requirement: Diagnostic Security Exclusions

The System page MUST NOT expose raw database export, arbitrary SQL execution, manual sync-cursor reset, or independent forced bootstrap controls.
**ID:** REQ-006

#### Scenario: Local contents cannot be exported from the page

- **WHEN** the System page renders
- **THEN** no control exports local database contents to a file or clipboard
- **ID:** AC-013

#### Scenario: Arbitrary maintenance controls remain unavailable

- **WHEN** the System page renders
- **THEN** no control accepts arbitrary SQL
- **AND** no control resets sync cursors or forces bootstrap outside the database-recreation flow
- **ID:** AC-014
