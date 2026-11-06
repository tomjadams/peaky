## ADDED Requirements

### Requirement: Schema Pipeline Single Source of Truth

The system SHALL use a single MySQL DDL file (`services/schema.sql`) as the source of truth for all shared database tables, with automated generation of both Go types (via SQLc) and Drizzle SQLite schemas (via codegen script).

#### Scenario: Schema change propagates to both backends

- **WHEN** a developer modifies `services/schema.sql`
- **THEN** running `make gen:schemas` regenerates Go types and Drizzle SQLite schemas
- **AND** CI fails if generated files are stale (git diff --exit-code)

#### Scenario: Schema.sql and migrations stay in sync

- **WHEN** CI runs the drift gate
- **THEN** applying all goose migrations to an empty MySQL database produces the same schema as applying `schema.sql` directly
- **AND** the build fails if there is any divergence

#### Scenario: Client-only tables are excluded from schema.sql

- **WHEN** a table exists only in the client SQLite database (e.g., `local_outbox`, `template_drafts`)
- **THEN** it MUST NOT appear in `services/schema.sql`
- **AND** it remains hand-written in `shared/db/schema/local.ts`

#### Scenario: Codegen type mapping is correct

- **WHEN** the codegen script processes `services/schema.sql`
- **THEN** it maps `VARCHAR(N)` and `TEXT` to Drizzle `text()`, `INT` to `integer()`, `DATETIME(6)` to `text()`, `JSON` to `text()`, and `BOOLEAN` to `integer()`
- **AND** the generated Drizzle schemas produce SQLite tables structurally equivalent to the MySQL originals

### Requirement: Go API Server

The system SHALL provide a Go HTTP server (`cmd/peaky-api`) serving sync, attachment, and catalog endpoints, with the architecture designed for future machine integration APIs.

#### Scenario: Server starts and applies migrations

- **WHEN** the Go API server starts
- **THEN** it applies any pending goose migrations to MySQL
- **AND** it begins serving HTTP traffic on the configured port

#### Scenario: Sync endpoints are accessible

- **WHEN** the server is running
- **THEN** it serves `GET /api/sync/bootstrap`, `POST /api/sync/push`, `GET /api/sync/pull`, and `GET /api/sync/entitlements`
- **AND** all endpoints validate request bodies and return structured JSON responses

#### Scenario: Attachment download validates entitlements

- **WHEN** a client requests `GET /api/attachments/:id`
- **THEN** the server validates the actor's entitlement to the parent entity before serving the binary
- **AND** returns 403 if the actor lacks view permission

### Requirement: Field-Level HLC Conflict Resolution

The sync push handler SHALL resolve conflicts at the field level using Hybrid Logical Clock timestamps, accepting or rejecting each field independently.

#### Scenario: Newer HLC field wins

- **WHEN** an actor pushes a field with an HLC newer than the stored HLC for that field
- **THEN** the server accepts the field value and updates the `field_versions` table
- **AND** writes the field to the corresponding state table

#### Scenario: Older HLC field is rejected

- **WHEN** an actor pushes a field with an HLC older than or equal to the stored HLC
- **THEN** the server rejects that field
- **AND** includes both the local and remote HLC values plus the current server value in the `fieldConflicts` response
- **AND** inserts a row into `pending_review_queue` with both payloads

#### Scenario: Non-overlapping fields in same push are accepted independently

