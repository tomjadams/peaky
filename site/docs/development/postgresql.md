# PostgreSQL Conventions

This document describes the PostgreSQL schema design, query, and migration patterns used in the Peaky backend. `services/schema.sql` is the desired-state authority for PostgreSQL; Goose migrations produce that state and sqlc generates Go query code against it.

## Why This Matters

The sync engine stores every field-level HLC conflict resolution in `field_versions`, every audit event in `events`, and every entitlement check hits `subjects` + `reviews`. A missing index causes p99 spikes. A wrong constraint silently accepts bad data that propagates to every connected client via the sync protocol. Schema correctness is not optional.

## Schema Pipeline

```text
services/schema.sql                    ← PostgreSQL desired end state
  │
  ├── goose migrations                 ← how PostgreSQL gets there
  │     services/internal/dbmigrate/migrations/
  │
  └── sqlc                             ← type-safe Go query code
        services/internal/syncengine/repo/queries.sql → services/internal/syncengine/db/

shared/db/schema/*.ts                  ← independent runtime SQLite authority
shared/db/migrations/sqlite/*.sql      ← explicit SQLite upgrade path
```

PostgreSQL DDL does not generate the runtime SQLite schema. Shared persistence contracts are checked with behavior tests across both active schema paths. `scripts/generate-drizzle-from-sql.ts` and `shared/db/schema/generated/` are unused legacy tooling pending removal; they are non-authoritative and must not be run, regenerated, imported, or extended.

**Workflow for PostgreSQL schema changes:**

1. Edit `schema.sql` with the desired end state.
2. `make migrate:new NAME=add_foo_column` — scaffold a numbered goose migration.
3. Write the Up/Down SQL in the new migration file.
4. Edit `queries.sql` if any queried columns changed.
5. `make gen:sqlc` — regenerate Go query code (fails if queries reference non-existent columns).
6. `make test:go` — run Go tests.

**Drift detection:** CI runs the same persistence and constraint behavior matrix against a fresh `schema.sql` database and one built by all Goose migrations. It verifies contract parity without requiring exact catalog or source-text equality.

## Template and Revision contract

`templates` stores the stable aggregate: identity, current catalog metadata, `active | archived` lifecycle, owning Team, and creator/updater provenance. `template_revisions` stores complete authored snapshots with `draft | published | retired` status. Pillars reference `template_revision_id`, and Questions belong to those Revision-specific Pillars.

Database constraints enforce the publication shape:

- draft Revisions have null `revision_number`, `published_at`, and `published_by_actor_id`
- published and retired Revisions have a positive number and complete publisher/time provenance
- partial unique indexes allow at most one draft and one current published Revision per Template
- `(template_id, revision_number)` is unique when a number exists
- `revision_summary` is null or 1–120 non-whitespace characters

`review_template_selections` stores exact Revision IDs with composite identity `(review_id, template_revision_id)`, unique positions from 0 through 2, and a restrictive Revision foreign key. Existing Reviews therefore remain pinned to a retired Revision rather than following current Template state.

The schema can represent publication and Template lifecycle transitions, but those writes are currently frozen. Template create, update, publish, archive, restore, and delete endpoints return HTTP 503 with code `template_write_unavailable` before writing. Draft authoring remains browser-local and does not create PostgreSQL sync entities, events, or outbox traffic.

## Data Types

| Use | Avoid | Why |
|-----|-------|-----|
| `TEXT` | `VARCHAR(N)` | TEXT is equally fast in PostgreSQL; VARCHAR adds a pointless length check |
| `TIMESTAMPTZ` | `TIMESTAMP` | Always store with timezone; avoids silent timezone bugs |
| `JSONB` | `JSON` | JSONB is binary, indexable with GIN, and supports containment operators |
| `INTEGER` / `BIGINT` | `SERIAL` | Use explicit types; SERIAL is legacy sugar |
| CHECK constraints | ENUM types | CHECK is modifiable with `ALTER TABLE`; ENUM requires migration gymnastics |
| `TEXT` for IDs | `BIGINT GENERATED` | Our IDs are UUIDv7 strings from the client; TEXT matches the sync protocol |

