# PostgreSQL Review Context

## Scope

The server schema, Goose migrations, sqlc queries, dynamic SQL in Go
repositories, and `LISTEN/NOTIFY` used by synchronization.

## Project invariants

- `services/schema.sql` is the desired end-state schema. Goose migrations under
  `services/internal/dbmigrate/migrations/` describe upgrades, and sqlc derives
  query code from `services/internal/syncengine/repo/queries.sql`.
- Client-generated UUIDv7 identifiers remain `TEXT` primary keys. This is an
  intentional exception to generic numeric-key advice because IDs originate
  in the offline sync protocol.
- Sync writes are idempotent. Duplicate event IDs are ignored, while field
  versions upsert on `(entity_type, entity_id, field_name)`.
- Pulls are entitlement-scoped in SQL and cursor-paginated. The composite
  stream order is time plus event ID so equal timestamps cannot skip events.
- `LISTEN/NOTIFY` payloads contain only `cursor` and `family`; domain data
  crosses only authorized pull endpoints.

## Project conventions

- Use sqlc for fixed-shape queries. Dynamic variable-length and tuple `IN`
  clauses are hand-written in repository `postgres.go` files with generated
  positional placeholders.
- Every multi-row query is bounded. The sync path uses cursor pagination and
  the limit-plus-one pattern rather than `OFFSET` or `COUNT(*)`.
- New columns are non-null unless a comment documents the meaning of null.
  Foreign keys have explicit delete behavior and matching indexes.
- Schema types are `TEXT`, `TIMESTAMPTZ`, and `JSONB`; evolving enum-like
  values use `CHECK` constraints.
- Migrations have both Goose `Up` and `Down` sections. Removing a column is a
  two-deployment change: stop reads first, then drop later.
- `peaky-ctl migrate` runs pending embedded migrations before API startup.

## Deterministic coverage

Do not repeat sqlc validation of query columns, CI schema drift checks,
golangci-lint row lifecycle checks, or `gosec` SQL injection findings.

For schema changes, run `make gen:sqlc`, `make test:go`, and the PostgreSQL
integration gate when available.

## References

- `site/docs/development/postgresql.md`
- `services/schema.sql`
- `services/internal/syncengine/repo/queries.sql`
- `services/sqlc.yaml`
- `services/internal/dbmigrate/migrations/`
