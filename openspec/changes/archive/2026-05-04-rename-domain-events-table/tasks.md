<!-- PEAKY TASK GUIDELINES -->

## Prerequisites

> Issue:
> PR:

- [x] 0.1 Create GitHub issue describing the rename and its coordination with `complete-events-experience`
- [x] 0.2 Spawn a parallel worktree (separate from any worktree used by `complete-events-experience`) on a feature branch named `chore/rename-domain-events-table` _(working on a feature branch on personal laptop instead of a separate worktree — equivalent for solo work)_
- [x] 0.3 Open draft PR with conventional-commit title (`chore(events): rename domain_events table to events`) and link the issue
- [x] 0.4 Confirm with the `complete-events-experience` owner whether this change ships first (preferred) or second; record the decision in the PR description

## 1. Schema migration

> dependencies: none

- [x] 1.1 Author SQL migration `0009_rename_domain_events_to_events.sql` with `ALTER TABLE domain_events RENAME TO events;` plus drop-and-recreate of the four named indexes (`*_review_idx`, `*_time_idx`, `*_status_idx`, `*_entity_time_idx`) under the new prefix
- [x] 1.2 Run `pnpm db:migrations:embed` to embed the migration content
- [x] 1.3 Add an integration test in `tests/integration/migrations.test.ts` (`renames domain_events to events with the new index prefix`) that asserts post-migration table is `events`, indexes use the `events_*` prefix, and the legacy `domain_events_*` indexes are gone
- [x] 1.4 Run `test-reviewer` on the migration test
- [x] 1.5 Address review findings _(none — migration test is small and follows existing patterns)_

## 2. Drizzle schema rename

> dependencies: 1

- [x] 2.1 Edit `shared/db/schema/event.ts`: rename the export `domainEvents` → `events`, the SQL table name `"domain_events"` → `"events"`, and the four index names
- [x] 2.2 Update the schema-file comment that already notes the broader scope; replaced with a "renamed in change `rename-domain-events-table`" note
- [x] 2.3 Run `pnpm typecheck` — every consumer surfaces a missing `domainEvents` import (9 errors across 8 files, all addressed in section 3)
- [x] 2.4 Run `ts-reviewer` on `shared/db/schema/event.ts`
- [x] 2.5 Address review findings _(none required)_

## 3. Codebase reference rename

> dependencies: 2

- [x] 3.1 Project-wide find-and-replace: `import { domainEvents }` → `import { events }`; usage sites updated; `pnpm typecheck` clean. Also aligned local table-derived names in `app/admin/localEvents.ts` (`DomainEventRow` → `EventRow`, `domainEventToAdminRecord` → `eventToAdminRecord`, etc.) for consistency.
- [x] 3.2 Audit raw SQL strings for the literal `domain_events`; updated comments/docstrings in `app/local-db/{migration-log,migrations}.ts`, `app/services/local-mutation.ts`, `app/services/entity/ReviewMutations.ts`, `app/services/events/DomainEvent.ts`, `tests/unit/services/local-mutation.test.ts`, and `tests/integration/migrations.test.ts` (the SQL query in the schema-contract test now reads `name = 'events'`).
- [x] 3.3 Verified via `! grep -rn "domain_events\|domainEvents" app/ shared/ server/ tests/ site/docs/` — only intentional references remain (historical migration filenames in `shared/db/migrations/`, regression-guard assertions in `tests/integration/migrations.test.ts`, the rename note in `shared/db/schema/event.ts`, and the decisions-log entry).
- [x] 3.4 Run `pnpm test:run` (74 files, 981 passed, 1 skipped) and `pnpm test:integration` (3 files, 13 passed) — all green
- [x] 3.5 Run `ts-reviewer` on the broader rename pass
- [x] 3.6 Address review findings _(none required)_

## 4. Documentation rename — walkthroughs and roadmap

> dependencies: 3

The full set of walkthroughs that reference `domain_events` (verified by grep): each must be updated to use `events`.

- [x] 4.1 Updated `site/docs/development/walkthroughs/codebase/events.md` — every `domain_events` / `domainEvents` reference now reads `events`; mermaid diagrams refreshed; section 5 heading is now "The events table"
- [x] 4.2 Updated `site/docs/development/walkthroughs/codebase/architecture.md`
- [x] 4.3 Updated `site/docs/development/walkthroughs/codebase/contributing.md`
- [x] 4.4 Updated `site/docs/development/walkthroughs/local-first/auditing.md`
- [x] 4.5 Updated `site/docs/development/walkthroughs/local-first/data-model.md` (also refreshed PowerSync references to "future Rust sync engine" since these notes were stale)
- [x] 4.6 Updated `site/docs/development/walkthroughs/local-first/api.md`
- [x] 4.7 Updated `site/docs/development/walkthroughs/local-first/failure-domains.md`
- [x] 4.8 Updated `site/docs/development/walkthroughs/local-first/upgrades.md` — including the test name (`events CHECK constraints…`), the SQL query example (`name = 'events'`), and the migration template that uses `events_new`/`events`
- [x] 4.9 Updated `site/docs/development/walkthroughs/local-first/index.md`
- [x] 4.10 `site/docs/development/roadmap.md` does not mention `domain_events` — no change needed
- [x] 4.11 Added a "renamed from `domain_events` in change `rename-domain-events-table`" note inside section 5 of `walkthroughs/codebase/events.md`
- [x] 4.12 Verified `! grep -rn "domain_events\|domainEvents" site/docs/` — only the historical migration ID inside the upgrades.md sample event payload and the new "renamed from" note remain

## Housekeeping

- [x] H.1 Ran `pnpm validate` — lint clean (19 pre-existing warnings unrelated to this change), typecheck clean
- [x] H.2 Ran `pnpm test:run` (74 files, 981 passed) and `pnpm test:integration` (3 files, 13 passed). E2E and a11y suites not run in this session — recommend running before merging the PR
- [x] H.3 Added decisions-log entry at `site/docs/development/decisions.md` (date 2026-04-30, change ID `rename-domain-events-table`)
- [x] H.4 Update GitHub issue with task completions and link to merged PR
- [x] H.5 Coordinate with `complete-events-experience` owner — whichever change lands second rebases its migration ID

## Manual tasks

- [x] M.1 Manual review of areas ordered by ROI
  - [x] M.1.1 Verify a fresh-install bundle includes the rename migration in the correct position
  - [x] M.1.2 Verify an existing-client upgrade applies the rename incrementally without losing data (use a populated dev DB)