**Our schema uses TEXT primary keys** because entity IDs originate on the client as UUIDv7 strings and arrive via the sync protocol. This is a deliberate design choice — do not "optimize" to BIGINT.

## Naming Conventions

We follow these consistently across `schema.sql`:

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | `snake_case`, singular or compound noun | `field_versions`, `review_answer_state` |
| Columns | `snake_case` | `entity_type`, `created_at`, `actor_id` |
| Primary keys | `id` (TEXT, client-generated) | `id TEXT NOT NULL PRIMARY KEY` |
| Foreign keys | `{referenced_table_singular}_id` | `subject_id`, `review_id`, `template_id` |
| Indexes | `{table}_{column(s)}_idx` | `events_time_idx`, `field_versions_entity_idx` |
| Unique constraints | `{table}_{column(s)}_unique` | `field_versions_entity_field_unique` |
| Foreign key constraints | `fk_{abbreviated_table}_{referenced}` | `fk_ras_review`, `fk_reviews_subject` |
| CHECK constraints | `{table}_{column}_check` | (not yet used; prefer for future enums) |

## Column Defaults and Constraints

```sql
-- ✅ Good — NOT NULL on everything that must exist.
name       TEXT        NOT NULL,
status     TEXT        NOT NULL DEFAULT 'draft',
created_at TIMESTAMPTZ NOT NULL,
updated_at TIMESTAMPTZ NOT NULL,

-- ✅ Good — nullable only when NULL has semantic meaning.
review_id  TEXT,       -- nullable: events survive review deletion
hlc        TEXT,       -- nullable: not all events have HLC
value      JSONB,      -- nullable: NULL means "field explicitly cleared"

-- ❌ Avoid — nullable columns that should have a default.
status TEXT,           -- what does NULL status mean? Use NOT NULL DEFAULT.
```

**Rule:** Every new column must be `NOT NULL` unless NULL has an explicit semantic meaning documented in a comment.

## Indexing

### Always index foreign key columns

PostgreSQL does **not** auto-create indexes on foreign key columns. Missing FK indexes cause sequential scans on DELETE CASCADE and JOIN queries.

```sql
-- ✅ Good — FK column is indexed.
CONSTRAINT fk_reviews_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
-- ...
CREATE INDEX reviews_subject_idx ON reviews (subject_id);

-- ❌ Avoid — FK without index (slow cascading deletes, slow joins).
CONSTRAINT fk_reviews_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
-- no index on subject_id
```

### Composite indexes: equality columns first, then range

```sql
-- ✅ Good — status (equality) before time (range).
CREATE INDEX events_entity_time_idx ON events (entity_type, time);

-- For: WHERE entity_type = 'review_answer' AND time > '2026-01-01'
```

A composite index on `(a, b)` supports queries on `a + b` and `a` alone, but NOT `b` alone.

### Index types we use

| Type | When | Example in our schema |
|------|------|-----------------------|
| B-tree (default) | Equality, range, sorting | All current indexes |
| GIN | JSONB containment queries | Future: `template_questions.checklist_items` if queried |
| BRIN | Append-only time-series with physical correlation | Future: `events.time` if table grows past 100GB |

### Avoid over-indexing

Each index slows writes and uses storage. Only add indexes for columns that appear in WHERE, JOIN, or ORDER BY clauses of actual queries. Verify with `EXPLAIN ANALYZE`.

## Query Patterns

### sqlc for static queries

All queries that can be expressed with fixed parameter counts go in `services/internal/syncengine/repo/queries.sql` and are compiled by sqlc:

```sql
-- name: GetFieldVersion :one
SELECT entity_type, entity_id, field_name, value, hlc, actor_id
FROM field_versions
WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3
LIMIT 1;
```

sqlc validates queries against `schema.sql` at codegen time — a query referencing a non-existent column fails `make gen:sqlc`.

### Hand-written SQL for dynamic queries

Two patterns require hand-written SQL because sqlc cannot express them:

1. **Variable-length IN clause:** `WHERE entity_id IN ($1, $2, ... $N)`
2. **Tuple IN clause:** `WHERE (entity_type, entity_id) IN (($1,$2), ($3,$4), ...)`

Hand-written queries live in `postgres.go`, NOT in `queries.sql`.

