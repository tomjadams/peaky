## Why

The local SQLite table that stores typed audit and system records is named `domain_events`. The name was accurate when only domain mutations produced events, but the catalog now includes system events (`peaky.system` source: DB lifecycle, migration log, OPFS, sync ops) and will gain more in the sibling change `complete-events-experience`. The current name suggests these are exclusively domain events, which is misleading both to engineers reading the code and to support engineers triaging issues.

The Drizzle schema file (`shared/db/schema/event.ts`) already comments that this table covers the broader audit story; the table name lags. Renaming `domain_events` → `events` makes the contract honest, simplifies all references in code and docs, and gives the future Rust sync engine a clean target name.

This change is intentionally narrow and mechanical. It does not change behaviour. It is sized to ship from a parallel worktree without blocking or being blocked by `complete-events-experience`.

## What Changes

1. **New SQLite migration** that renames `domain_events` to `events` via `ALTER TABLE ... RENAME TO`. SQLite migrates indexes automatically when the table is renamed; rebuild named indexes only if their explicit name still references the old prefix.
2. **Drizzle schema rename** in `shared/db/schema/event.ts`: `domainEvents` export → `events`, `domain_events` table name → `events`, and dependent index names (`domain_events_review_idx` → `events_review_idx`, etc.).
3. **Codebase reference updates** across all importers of `domainEvents` (everything in `app/`, `tests/`, `server/`, and `shared/`). This is mechanical: a project-wide find-and-replace verified by `pnpm typecheck` and `pnpm test:run`.
4. **Documentation rename** in `site/docs/development/walkthroughs/codebase/events.md`, `walkthroughs/local-first/auditing.md`, and any roadmap references.
5. **No behaviour change.** No new columns, no enum changes, no API changes, no UI changes. The migration is forward-only; pre-production rollback is "drop the migration row from `_migrations` and write a follow-up migration."

**Deliberately out of scope:**

- Adding CloudEvents columns (`specversion`, `dataschema`, `client_id`) — that's `complete-events-experience`.
- The `local: true` marker on `EventCatalogEntry` — also `complete-events-experience`.
- The system event taxonomy — also `complete-events-experience`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `auditing`: the persisted table name changes from `domain_events` to `events`. No requirements change semantically; this is a naming refinement to match the existing scope.

## Impact

- **Database schema**: one new migration with `ALTER TABLE domain_events RENAME TO events` plus index renames.
- **Drizzle schema** (`shared/db/schema/event.ts`): `export const domainEvents` becomes `export const events`; index names updated.
- **Code references**: every file that imports `domainEvents` updates to `events`. Search surface includes `app/services/`, `app/admin/`, `app/composables/`, `app/local-db/`, `tests/`, `server/`, and any seed/fixtures.
- **Documentation**: `site/docs/development/walkthroughs/codebase/events.md`, `walkthroughs/local-first/auditing.md`, and any other doc that references the table name update.
- **Sibling change coordination**: this change and `complete-events-experience` both touch `shared/db/schema/event.ts` and add migrations. Whichever ships second rebases its migration ID and integrates the rename into its work. No semantic conflict — they edit different fields.
