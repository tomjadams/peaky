# Go Test Review Context

## Scope

Review Go tests under `services/`, with special attention to the sync engine,
HLC conflict resolution, authorization, SSE fan-out, and PostgreSQL persistence.
Unit and in-memory integration tests run with `make test:go`. PostgreSQL tests
use the `integration` build tag and run with `make test:go:integration` or the
repo-focused `make test:go:pg`.

## Project invariants and risk matrices

The following matrices are mandatory when the corresponding production surface
changes. They are project correctness invariants, not illustrative examples.

### Conflict resolution and HLC

| Mandatory scenario | Required outcome |
| --- | --- |
| Newer wallclock | Incoming field wins |
| Older wallclock | Incoming field is rejected |
| Same wallclock, higher counter | Incoming field wins |
| Same wallclock and counter | Actor ID breaks the tie deterministically |
| No stored version | Incoming field wins |
| Malformed HLC | Soft rejection, no panic |
| Non-overlapping fields | Fields are accepted independently |
| Mixed fields in one event | Accepted and rejected fields can coexist |
| Zero-padded counters | Lexicographic ordering remains correct |

### Authorization

| Mandatory scenario | Required outcome |
| --- | --- |
| Authorized actor | Operation succeeds |
| Unauthorized actor | Operation is rejected |
| Wildcard entitlement | Grants access only for its family |
| View-only actor | Cannot edit |
| Unknown actor | Uses the development fallback |
| Review-scoped child entity | Resolves authorization through its parent review |
| Template-scoped entity | Resolves authorization through its template |

Actor identity must come from middleware, never the pushed event payload.
Entitlement filtering must be verified at the persistence query boundary, not
only through post-filtering in Go.

### SSE fan-out

| Mandatory scenario | Required outcome |
| --- | --- |
| Registered stream | Receives its channel's broadcast |
| Deregistered stream | Stops receiving |
| Different channels | Remain isolated |
| Multiple streams on one channel | All receive the notification |
| One of two streams deregistered | The remaining stream still receives |
| Accepted push | Emits an SSE notification |
| Rejected push | Emits no SSE notification |

SSE payloads are cursor pointers, not domain data. Slow clients must not block
fan-out.

### Push and pull

| Mandatory scenario | Required outcome |
| --- | --- |
| Bootstrap, push, pull round trip | State converges |
| Scoped pull | Returns only entitled root entities and their permitted children |
| Successful push | Advances the cursor |
| Invalid JSON body | Returns HTTP 400 |
| Empty fields array | Still records the event |

Replay persistence is idempotent: pushing an existing event ID must not
duplicate event or field rows. Push has no event-ID replay fast path, so an
exact populated replay may currently be reported as an HLC conflict.

## Project conventions

- Use `repo.NewFakeSyncRepo`, `repo.ErrorSyncRepo`, and `repo.FakeNotifier` for
  behavioral tests. Mock frameworks are banned for these domain seams.
- Mark shared helpers with `t.Helper()`. Name tests
  `Test<Function>_<Scenario>`.
- Pure comparison and parsing logic should use table-driven tests.
- SQL or schema behavior requires an `integration`-tagged test against real
  PostgreSQL. `internal/testhelper.StartPostgres(t)` applies `schema.sql` and
  supports local testcontainers or CI's `PG_TEST_DSN`.
- Unit tests must not require Docker. Integration tests must isolate data with
  cleanup or unique IDs.
- `services/internal/syncengine/db/` is generated. Test changes to the source
  query in `services/internal/syncengine/repo/queries.sql`, not generated code.
- Test-file lint relaxations are intentional: `errcheck`, `godot`, `wrapcheck`,
  and `errorlint` are excluded for `_test.go`; `thelper` remains enabled.

Examples such as fuzzing wire parsers, Rapid properties for ordering, and
concurrent PostgreSQL upserts are recommended only when the changed surface
matches them. They do not expand every change's mandatory matrix.

## Deterministic coverage

- Use fixed timestamps and exact cardinality/value assertions. Do not derive
  expected values from the wall clock or randomness.
- HLC properties must cover total deterministic ordering, transitivity,
  antisymmetry, monotonic generation, per-field independence, and resolution
  independence from push order where applicable. `pgregory.net/rapid` is
  already declared in `services/go.mod`.
- Wire parsers should reject hostile input without panic and preserve valid
  round trips. Run the four HLC fuzz targets with `make test:go:fuzz`.
- Tests sharing mutable state must pass `go test -race ./...`; a detected race
  is a blocking correctness defect.
- SQL changes need real-PostgreSQL coverage for `WHERE`, `ON CONFLICT`, JSONB,
  and concurrent-upsert behavior that fakes cannot prove.

## References

- `site/docs/development/golang.md`
- `services/.golangci.yml`
- `services/go.mod`
- `services/internal/syncengine/handler_test.go`
- `services/internal/syncengine/conflict/hlc_test.go`
- `services/internal/syncengine/conflict/conflict_property_test.go`
- `services/internal/syncengine/conflict/hlc_fuzz_test.go`
- `services/internal/syncengine/repo/postgres_integration_test.go`
- `services/internal/testhelper/pgcontainer.go`
- `services/internal/sse/hub_test.go`
- `Makefile`
