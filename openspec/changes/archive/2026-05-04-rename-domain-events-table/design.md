## Context

`domain_events` was a fine name when the table only stored audit events for domain mutations. It is no longer accurate: the catalog already has one system event (`ClientSchemaMigrated.v1`) sourced as `peaky.system`, and the sibling change `complete-events-experience` will add eleven more. The schema-file comment on `event.ts` explicitly notes the scope is broader than the name suggests.

The rename is purely mechanical. It is split out from `complete-events-experience` so it can ship from a parallel worktree without entangling the larger functional work. SQLite supports `ALTER TABLE ... RENAME TO` natively, so the data migration is cheap. The cost is the codebase rename pass and any doc references.

## Goals / Non-Goals

**Goals:**

- Rename `domain_events` → `events` in the SQLite schema, Drizzle definitions, code, tests, and documentation.
- Land the change without behaviour changes — no API impact, no UI impact.
- Ship in parallel with `complete-events-experience` from an independent worktree.

**Non-Goals:**

- Adding CloudEvents columns or the `local` flag (those belong to `complete-events-experience`).
- Renaming the Drizzle export in a way that breaks consumers of the type alias — keep the existing `DomainEvent` TypeScript discriminated union name in `app/services/events/DomainEvent.ts` (it's a logical type, not the table name).
- Touching `local_outbox` or any other table.

## Decisions

### D1. New migration, not edit-in-place

Even pre-production, edit-in-place was rejected in `complete-events-experience` for the same philosophical reason: schema evolution should be honest. This rename adds a new migration row to `_migrations` and a new entry to `_migration_log`. Other developers, e2e fixtures, and worktree branches with older databases get the rename automatically on next startup.

### D2. Migration shape

```sql
-- 0NNN_rename_domain_events_to_events.sql

ALTER TABLE domain_events RENAME TO events;

-- SQLite carries indexes with the table on rename, but their names retain the
-- original prefix. Drop and recreate to keep names consistent.
DROP INDEX IF EXISTS domain_events_review_idx;
DROP INDEX IF EXISTS domain_events_time_idx;
DROP INDEX IF EXISTS domain_events_status_idx;
DROP INDEX IF EXISTS domain_events_entity_time_idx;

CREATE INDEX events_review_idx ON events(review_id);
CREATE INDEX events_time_idx ON events(time);
CREATE INDEX events_status_idx ON events(status);
CREATE INDEX events_entity_time_idx ON events(entity_type, time);
```

### D3. Drizzle and code rename

```text
shared/db/schema/event.ts
  export const domainEvents  →  export const events
  sqliteTable("domain_events", …)  →  sqliteTable("events", …)
  index names updated to match SQL above

importers
  import { domainEvents } from "…"  →  import { events } from "…"
  db.select().from(domainEvents)  →  db.select().from(events)

app/services/events/DomainEvent.ts
  unchanged — DomainEvent is a TypeScript type name, not the table name.
```

`tests/unit/services/events/`, `tests/integration/`, and any `app/admin/*Events*` files participate in the import rename pass.

### D4. Coordination with `complete-events-experience`

Both changes touch `shared/db/schema/event.ts` and add a migration. Whichever lands first wins; whichever lands second rebases its migration ID up by one and imports the new field set / table name. There is no semantic merge conflict because the changes edit disjoint axes (this one renames the table, the other adds columns and a status enum value).

Recommended ordering: this change ships first because it is smaller and well-contained. `complete-events-experience` then targets `events` natively. If scheduling forces the reverse order, the rename simply targets the post-`complete-events-experience` schema; the migration list grows by one extra step.

## Testing strategy

```text
LAYER                   TEST                                            RUN
─────                   ────                                            ───
Integration (Vitest)    migration applies cleanly to a populated DB     pnpm test:integration
                        existing rows survive the rename
                        indexes exist post-rename with new names
                        no dangling references to domain_events

Type-check / lint       pnpm typecheck / pnpm lint must pass            pnpm validate
                        no remaining import of domainEvents

Existing test suite     entire repo test suite passes unchanged         pnpm test:run
                        (this is a no-op behaviour change)              pnpm test:e2e
```

The test for "no dangling references" can be a simple grep CI step: `! grep -rn "domain_events\|domainEvents" app/ shared/ server/ tests/ site/docs/`.

## Security Considerations

None. The change does not introduce, modify, or remove any data, API, or storage surface. It is a rename.

## Risks / Trade-offs

```text
RISK                                         MITIGATION
────                                         ──────────
Concurrent change touching the same          Coordinate scheduling with the
schema file from `complete-events-           other worktree owner; this work
experience`                                  is small enough to land in a
                                             single afternoon
A reference to `domain_events` slips         CI grep step + typecheck both
through unchanged                            catch missed references
A consumer hardcodes the table name          Search for the literal string
in raw SQL                                   "domain_events" — `app/local-db/
                                             migrations.ts` uses raw SQL in
                                             places, audit those
```

## Migration Plan

Forward-only. On every client's next startup the rename migration applies. No backfill, no data transformation. Rollback (pre-production) is to add a follow-up migration that renames back; we don't expect to need it.

## Open Questions

- **Should the Drizzle export name (`domainEvents`) also rename to `events` in TypeScript?** Recommend yes, for consistency with the table name. Costs a wider find-and-replace but keeps mental model aligned. This proposal assumes yes.