```go
// ✅ Good — positional parameters only, explicit column list.
placeholders[i] = fmt.Sprintf("$%d", i+2)
q := fmt.Sprintf(`
    SELECT id, entity_type, entity_id, actor_id, time
    FROM events
    WHERE time > $1 AND entity_id IN (%s)
    ORDER BY time ASC
    LIMIT $%d`, strings.Join(placeholders, ","), len(entitledIDs)+2)

// ❌ Avoid — string interpolation of user input.
q := fmt.Sprintf("SELECT * FROM events WHERE id = '%s'", userInput)
```

### Always LIMIT unbounded queries

Every query that returns multiple rows must have a LIMIT. No exceptions.

```sql
-- ✅ Good — paginated with limit+1 pattern.
SELECT id, entity_type, entity_id, actor_id, time
FROM events
WHERE time > $1
ORDER BY time ASC
LIMIT $2;

-- ❌ Avoid — unbounded result set.
SELECT * FROM events WHERE time > $1 ORDER BY time;
```

### Explicit column lists, never SELECT *

```sql
-- ✅ Good — schema changes don't silently break the query.
SELECT id, entity_type, entity_id, actor_id, time FROM events WHERE ...

-- ❌ Avoid — adding a column silently changes the result set.
SELECT * FROM events WHERE ...
```

### ON CONFLICT for idempotent writes

All sync writes must be idempotent — cursor resets cause re-pushes of the same events.

```sql
-- ✅ Good — duplicate push of same event is a no-op.
INSERT INTO events (id, ...) VALUES ($1, ...)
ON CONFLICT (id) DO NOTHING;

-- ✅ Good — field version upsert replaces on conflict.
INSERT INTO field_versions (id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET
    value      = EXCLUDED.value,
    hlc        = EXCLUDED.hlc,
    actor_id   = EXCLUDED.actor_id,
    updated_at = EXCLUDED.updated_at;
```

### Cursor-based pagination, not OFFSET

OFFSET scans and discards rows — O(offset) cost. Our sync protocol uses time-based cursors.

```sql
-- ✅ Good — cursor-based (uses time index).
WHERE time > $1 ORDER BY time ASC LIMIT $2

-- ❌ Avoid — OFFSET degrades as the dataset grows.
ORDER BY time ASC LIMIT 20 OFFSET 10000
```

### Use epoch as lower bound, not empty string

PostgreSQL rejects an empty string as a TIMESTAMPTZ literal.

```go
// ✅ Good — explicit epoch when no cursor is provided.
const zeroTime = "1970-01-01T00:00:00Z"
if after == "" {
    after = zeroTime
}
```

## Migrations

### Goose conventions

- Migrations are numbered sequentially: `001_initial.sql`, `002_add_foo.sql`.
- Every migration has both `-- +goose Up` and `-- +goose Down` sections.
- Migrations are embedded at compile time via `//go:embed migrations/*.sql`.
- `peaky-ctl migrate` runs pending migrations as an init container before `peaky-api` starts.

### Migration safety

```sql
-- ✅ Good — additive migration (safe, no downtime).
-- +goose Up
ALTER TABLE reviews ADD COLUMN archived_at TIMESTAMPTZ;

-- ✅ Good — new table (safe).
-- +goose Up
CREATE TABLE review_labels (...);

-- ⚠ Caution — adding NOT NULL column requires DEFAULT or backfill.
-- +goose Up
ALTER TABLE reviews ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';

-- ❌ Avoid — DROP COLUMN in a migration without Phase 1 "stop reading" migration.
-- +goose Up
ALTER TABLE reviews DROP COLUMN legacy_field;
```

**Safe migration order for column removal:**

1. Migration 1: Stop reading the column (update queries.sql, regenerate sqlc).
2. Deploy and verify no code reads the column.
3. Migration 2: Drop the column.

### Destructive Preview reset in Goose 008

`services/internal/dbmigrate/migrations/008_template_revisions.sql` is an intentional destructive Preview migration. It removes legacy Template and dependent Review rows, projections, import/evidence records, and matching event and field-history rows before creating the stable Template/Revision schema. It does not reinterpret old `template_versions` or Review selections.

