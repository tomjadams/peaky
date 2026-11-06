# SQLite Review Context

## Scope

Browser SQLite migration SQL under `shared/db/migrations/sqlite/`, its
registry and embedded SQL, and SQLocal/OPFS runtime code in `app/local-db/`.

## Project invariants

- The database runs asynchronously in browser SQLocal/WASM over OPFS. Passing
  better-sqlite3 tests does not establish equivalent SQLocal DDL behavior.
- Existing clients upgrade incrementally; fresh clients apply the full
  migration bundle to an empty database.
- Incremental schema-changing migration SQL runs in a transaction, but its
  bookkeeping insert runs afterward as a separate autocommit
  `INSERT OR IGNORE`. Keeping the insert inside the DDL transaction can produce
  SQLocal `SQLITE_SCHEMA`, leaving changed DDL unrecorded and replaying on each
  startup.
- Fresh-install bundle tracking may remain in the single empty-database
  transaction. This is an intentional accepted limitation with lower risk than
  the incremental path; do not apply the incremental-path block mechanically.
- Failed migrations are recorded through `MigrationLog`; a rejected
  `migrationPromise` is reset so startup can retry.
- Migration attempts are recorded in `_migration_log`. Successful batches emit
  `ClientSchemaMigrated.v1`; failures emit a sanitized
  `LocalDbMigrationFailed.v1`.

## Project conventions

- A changed Drizzle enum or SQLite `CHECK` requires a table-rebuild migration:
  create an exact replacement table, copy with explicit value handling, drop
  the original, rename the replacement, then recreate all indexes and foreign
  keys.
- Rebuild guard statements intentionally fail on unexpected partial state:
  avoid `IF NOT EXISTS` on the temporary table and `IF EXISTS` on the original
  table.
- Register new SQL in `shared/db/migrations/index.ts`, regenerate
  `shared/db/migrations/sqlite-content.ts` with
  `pnpm db:migrations:embed`, and add migration integration coverage.
- `tests/integration/migrations.test.ts` is the deterministic guard for applied
  migration IDs and schema `CHECK` values.

## Deterministic coverage

SQL syntax and fresh-database behavior are covered by existing tests. Review
must still distinguish incremental SQLocal runtime behavior, especially DDL
plus bookkeeping and recovery after partial application.

Relevant gates are the migration integration tests, `pnpm lint`, and
`make typecheck`.

## References

- `app/local-db/migrations.ts`
- `app/local-db/migration-log.ts`
- `shared/db/migrations/index.ts`
- `shared/db/migrations/sqlite/`
- `tests/integration/migrations.test.ts`
- `AGENTS.md` (SQLite migrations and rollout observability)
