# Go Conventions

This document describes the Go patterns and conventions used in the Peaky backend services (`services/`). It is the authoritative reference for agents and reviewers authoring Go code.

## Target Environment

- **Go**: 1.26+
- **Runtime**: AWS ECS Fargate (distroless containers, `CGO_ENABLED=0`)
- **Database**: PostgreSQL 17 via `database/sql` + `pgx/v5` driver
- **HTTP**: Fuego v0.19 (OpenAPI spec auto-generated from Go types)
- **Build**: `-ldflags="-w -s" -trimpath` (stripped, reproducible)

## Why These Conventions Exist

**Correctness is non-negotiable.** This backend runs a sync engine with field-level HLC conflict resolution, SSE fan-out via PG LISTEN/NOTIFY, and (soon) Cedar-based authorization. A subtle bug in conflict resolution silently corrupts user data across all devices. A race condition in the SSE hub drops cursor notifications and causes stale state. These systems cannot be "mostly correct."

**Memory budget is tight by design.** Services run on small ECS Fargate tasks. Go's GC is excellent but not free — unbounded allocations cause GC pressure spikes that increase p99 latency and inflate cloud cost. Every `sync.Pool`, every pre-allocated slice, every avoided intermediate allocation exists because we measured the alternative. This discipline comes from the same reasoning as Rust's ownership model: if the language won't prevent waste, the conventions must.

## Naming Conventions

Go culture favours short names. We diverge slightly: **readability at the call site wins over brevity.** The goal is that someone coming from Python or Rust can read the code without an IDE. This does not conflict with golangci-lint or gofmt — neither enforces name length.

### The scope rule

The further a name travels from its declaration, the more descriptive it must be. This is idiomatic Go (Dave Cheney, Alex Edwards, Google style guide) — we just enforce it more strictly than most Go codebases.

```go
// ✅ Good — short name in tight scope (range body, 3 lines).
for _, ev := range events {
    if ev.PushedAt == "" { continue }
}

// ✅ Good — descriptive name when used far from declaration.
entitledEntityIDs, err := h.authz.ViewableEntities(ctx, actor.ID, "review")

// ❌ Avoid — single-letter name used 20 lines away from declaration.
e, err := h.authz.ViewableEntities(ctx, a.ID, "review")
// ... 20 lines later ...
if len(e) == 0 { return }  // what is e?
```

### Concrete guidelines

| Context | Convention | Example |
|---------|-----------|---------|
| Loop variable, <5 lines from decl | 1-3 chars OK | `ev`, `fv`, `s`, `p` |
| Function parameter | Descriptive noun | `actorID`, `entityType`, `fieldName` |
| Local variable, >5 lines from decl | Descriptive noun | `entitledIDs`, `wireEvents`, `storageHLC` |
| Struct field | Descriptive noun | `EntityType`, `ActorID`, `FieldName` |
| Package-level constant | Descriptive, camelCase | `maxPushEvents`, `defaultPullLimit`, `heartbeatInterval` |
| Method receiver | 1-3 chars, consistent | `h` for Handlers, `r` for repo, `s` for Stream |
| Interface | `-er` suffix for single method | `Notifier`, `Authenticator` |
| Boolean variable | Reads as assertion | `canEdit`, `hasMore`, `wins` |
| Error variable | Always `err` | `err` (never `e`, `error`, `er`) |
| Context | Always `ctx` | `ctx` (never `c`, `context`) |

### What NOT to do

```go
// ❌ Avoid — Go-culture ultra-terse names for domain concepts.
func (h *Handlers) P(c echo.Context) error {  // what does P mean?
    a := appmiddleware.FromContext(c)           // what is a?
    r, err := h.repo.GFV(ctx, et, eid, fn)     // what are et, eid, fn?
}

// ✅ Good — readable without IDE hover.
func (h *Handlers) Pull(c echo.Context) error {
    actor := appmiddleware.FromContext(c)
    fieldVersion, err := h.repo.GetFieldVersion(ctx, entityType, entityID, fieldName)
}
```