- **WHEN** two actors push updates to the same entity but different fields
- **THEN** both fields are accepted (each field's HLC is compared independently)
- **AND** neither actor's non-conflicting fields are rejected

#### Scenario: HLC storage is optimized

- **WHEN** the server stores an HLC
- **THEN** it stores only the `wallclock:counter` portion in the `hlc` column (~18 bytes)
- **AND** the actor_id is stored in its own column (already present in the row)
- **AND** conflict comparison uses `(hlc > ?) OR (hlc = ? AND actor_id > ?)`

#### Scenario: Concurrent pushes cannot race on the same field

- **WHEN** two actors push different values for the same field simultaneously
- **THEN** the `UpsertFieldVersion` SQL uses a `WHERE` clause on the `ON CONFLICT DO UPDATE` to atomically enforce HLC comparison
- **AND** a concurrent push with a newer HLC that lands between the Go read and write cannot be silently overwritten
- **AND** the Go layer performs a pre-flight HLC check for accurate accept/reject responses, but the SQL WHERE clause is the authoritative safety net

### Requirement: Push Rejection Classification

The sync client SHALL classify push rejection reasons as terminal or retryable, immediately marking terminal rejections as failed without retry.

#### Scenario: HLC conflict is terminal

- **WHEN** the server rejects a push event with reason `hlc_conflict`
- **THEN** the client marks the outbox entry as `failed` immediately
- **AND** does not retry the push (the stale HLC will always lose)

#### Scenario: Partial HLC conflict is terminal

- **WHEN** the server rejects a push event with reason `partial_hlc_conflict`
- **THEN** the client marks the outbox entry as `failed` immediately
- **AND** the accepted fields from the same event are already stored server-side

#### Scenario: Access revoked is terminal

- **WHEN** the server rejects a push event with reason `access_revoked`
- **THEN** the client marks the outbox entry as `failed` immediately
- **AND** adds the item to the pending review queue for user attention

#### Scenario: Invalid entity type is terminal

- **WHEN** the server rejects a push event with reason `invalid_entity_type`
- **THEN** the client marks the outbox entry as `failed` immediately
- **AND** does not retry (the entity type is not whitelisted; retrying will always fail)

#### Scenario: Network errors are retried with backoff

- **WHEN** a push fails due to a network error or HTTP 5xx
- **THEN** the client retries with exponential backoff (decorrelated jitter, 1s–60s)
- **AND** marks the entry as `failed` after 5 unsuccessful attempts
- **AND** increments `retryCount` on each attempt

#### Scenario: Failed outbox entry triggers overridden badge

- **WHEN** the outbox contains a `failed` entry for a question
- **AND** the winning `field_versions` row has a different `actorId` than the current actor
- **THEN** the Recent Changes feed shows the "overridden" badge on that question

### Requirement: Sync Pull Scoped by Entitlements

The sync pull endpoint SHALL return only events for entities the requesting actor is entitled to view, with entitlements applied at the query level.

#### Scenario: Pull returns only entitled entities

- **WHEN** an actor pulls with a cursor
- **THEN** the server resolves viewable entity IDs from the actor's entitlements
- **AND** each entitled ID is paired with its entity type (`EntitlementRef{EntityType, EntityID}`)
- **AND** the SQL WHERE clause uses `(entity_type, entity_id) IN (...)` tuple comparison
- **AND** events for different entity kinds that share the same bare ID are never returned
- **AND** the filter is part of the SQL WHERE clause, not a post-query filter

#### Scenario: Multi-team actor sees cross-team deltas

- **WHEN** an engineering manager with access to 4 teams pulls
- **THEN** the response includes deltas from all 4 teams since the cursor
- **AND** changes made by other team members appear in the response

#### Scenario: Attachment metadata syncs but binaries do not

- **WHEN** an attachment is created or modified
- **THEN** the sync pull includes the attachment metadata (filename, objectKey, mimeType, size)
- **AND** the binary content is NOT included in the pull response

### Requirement: Composite Cursor & Bootstrap

The sync engine SHALL use a composite cursor (`RFC3339Nano:EventUUID`) to track the client's position in the server event stream, with separate local and remote cursors for push deduplication and pull incrementality respectively.

#### Scenario: Cursor advances through the event stream

The server event stream is a time-ordered sequence. The cursor is a pointer that slides forward as the client pulls events:

```text
Server event stream (time →)
  ├─ evt-1  2026-01-01T10:00:00Z
  ├─ evt-2  2026-01-01T10:00:01Z
  ├─ evt-3  2026-01-01T10:00:02Z  ← cursor (already pulled)
  ├─ evt-4  2026-01-01T10:00:03Z  ← next pull returns this
  └─ evt-5  2026-01-01T10:00:04Z
```

- **WHEN** the client pulls with `after=2026-01-01T10:00:02Z:evt-3`
- **THEN** the server uses PostgreSQL tuple comparison `(time, id) > ($1, $2)`
- **AND** returns events strictly newer than the cursor, including same-timestamp events with a lexicographically greater ID
- **AND** the client saves the new cursor as `lastEvent.Time:lastEvent.ID`

#### Scenario: Two cursors with separate purposes

| Cursor | Stored in | Purpose | Who advances |
|--------|-----------|---------|-------------|
| `localCursor` | `sync_cursors.local` | Push deduplication marker — tracks which outbox items the server has accepted | `pushChanges()` after successful push |
| `remoteCursor` | `sync_cursors.remote` | Pull window — tracks how far the client has read from the server event stream | `pullChanges()` after successful pull |

- **WHEN** a push succeeds
- **THEN** the server returns `newClientCursor` which becomes `localCursor`
- **AND** `remoteCursor` is NOT modified by push
- **WHEN** a pull succeeds
- **THEN** the response `cursor` becomes `remoteCursor`
- **AND** `localCursor` is NOT modified by pull

#### Scenario: Bootstrap initialises only the local cursor

On first load (or after `clearLocalData()`), the client runs `bootstrap()`:

1. Fetches entitlements and caches them in SQLite (`entitlement_snapshots`)
2. Saves the server's `local` cursor (push deduplication marker)
3. Sets `remoteCursor = null` — intentionally NOT inheriting the server's stored remote cursor

- **WHEN** the client calls `GET /api/sync/bootstrap`
- **THEN** the server returns `cursors.local` and `cursors.remote`
- **AND** the client saves only `localCursor`, passing `null` for `remoteCursor`
- **AND** the next `pullChanges()` omits the `after` parameter
- **AND** the server returns the full event stream from the beginning

#### Scenario: Bootstrap inheriting server remoteCursor causes empty data

- **WHEN** a client recreates its local database and bootstraps
- **AND** bootstrap copies the server's `remoteCursor` into the local `sync_cursors` table
- **THEN** the server's cursor is at the end of the event stream (from the last successful pull before the clear)
- **AND** the subsequent pull returns zero events
- **AND** Teams, Products, and Reviews appear empty until a new server-side change occurs

#### Scenario: Cursor resets on clearLocalData

- **WHEN** the user clicks "Recreate local DB"
- **THEN** the OPFS database files are deleted and the page reloads
- **AND** bootstrap detects no existing entitlement snapshot (cache miss)
- **AND** bootstrap fetches fresh entitlements and sets `remoteCursor = null`
- **AND** the first sync cycle pulls the entire event stream from the beginning
- **AND** all entities hydrate correctly

#### Scenario: Progressive cursor parsing handles RFC3339 internal colons

RFC3339 timestamps contain colons in the time component (e.g. `2026-01-01T15:04:05Z`). Naive splitting on the first or last colon incorrectly truncates the timestamp.

- **WHEN** the pull handler receives a legacy cursor `2026-01-01T15:04:05Z` (no `:id` suffix)
- **THEN** it progressively tests every colon position until the prefix parses as a valid RFC3339 timestamp
- **AND** the full timestamp is preserved as `afterTime`, with `afterID = ""`
- **WHEN** the pull handler receives a composite cursor `2026-01-01T15:04:05.123456789Z:evt-abc-123`
- **THEN** the progressive parser finds the split after the timestamp and extracts `afterID = "evt-abc-123"`
- **AND** invalid cursors that fail RFC3339 parsing at every position return 400 Bad Request

#### Scenario: SQL tuple comparison branches on cursor type

The `pullEventRows` query must handle both legacy timestamp-only cursors and composite `(time, id)` cursors without producing type errors or incorrect results.

- **WHEN** `afterID` is empty (legacy cursor or first pull)
- **THEN** the query uses `time > $1` (simple timestamp comparison)
- **AND** does not use tuple comparison `(time, id) > ($1, $2)` which risks type issues with an empty-string ID against a TEXT column
- **WHEN** `afterID` is non-empty (composite cursor)
- **THEN** the query uses `(time, id) > ($1, $2)` for precise pagination at same-timestamp boundaries
- **AND** the `ORDER BY time ASC, id ASC` clause ensures deterministic pagination

### Requirement: Local-Only Progress Updates

The client SHALL NOT sync `review_progress` via the outbox. Progress is derived server-side from answer state, so pushing an empty `fields` payload wastes CPU and network for zero server-side effect.

#### Scenario: saveLocalProgress writes only a local audit event

- **WHEN** the user saves pillar progress (e.g. 33% → 67%)
- **THEN** the client writes a `ReviewProgressUpdated.v1` event to the local `events` table for audit-trail purposes
- **AND** does NOT insert a row into `local_outbox`
- **AND** the server never receives a `review_progress` push
- **AND** server-side progress remains correct because it is recomputed from `field_versions` answer state

#### Scenario: Server rejects review_progress push as defense-in-depth

- **WHEN** a client (buggy or outdated) sends a `review_progress` push event
- **THEN** the server rejects it with reason `invalid_entity_type`
- **AND** the client marks the outbox entry as `failed` immediately (terminal rejection)
- **AND** no `field_versions` rows are written for the rejected event

### Requirement: Simulated Actor Registry

The system SHALL provide a simulated actor registry for Phase 1 development, replaceable by Okta JWT in Phase 3 via an Authorizer interface (package `internal/authz`).

#### Scenario: Actor selected by header

- **WHEN** a request includes the `x-actor-id` header
- **THEN** the middleware looks up the actor in the seeded registry
- **AND** attaches the actor to the request context for handler access

#### Scenario: Default actor for missing header

- **WHEN** a request has no `x-actor-id` header or the value is `actor_dev`
- **THEN** the middleware uses the default `actor_dev` actor from the registry

#### Scenario: Authorizer interface enables future swap

- **WHEN** the Go service evaluates permissions
- **THEN** it calls methods on the `Authorizer` interface (ViewableEntities, CanView, CanEdit)
- **AND** no handler imports the actor registry implementation directly

### Requirement: Docker Development Environment

The system SHALL provide a Docker Compose setup with MySQL and the Go API server, integrated into the Makefile for seamless local development.

#### Scenario: make watch starts full stack

- **WHEN** a developer runs `make watch`
- **THEN** Docker Compose starts MySQL (waits for healthy) and the Go API server
- **AND** Nuxt dev server starts with the sync backend URL configured
- **AND** hot-reload works for frontend changes

#### Scenario: Docker compose is self-contained

- **WHEN** a developer clones the repo and runs `make dev && make watch`
- **THEN** the full stack starts without manual Docker configuration
- **AND** MySQL data persists across restarts via a Docker volume

### Requirement: Catalog Directory Mirror

The Go API server SHALL serve the catalog/directory mirror data (LDAP users, teams, Backstage components) as static JSON endpoints with aggressive caching.

#### Scenario: Catalog endpoints serve bundled snapshot

- **WHEN** a client requests `/api/catalog-directory-mirror/groups`
- **THEN** the server returns the groups from the bundled JSON snapshot
- **AND** sets cache headers (1 hour, stale-while-revalidate 24 hours)

#### Scenario: All catalog sub-endpoints are available

- **WHEN** the server is running
- **THEN** it serves `/api/catalog-directory-mirror` (full snapshot), `/groups`, `/users`, `/components`, and `/meta`

### Requirement: SSE Fan-Out Service (peaky-sse)

The system SHALL provide a separate Go service (`cmd/peaky-sse`) that delivers cursor-pointer notifications to connected browser clients via Server-Sent Events, using PostgreSQL LISTEN/NOTIFY as the pub-sub primitive.

#### Scenario: Push accepted triggers SSE notification

- **WHEN** peaky-api accepts one or more events in a push batch
- **THEN** it builds the notification payload via `json.Marshal` (not string concatenation)
- **AND** it calls `pg_notify` on the channel matching the owning subject (`sync:{subjectType}:{subjectId}`)
- **AND** all SSE clients subscribed to that channel receive a cursor-pointer message within one network RTT

#### Scenario: Client subscribes to entitled channels on connect

- **WHEN** an actor opens an SSE connection to `/api/sse/events`
- **THEN** the SSE pod registers `LISTEN` on every channel in the actor's entitlement set (`sync:team:X` for each entitled team, `sync:product:Y` for each entitled product)
- **AND** the pod's single PostgreSQL connection accumulates these listeners without creating additional PG connections per actor

#### Scenario: SSE payload is a cursor pointer only

- **WHEN** the SSE service delivers a notification to a client
- **THEN** the message body contains only `{ "cursor": "...", "subjectType": "...", "subjectId": "..." }`
- **AND** the client calls `pullChanges()` using this cursor to retrieve actual domain data

#### Scenario: SSE failure falls back to 30s poll

- **WHEN** the SSE connection is disrupted (service unavailable, network error, pod restart)
- **THEN** the client's 30s polling interval continues uninterrupted
- **AND** no user-visible error is shown — sync latency degrades gracefully to 30s

#### Scenario: Heartbeat keeps connection alive

- **WHEN** no notifications have been sent for 15 seconds
- **THEN** the SSE service sends a comment line (`: heartbeat`) to prevent ALB idle timeout from closing the connection

#### Scenario: Services are independently deployable

- **WHEN** peaky-sse is deployed or scaled independently of peaky-api
- **THEN** both services continue to function correctly
- **AND** each service has its own ECS task definition with independent CPU/memory/autoscaling profiles

### Requirement: Consolidated Services Dockerfile

All Go services SHALL share a single multi-stage `services/Dockerfile` with one named target per service (`api`, `ctl`, `sse`). Adding a new service adds one compile stage and one runtime stage to the same file.

#### Scenario: Each target produces an independent lean image

- **WHEN** `docker build --target api ./services` is run
- **THEN** only the `peaky-api` binary and its required assets are in the final image
- **AND** the image is based on distroless/static with no shell, no package manager, no other binaries

#### Scenario: Builder layer is shared across targets

- **WHEN** `docker compose build api sse ctl` is run
- **THEN** the Go module download and most of the compile cache are shared across all three targets
- **AND** a change to `cmd/peaky-api/` only re-runs the `build-api` stage, not `build-sse` or `build-ctl`