The deletion manifest remains scoped: unrelated Product and Team rows, catalog data, cursors, and unrelated events or field history survive. Upgrade tests cover both reset completeness and unrelated-data preservation. The matching runtime SQLite reset is migration `0016_template_revisions`; it additionally removes affected local outbox, pending-review queue, and entitlement state. Unpublished browser drafts have no PostgreSQL copy, so operators must warn users to export them before this Preview upgrade.

### Seed data is not a migration

Seed data uses a separate mechanism (`peaky-ctl seed`) with idempotent SQL files under `internal/dbmigrate/seed/`. Every statement uses `ON CONFLICT DO NOTHING`.

## LISTEN/NOTIFY

The sync engine uses PG LISTEN/NOTIFY for SSE fan-out:

```sql
-- Triggered by push handler after accepting field writes.
SELECT pg_notify($1, $2);
-- $1 = channel: "sync:team:payments-scalability"
-- $2 = payload: {"cursor":"...","subjectType":"team","subjectId":"payments-scalability"}
```

**Rules:**

- Payload is a cursor pointer only — no domain data crosses the NOTIFY channel.
- `peaky-sse` holds one dedicated PG connection for LISTEN (separate from the query pool).
- Channel names: `sync:{subjectType}:{subjectId}`.

## Performance Considerations

### Connection pooling

Services use `database/sql` with tuned pool settings (see `golang.md`). MaxOpenConns=2 for small ECS tasks.

### VACUUM and maintenance

- `events` is append-only (inserts + ON CONFLICT DO NOTHING). Dead tuple accumulation is minimal.
- `field_versions` has UPDATE-heavy patterns (ON CONFLICT DO UPDATE). Monitor `n_dead_tup` if write volume increases.
- `sync_cursors` is UPDATE-heavy but tiny (one row per actor). No concern.

### Future: partitioning

When `events` grows past ~50GB or ~10M rows, partition by `RANGE (time)` with monthly boundaries. The partition key (`time`) is already in the primary query path. Plan this before it's needed — retrofitting partitioning requires a migration.

## Anti-Patterns

```sql
-- ❌ TIMESTAMP without timezone.
created_at TIMESTAMP NOT NULL  -- loses timezone info silently

-- ❌ ENUM types (hard to modify).
CREATE TYPE status_enum AS ENUM ('draft', 'active');
-- Use CHECK constraint instead:
status TEXT NOT NULL CHECK (status IN ('draft', 'active'))

-- ❌ Circular foreign keys.
-- Table A references B, B references A → deadlock on DELETE CASCADE.

-- ❌ Missing ON DELETE behavior.
CONSTRAINT fk_foo FOREIGN KEY (bar_id) REFERENCES bar (id)
-- Always specify: ON DELETE CASCADE, SET NULL, or RESTRICT.

-- ❌ Storing computed values that can be derived.
-- Store source data; compute in queries or application layer.

-- ❌ JSON (not JSONB) — not indexable, not binary, slower.
data JSON  -- use JSONB instead
```

## Checklist for Schema Changes

Before submitting a schema change:

- [ ] `schema.sql` reflects the desired end state
- [ ] Goose migration exists with Up and Down sections
- [ ] `queries.sql` updated if any queried columns changed
- [ ] `make gen:sqlc` passes
- [ ] Matching runtime SQLite changes are made independently in the hand-written schema and explicit migrations when the shared contract changes
- [ ] Cross-database persistence behavior tests pass; legacy PostgreSQL-to-Drizzle generation was not used
- [ ] Destructive migrations prove both their deletion manifest and unrelated-data preservation, with user warnings for local-only loss
- [ ] All FK columns have indexes
- [ ] All new columns are `NOT NULL` unless NULL has documented semantic meaning
- [ ] All new tables have `created_at TIMESTAMPTZ NOT NULL`
- [ ] Naming follows conventions (snake_case, `_idx`, `_unique`, `fk_` prefixes)
- [ ] `make test:go` passes

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/17/)
- [PlanetScale Database Skills — PostgreSQL](https://github.com/planetscale/database-skills/tree/main/skills/postgres)
- [sqlc Documentation](https://docs.sqlc.dev/)
- [Goose Migration Tool](https://github.com/pressly/goose)