### Acronyms and initialisms

Follow Go convention: all-caps for acronyms in identifiers.

```go
// ✅ Good — consistent casing.
actorID    // not actorId
hlcValue   // HLC is an acronym but lowercase in unexported position
ParseHLC   // exported: all-caps
HTTPClient // not HttpClient
```

### Compatibility with tooling

None of these naming conventions conflict with:

- **gofmt** — formats whitespace and braces, never touches names.
- **golangci-lint** — none of our enabled linters enforce name length or style.
- **go vet** — checks correctness, not naming.

The Go ecosystem has no enforced name-length linter. Our convention is stricter than the community default but fully compatible with all tooling.

## Project Layout

```text
services/
├── cmd/
│   ├── peaky-api/main.go     # HTTP server — does exactly one thing
│   ├── peaky-sse/main.go     # SSE fan-out — separate process
│   └── peaky-ctl/main.go     # CLI: migrate, seed — one-shot container
├── internal/
│   ├── app/                  # Shared config, DB pool, logger
│   ├── authz/                # Authorizer contract + Entitlement + actor registry
│   ├── middleware/           # HTTP middleware (actor extraction)
│   ├── syncengine/           # Sync engine — HTTP layer AT TOP (like a flat feature):
│   │   │                     #   handler.go, push.go, pull.go, models.go, routes.go
│   │   ├── conflict/         # sub-pkg: HLC conflict resolution (pure logic, no Fuego)
│   │   ├── entity/           # sub-pkg: entity registry (new entities land here)
│   │   ├── repo/             # sub-pkg: persistence — ports.go + postgres + fake
│   │   └── db/               # sub-pkg: sqlc-generated code (DO NOT EDIT)
│   ├── sse/                  # SSE hub + handler + routes.go
│   ├── events/               # CloudEvents audit: handler/models/repo/envelope/routes
│   ├── catalog/              # Embedded catalog snapshot + routes.go
│   ├── attachment/           # Attachment download handler + routes.go
│   ├── apiui/                # Scalar UI handler (shared by api + sse)
│   └── dbmigrate/            # Goose migrations + seed data
├── schema.sql                # PostgreSQL desired-state authority
├── sqlc.yaml                 # sqlc configuration
└── Dockerfile                # Multi-stage: builder → distroless
```

**Rules:**

- `cmd/` binaries are thin: parse config, wire dependencies, start server.
- All domain logic lives in `internal/`. Nothing is exported outside the module.
- `internal/syncengine/db/` is generated by sqlc. Edit `internal/syncengine/repo/queries.sql` and run `make gen:sqlc`.
- **Two tiers, one vocabulary.** Most features are a *single package* (`catalog`, `events`, `attachment`, `sse`) — the role files (`routes.go`, `handler.go`, `models.go`, `repo.go`) sit directly in the folder. `syncengine` is a *multi-package bounded context*: its HTTP layer is the top-level package, and `conflict`/`entity`/`repo`/`db` are sub-packages. A feature only grows sub-packages when it genuinely has separate domain + persistence layers — don't pre-nest a small one.

## Dependency Injection

Constructor injection via interfaces. No DI frameworks, no global state.

```go
// ✅ Good — constructor accepts interfaces, returns concrete struct.
type Handlers struct {
    repo     repo.SyncRepo
    authz    authz.Authorizer
    notifier repo.Notifier
}

func New(r repo.SyncRepo, az authz.Authorizer) *Handlers {
    return &Handlers{
        repo:     r,
        authz:    az,
        notifier: repo.NoopNotifier{}, // safe default
    }
}

// ❌ Avoid — global variables, init(), or service locator patterns.
var globalRepo repo.SyncRepo // never do this
```

**Builder pattern for optional dependencies:**

