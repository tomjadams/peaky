## ADDED Requirements

### Requirement: Audit Events Table Naming

The persisted SQLite table that stores typed audit and system events SHALL be named `events`, reflecting its actual scope (domain events, lifecycle events, system events).

#### Scenario: Schema migration renames domain_events to events

- **WHEN** the rename migration applies on a client database
- **THEN** the table previously named `domain_events` is renamed to `events`
- **AND** all rows are preserved
- **AND** indexes are renamed from the `domain_events_*` prefix to the `events_*` prefix

#### Scenario: Drizzle schema exports the table as `events`

- **WHEN** application code imports the audit table via Drizzle
- **THEN** the export name is `events` (not `domainEvents`)
- **AND** the underlying SQL table name is `events`
- **AND** no production code path references the legacy `domain_events` name

#### Scenario: Documentation reflects the renamed table

- **WHEN** a reader consults `site/docs/development/walkthroughs/codebase/events.md` or `walkthroughs/local-first/auditing.md`
- **THEN** every reference to the table uses the name `events`
- **AND** the historical name `domain_events` is mentioned only inside an explicit "renamed in change `rename-domain-events-table`" note, if at all