```go
// ✅ Good — WithNotifier is called in production, skipped in tests.
func (h *Handlers) WithNotifier(n repo.Notifier, s repo.SubjectOwner) *Handlers {
    h.notifier = n
    h.subjects = s
    return h
}
```

## Interface Design

Accept interfaces, return structs. Keep interfaces small — one to three methods.

```go
// ✅ Good — focused interface, easy to fake.
type Notifier interface {
    Notify(ctx context.Context, channel, payload string) error
}

// ✅ Good — compile-time interface satisfaction check.
var _ Notifier = (*PostgresNotifier)(nil)
var _ Notifier = NoopNotifier{}

// ❌ Avoid — large interfaces that force fakes to implement 10+ methods.
type EverythingRepo interface {
    GetUser(...)
    SaveUser(...)
    DeleteUser(...)
    ListUsers(...)
    // ... 15 more methods
}
```

**Interface placement:** Define interfaces in the package that *consumes* them, not the package that implements them. Cross-feature contracts get their own package — e.g. `authz.Authorizer` (consumed by middleware, events, attachment, and sync). Sync-persistence ports live in `repo/ports.go`.

## Error Handling

### Wrap with context using `fmt.Errorf` and `%w`

```go
// ✅ Good — caller knows WHERE the error occurred.
func (r *PostgresSyncRepo) GetFieldVersion(ctx context.Context, ...) (*FieldVersion, error) {
    row, err := r.queries.GetFieldVersion(ctx, params)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, nil // not found is not an error
    }
    if err != nil {
        return nil, fmt.Errorf("get field version: %w", err)
    }
    return mapRow(row), nil
}

// ❌ Avoid — raw error propagation loses context.
if err != nil {
    return nil, err
}

// ❌ Avoid — string formatting without %w (breaks errors.Is/As).
return nil, fmt.Errorf("get field version: %v", err)
```

### Sentinel errors for expected conditions

```go
// ✅ Good — sql.ErrNoRows is an expected condition, handle it.
if errors.Is(err, sql.ErrNoRows) {
    return nil, nil
}

// ❌ Avoid — string comparison on error messages.
if err.Error() == "no rows" { ... }
```

### HTTP errors: never leak internals

```go
// ✅ Good — generic message to client, detailed log server-side.
if err != nil {
    return echo.NewHTTPError(http.StatusInternalServerError, "failed to load entitlements")
}

// ❌ Avoid — leaking stack traces or SQL errors to the client.
return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
```

## Memory Efficiency

Services run on constrained ECS tasks. These patterns are mandatory.

### Pre-allocate slices when length is known

```go
// ✅ Good — one allocation, no growth.
repoFields := make([]repo.FieldValue, 0, len(parsedFields))
wireEvents := make([]pullEvent, 0, len(events))
out := make(map[string]entitlement, len(raw))

// ❌ Avoid — grows via append, multiple re-allocations.
var repoFields []repo.FieldValue
```

golangci-lint enforces this via the `prealloc` linter.

### sync.Pool for hot-path buffers

```go
// ✅ Good — reuse buffers across concurrent push requests.
var fieldBufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

// Usage: borrow, reset, use, return.
buf := fieldBufPool.Get().(*bytes.Buffer)
buf.Reset()
// ... use buf ...
fieldBufPool.Put(buf)

// ❌ Avoid — new allocation per request on hot paths.
buf := new(bytes.Buffer)
```

**When to use sync.Pool:**

- Hot paths processing many items per request (field serialization, response building).
- Buffers, slices, or structs that are allocated and discarded frequently.

**When NOT to use sync.Pool:**

- Cold paths (startup, config loading, migrations).
- Small allocations where the pool overhead exceeds the allocation cost.

### Connection pool tuning

```go
// ✅ Good — tuned for container workloads.
db.SetMaxOpenConns(2)        // small container, not many concurrent requests
db.SetMaxIdleConns(1)        // keep one warm connection
db.SetConnMaxLifetime(5 * time.Minute)
db.SetConnMaxIdleTime(2 * time.Minute)

// ❌ Avoid — default pool settings (unlimited connections).
db, _ := sql.Open("pgx", dsn)
// no pool tuning → exhausts PostgreSQL under load
```

### Embed static data at compile time

```go
// ✅ Good — no runtime file I/O, no filesystem dependency.
//go:embed data/catalog-directory-mirror.snapshot.json
var snapshotFS embed.FS

//go:embed migrations/*.sql
var migrationsFS embed.FS
```

### Avoid unnecessary allocations in string operations

```go
// ✅ Good — strings.SplitN with a known max, avoid full split.
parts := strings.SplitN(hlc, ":", 3)

// ✅ Good — direct byte comparison instead of string conversion.
if ev.Fields[0] != '[' {
    // reject non-array fields
}

// ✅ Good — manual scan for single separator (avoids strings.Split allocation).
for i, c := range entityID {
    if c == ':' {
        return "review", entityID[:i]
    }
}
```

## Database Patterns

### sqlc for static queries, hand-written for dynamic

```go
// ✅ Good — sqlc-generated: type-safe, drift-detected.
row, err := r.queries.GetFieldVersion(ctx, syncdb.GetFieldVersionParams{...})

// ✅ Good — hand-written: variable-length IN clause (sqlc can't express it).
// Always use positional parameters ($1, $2, ...) — never string concatenation.
placeholders[i] = fmt.Sprintf("$%d", i+2)

// ❌ Avoid — string interpolation of user input into SQL.
q := fmt.Sprintf("SELECT * FROM events WHERE id = '%s'", userInput)
```

### Always close rows and check rows.Err()

```go
// ✅ Good — defer close, check iteration error.
rows, err := r.db.QueryContext(ctx, q, args...)
if err != nil {
    return nil, false, fmt.Errorf("pull events: %w", err)
}
defer func() { _ = rows.Close() }()

// ... scan loop ...

if err := rows.Err(); err != nil {
    return nil, false, fmt.Errorf("pull events rows: %w", err)
}

// ❌ Avoid — forgetting rows.Err() (misses mid-iteration errors).
// ❌ Avoid — forgetting to close rows (connection leak).
```

golangci-lint enforces this via `sqlclosecheck` and `rowserrcheck`.

### Nullable columns: use sql.NullString

```go
// ✅ Good — explicit null handling.
var value sql.NullString
if fv.Value != nil {
    value = sql.NullString{String: *fv.Value, Valid: true}
}

// ✅ Good — reading nullable columns.
if row.Value.Valid {
    fv.Value = &row.Value.String
}
```

### Pagination: limit+1 pattern

```go
// ✅ Good — fetch one extra row to detect hasMore without COUNT(*).
args = []interface{}{after, limit + 1}
// ...
hasMore := len(events) > limit
if hasMore {
    events = events[:limit]
}
```

## Concurrency

### Always pass context.Context

```go
// ✅ Good — context flows through the entire call chain.
func (h *Handlers) Push(c echo.Context) error {
    ctx := c.Request().Context()
    // pass ctx to all downstream calls
    canEdit, err := h.authz.CanEdit(ctx, a.ID, authType, authID)
}

// ❌ Avoid — context.Background() in request handlers.
canEdit, err := h.authz.CanEdit(context.Background(), ...)
```

golangci-lint enforces HTTP context via `noctx`.

### Mutex discipline: RLock for reads, Lock for writes

```go
// ✅ Good — read lock for concurrent reads.
func (r *FakeSyncRepo) GetFieldVersion(...) (*FieldVersion, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    // ...
}

// ✅ Good — write lock for mutations.
func (r *FakeSyncRepo) UpsertFieldVersion(...) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    // ...
}
```

### Graceful shutdown

```go
// ✅ Good — signal handling with drain timeout.
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
defer stop()

go func() {
    if err := e.Start(addr); err != nil && err != http.ErrServerClosed {
        slog.Error("server error", "error", err)
        os.Exit(1)
    }
}()

<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
_ = e.Shutdown(shutdownCtx)
```

## Logging

Use `log/slog` with structured JSON. No `fmt.Println`, no `log.Printf`.

```go
// ✅ Good — structured fields, appropriate level.
slog.Info("peaky-api starting", "addr", addr)
slog.Warn("push: pg_notify failed", "channel", channel, "error", err)
slog.Error("failed to open database", "error", err)

// ❌ Avoid — unstructured logging.
log.Printf("starting server on %s", addr)
fmt.Println("error:", err)
```

**Level guidelines:**

- `Debug`: per-request details useful during development (SSE stream open/close).
- `Info`: startup, shutdown, migration completion.
- `Warn`: non-fatal degradation (notification failures, slow clients).
- `Error`: fatal startup failures, unrecoverable errors.

### Test setup helpers

```go
// ✅ Good — setup() returns all test dependencies; t.Helper() for clean traces.
func setup(t *testing.T) (*fuego.Server, *handler.Handlers, *authz.Registry, *repo.FakeSyncRepo) {
    t.Helper()
    reg := authz.NewRegistryFromActors([]authz.Actor{...})
    r := repo.NewFakeSyncRepo()
    h := handler.New(r, reg)
    s := fuego.NewServer()
    fuego.Use(s, appmiddleware.Actor(reg))
    return e, h, reg, r
}
```

## Security

### Parameterised queries everywhere

sqlc generates parameterised queries. Hand-written queries use `$N` positional parameters. String concatenation of user input into SQL is a blocking defect.

### Actor override on push

```go
// ✅ Good — server-side actor ID from middleware, not from client payload.
canEdit, err := h.authz.CanEdit(ctx, a.ID, authType, authID)
// a.ID comes from the x-actor-id header (Phase 1) or JWT (Phase 3+),
// NOT from ev.ActorID in the push body.
```

### Input validation with whitelists

```go
// ✅ Good — explicit whitelist, reject unknown.
var allowedEntityTypes = map[string]bool{
    "review":        true,
    "review_answer": true,
    // ...
}
if !allowedEntityTypes[ev.EntityType] {
    rejected = append(rejected, rejectedEvent{ID: ev.ID, Reason: "invalid_entity_type"})
    continue
}

// ❌ Avoid — open-ended entity types.
// Accepting any string as entityType allows data injection.
```

### Header sanitisation

```go
// ✅ Good — truncate + strip control characters.
func sanitizeHeader(s string) string {
    runes := []rune(s)
    if len(runes) > 256 {
        runes = runes[:256]
    }
    out := make([]rune, 0, len(runes))
    for _, r := range runes {
        if r >= 0x20 && r != 0x7F {
            out = append(out, r)
        }
    }
    return string(out)
}
```

## Schema Pipeline

PostgreSQL and runtime SQLite have independent active schema authorities. `services/schema.sql` is the desired end state for PostgreSQL, with Goose migrations and sqlc-generated Go code. Browser SQLite uses the hand-written Drizzle schemas in `shared/db/schema/` plus registered migrations in `shared/db/migrations/sqlite/`.

```text
PostgreSQL                              SQLite
services/schema.sql                     shared/db/schema/*.ts
  ├── Goose migrations                   ├── registered SQLite migrations
  └── sqlc queries/models                └── embedded sqlite-content.ts
                 \                      /
                  persistence behavior tests
```

The unused `scripts/generate-drizzle-from-sql.ts` converter and `shared/db/schema/generated/` output are non-authoritative pending issue #142. Do not run, import, regenerate, or extend them.

**Workflow for a shared persistence change:**

1. Edit `services/schema.sql` with the PostgreSQL desired end state.
2. `make migrate:new NAME=add_foo_column` — scaffold and implement the Goose migration.
3. Edit the sqlc query files if queried columns changed, then run `make gen:sqlc`.
4. Update the hand-written runtime Drizzle schema where the contract also applies to SQLite.
5. Add and register the explicit SQLite migration, then run `pnpm db:migrations:embed`.
6. Run persistence behavior tests against fresh and upgraded PostgreSQL and SQLite, plus `make test:go`.

**Drift detection:** `make gen:sqlc` checks PostgreSQL queries against `services/schema.sql`. Cross-database agreement is behavioral: tests exercise accepted and rejected persistence operations through both active runtime paths rather than claiming one schema generates the other.

## Build & Deploy

### Dockerfile conventions

- Multi-stage build: shared `builder` → per-service compile → distroless runtime.
- `CGO_ENABLED=0` — no libc dependency, runs on `distroless/static`.
- `-ldflags="-w -s"` — strip debug symbols (~30% smaller binary).
- `-trimpath` — remove local source paths (reproducibility + security).
- BuildKit layer caching for `go mod download` and `go-build` cache.

### Binary design

- `peaky-api`: HTTP server only. No subcommands, no management tasks.
- `peaky-sse`: SSE fan-out only. Separate process, separate memory profile.
- `peaky-ctl`: One-shot CLI (migrate, seed). Runs as init container.
- Health probes are self-contained: `peaky-api health` probes `/__health` — no external tools needed in distroless.

## Code Quality Gates

```bash
make go:fmt        # gofmt -w (formatting)
make go:vet        # go vet (correctness)
make lint:go       # golangci-lint (comprehensive)
make test:go       # unit tests (no Docker)
make test:go:integration  # integration tests (Docker PostgreSQL)
```

**golangci-lint enforces (see `.golangci.yml`):**

| Linter | Catches |
|--------|---------|
| `govet` | misuse of sync primitives, printf format, unreachable code |
| `staticcheck` | deprecated API, ineffectual assignments |
| `errcheck` | unchecked errors, unchecked type assertions |
| `prealloc` | slices that should be pre-allocated |
| `noctx` | HTTP requests without context |
| `bodyclose` | HTTP response body not closed |
| `sqlclosecheck` | sql.Rows / sql.Stmt not closed |
| `rowserrcheck` | sql.Rows.Err() not checked |
| `gosec` | common security issues |
| `godot` | comments should end with a period |
| `misspell` | English spelling in comments |

## Correctness-Critical Patterns

These patterns exist because the sync engine, SSE fan-out, and authorization layer are systems where "almost correct" means "silently corrupts data." Every pattern here was motivated by a real failure mode.

### HLC conflict resolution must be deterministic

```go
// ✅ Good — pure lexicographic comparison, no integer parsing.
// Same result on every node, every time, for the same inputs.
func CompareWire(a, b string) int {
    return strings.Compare(a, b)
}

// ✅ Good — tiebreaker is deterministic: higher actorId wins.
// Without this, two nodes could disagree on the winner.
incomingFull := wallIn + ":" + ctrIn + ":" + actorIn
storedFull := wallStored + ":" + ctrStored + ":" + storedActorID
return CompareWire(incomingFull, storedFull) > 0, nil

// ❌ Avoid — floating point, time.Now(), or non-deterministic tiebreakers.
// These cause split-brain: node A accepts Alice, node B accepts Bob.
```

### Per-field independence in conflict resolution

```go
// ✅ Good — each field is resolved independently.
// Alice's answer wins, Bob's naReason wins — both are correct.
for _, f := range fields {
    result, err := applyField(ctx, r, entityType, entityID, actorID, f)
    results = append(results, result)
}

// ❌ Avoid — all-or-nothing per event (loses valid field updates).
```

### Entitlement scoping: WHERE clause, not post-filter

```go
// ✅ Good — data the actor can't see never leaves PostgreSQL.
q := `SELECT ... FROM events WHERE entity_id IN ($1, $2, ...)`

// ❌ Avoid — fetch all, then filter in Go (data exfiltration risk).
events, _ := repo.AllEvents(ctx)
filtered := filterByEntitlement(events, actorEntitlements)
```

### Actor override on push — never trust the client

```go
// ✅ Good — actor ID comes from middleware (header → JWT in Phase 3+).
canEdit, err := h.authz.CanEdit(ctx, a.ID, authType, authID)
// a.ID is from the authenticated context, NOT from ev.ActorID.

// ❌ Avoid — using the actorId from the push event payload.
canEdit, err := h.authz.CanEdit(ctx, ev.ActorID, ...) // client can impersonate
```

### SSE fan-out: cursor pointer only, drop on slow client

```go
// ✅ Good — no domain data over SSE, buffered channel with drop.
select {
case s.Ch <- payload:
default:
    slog.Warn("slow client, dropping notification",
        "stream", s.ID, "actor", s.ActorID, "channel", channel)
}

// ❌ Avoid — unbuffered channel (blocks the fan-out loop for all clients).
// ❌ Avoid — sending entity data over SSE (security boundary violation).
```

### Idempotent replay — ON CONFLICT DO NOTHING

```go
// ✅ Good — cursor reset causes re-pull of same events; must not fail.
// Duplicate event IDs are silently ignored, not errors.
for _, existing := range r.events {
    if existing.ID == ev.ID {
        return nil // idempotent
    }
}
```

### Input validation with explicit limits

```go
// ✅ Good — bounded batch size prevents memory exhaustion.
const maxPushEvents = 500
const maxFieldsPerEvent = 100

if len(req.Events) > maxPushEvents {
    return echo.NewHTTPError(http.StatusBadRequest, "too many events")
}
```

## Testing — TDD Workflow

We practice TDD. The cycle is: write a failing test (RED), make it pass with minimal code (GREEN), then clean up (REFACTOR). This prevents waste — agents produce exactly the code needed and nothing more.

### RED: Write the test first

```go
// Write the test BEFORE the implementation exists.
func TestApplyFields_OlderRejected(t *testing.T) {
    r := repo.NewFakeSyncRepo()
    ctx := context.Background()

    // Seed a newer version.
    _ = r.UpsertFieldVersion(ctx, repo.FieldVersion{
        EntityType: "review_answer", EntityID: "r1:q1",
        FieldName: "answer", Value: strPtr(`"yes"`),
        HLC: "1000:0001", ActorID: "actor_alice",
    })

    // Push an older version — must be rejected.
    fields := []repo.FieldValue{
        {Name: "answer", Value: strPtr(`"no"`), HLC: "0999:0001:actor_bob"},
    }
    results, err := conflict.ApplyFields(ctx, r, "review_answer", "r1:q1", "actor_bob", fields)
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if results[0].Accepted {
        t.Error("older HLC should be rejected")
    }
}
```

### GREEN: Minimal implementation

Write just enough code to make the test pass. No speculative features, no "while I'm here" additions.

### REFACTOR: Clean up without changing behavior

Extract helpers, rename for clarity, split large functions. Tests must still pass after refactoring.

### Test structure: in-memory fakes, not mocks

```go
// ✅ Good — FakeSyncRepo implements the real interface with real behavior.
r := repo.NewFakeSyncRepo()
h := handler.New(r, reg)

// ✅ Good — ErrorSyncRepo for error path testing.
r := &repo.ErrorSyncRepo{}

// ✅ Good — FakeNotifier records calls for assertion.
notifier := &repo.FakeNotifier{}
// ... exercise handler ...
if notifier.CallCount() != 1 { t.Error(...) }

// ❌ Avoid — mock frameworks (gomock, mockery).
// Fakes test real behavior. Mocks test call sequences (brittle).
```

### Table-driven tests for pure functions

```go
// ✅ Good — exhaustive coverage of edge cases.
cases := []struct {
    name     string
    a, b     string
    expected int
}{
    {"newer wallclock wins", "1000:0001:alice", "0999:0001:alice", 1},
    {"older wallclock loses", "0999:0001:alice", "1000:0001:alice", -1},
    {"same wallclock higher counter wins", "1000:0002:alice", "1000:0001:alice", 1},
    {"actor tiebreaker: bob > alice", "1000:0001:bob", "1000:0001:alice", 1},
    {"identical", "1000:0001:alice", "1000:0001:alice", 0},
}
for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
        if got := conflict.CompareWire(tc.a, tc.b); got != tc.expected {
            t.Errorf("CompareWire(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.expected)
        }
    })
}
```

### Naming: `Test<Function>_<Scenario>`

```go
// ✅ Good — what is tested, what the scenario is, what the expectation is.
func TestPush_AcceptsFieldLevelEvents(t *testing.T) { ... }
func TestPush_RejectsUnauthorizedEntity(t *testing.T) { ... }
func TestApplyFields_OlderRejected(t *testing.T) { ... }
func TestApplyFields_NonOverlappingFieldsAcceptedIndependently(t *testing.T) { ... }
func TestHub_DeregisterStopsDelivery(t *testing.T) { ... }

// ❌ Avoid — vague or "how" names.
func TestPush(t *testing.T) { ... }
func TestCallsApplyFields(t *testing.T) { ... }
```

### Integration tests: build tags, real PostgreSQL

```go
//go:build integration

// Run with: go test -tags integration ./...
// Requires Docker PostgreSQL (make test:go:integration).
```

### Correctness test categories (must cover)

For any sync/conflict/SSE change, tests must cover:

| Category | Example |
|----------|---------|
| Happy path | Alice pushes, Bob pulls, state converges |
| Conflict resolution | Two actors, overlapping fields, correct winner |
| Tiebreaker | Same wallclock:counter, actor lexicographic order |
| Partial acceptance | Some fields accepted, some rejected in same event |
| Malformed input | Bad HLC format → soft reject, not crash |
| Authorization | Entitled actor succeeds, unentitled is rejected |
| Idempotency | Same event pushed twice → no duplicate, no error |
| Fan-out | Accepted push → SSE notify; rejected push → no notify |
| Entitlement scoping | Pull returns only entitled entities |

### Race detection

```bash
# Always run tests with race detector in CI.
go test -race ./...
```

Any test that fails under `-race` is a **blocking defect**. The race detector catches data races that would cause silent corruption in production.

## Anti-Patterns

### Do not use

```go
// ❌ init() functions — hidden side effects, hard to test.
func init() { ... }

// ❌ Global mutable state.
var globalConfig Config

// ❌ panic() in library/handler code — use error returns.
panic("unexpected state")

// ❌ Naked goroutines without lifecycle management.
go doWork() // who cancels this? who waits for it?

// ❌ _ on error returns in production code (except deferred Close).
result, _ := dangerousFunction()

// ❌ context.TODO() — always propagate the request context.
ctx := context.TODO()

// ❌ Mock frameworks — use in-memory fakes.

// ❌ ORM — use sqlc for static queries, hand-written SQL for dynamic.

// ❌ time.Now() in domain logic — inject a clock or pass time as parameter.
// Non-deterministic time breaks test reproducibility and HLC correctness.
```

### Acceptable underscore-ignoring

```go
// ✅ OK — deferred Close where error doesn't change outcome.
defer func() { _ = db.Close() }()
defer func() { _ = rows.Close() }()
defer func() { _ = resp.Body.Close() }()
```

## Resources

- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://go.dev/wiki/CodeReviewComments)
- [Go Performance Optimization Guide](https://goperf.dev/)
- [sqlc Documentation](https://docs.sqlc.dev/)
- [Fuego Framework](https://github.com/go-fuego/fuego)
