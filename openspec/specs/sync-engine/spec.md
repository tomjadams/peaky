# sync-engine Specification

## Purpose

TBD - created by archiving change add-backend-sync-engine. Update Purpose after archive.

## Requirements

### Requirement: Schema Pipeline Single Source of Truth

The system SHALL use `services/schema.sql` plus Goose/sqlc for PostgreSQL and explicit hand-written Drizzle schemas plus registered SQL migrations for SQLite, with persistence behavior tests enforcing the shared contract.
**ID:** REQ-003

#### Scenario: Schema change propagates through active artifacts

- **WHEN** a shared persistence contract changes
- **THEN** PostgreSQL desired state, Goose migrations, sqlc models, hand-written SQLite Drizzle schemas, and SQLite migrations are updated where applicable
- **AND** behavior tests exercise the accepted and rejected states through the active PostgreSQL and SQLite runtime paths
- **AND** the unused PostgreSQL-to-Drizzle converter and its generated directory remain non-authoritative pending issue #142
- **ID:** AC-007

#### Scenario: Schema and Goose migrations stay aligned

- **WHEN** persistence behavior runs against a fresh `services/schema.sql` database and a database built by all Goose migrations
- **THEN** both paths satisfy the same shared-schema contract across all persisted entities, fields, constraints, indexes, and references
- **AND** divergence in accepted or rejected persistence operations fails verification without requiring exact catalog or source-file equality
- **ID:** AC-008

#### Scenario: Client-only tables remain explicit

- **WHEN** a table exists only in browser SQLite
- **THEN** it is excluded from `services/schema.sql`
- **AND** its hand-written schema and SQLite migration remain explicit and tested
- **ID:** AC-009

#### Scenario: Cross-database type representations remain explicit

- **WHEN** a shared field is represented in PostgreSQL and SQLite
- **THEN** each active schema uses its documented native representation for text, integer, timestamp, JSON, and boolean values
- **AND** persistence behavior tests prove the representations accept and return the required domain values
- **ID:** AC-010

#### Scenario: Template Revision tables and references exist in both active schemas

- **WHEN** Template, Revision, Pillar, Question, or Review-selection state is stored
- **THEN** PostgreSQL and the hand-written SQLite Drizzle schema expose the required fields and references through their active runtime paths
- **AND** no runtime depends on `shared/db/schema/generated/`
- **ID:** AC-011

#### Scenario: Partial unique indexes preserve their predicates

- **WHEN** one-draft, one-published, or Revision-number uniqueness is enforced
- **THEN** PostgreSQL and SQLite apply conditional uniqueness only to the intended rows
- **AND** behavioral inserts prove valid retired and cross-Template rows remain accepted
- **ID:** AC-012

#### Scenario: Incomplete shared-schema changes fail behaviorally

- **WHEN** a shared table, field, constraint, or reference is missing from an active PostgreSQL or SQLite path
- **THEN** the relevant fresh/upgrade or persistence behavior test fails with the affected domain operation
- **ID:** AC-013

#### Scenario: Composite primary keys remain composite

- **WHEN** Review selections use `(review_id, template_revision_id)` identity
- **THEN** PostgreSQL and SQLite enforce one composite primary key rather than independent column primary keys
- **AND** duplicate Revision selection behavior fails consistently in both databases
- **ID:** AC-018

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

The sync pull endpoint SHALL return only events whose resolved root the requesting actor is entitled to view. Entitlements SHALL be applied at the query level against each event's `(root_type, root_id)` reference, using per-family wildcard scoping so a wildcard in one entity family never widens or removes the filter for another family.

#### Scenario: Pull returns events for entitled roots, including their children

- **WHEN** an actor pulls with a cursor
- **THEN** the server resolves the actor's entitlements into per-family wildcards (e.g. `review:*`) and exact root references (e.g. `(review, review-001)`)
- **AND** the SQL WHERE clause matches events where `root_type = ANY(wildcard_families) OR (root_type, root_id) IN (exact_refs)`
- **AND** both root events and their child events (which carry the same `root_type`/`root_id`) are returned
- **AND** the filter is part of the SQL WHERE clause, not a post-query filter

#### Scenario: Child events ride along with their root

- **WHEN** an actor entitled to exactly `review:review-001` (no wildcard) pulls
- **AND** child events exist for entity `(review_answer, review-001:q1)`
- **THEN** those child events are returned because they resolve to root `(review, review-001)`
- **AND** the actor receives the review's answers, notes, and checkpoints, not just the review's own fields

#### Scenario: A family wildcard scopes only to its own family

- **WHEN** an actor holds `product:*` plus an exact `review:review-001` entitlement
- **THEN** the pull returns every product-rooted event (the wildcard) and only `review-001` review events
- **AND** events rooted at `review-999` are NOT returned
- **AND** a wildcard in one family never sets the pull filter to unscoped (no global `entitled = nil` collapse)

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
- **AND** the push response does NOT carry a `remoteCursor` field
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

The system SHALL provide a separate Go service (`cmd/peaky-sse`) that delivers cursor-pointer notifications to connected browser clients via Server-Sent Events, using PostgreSQL LISTEN/NOTIFY as the pub-sub primitive. Every SSE channel SHALL use the single per-family catalog form `sync:{family}:catalog`, where `family` is one of `review`, `product`, or `template`. Both the subscription side (LISTEN) and the notification side (NOTIFY) SHALL derive this same channel from the family, so the doorbell is guaranteed to reach every entitled client. `team` is NOT a family: it is neither an entitlement key nor a routing concept for LISTEN/NOTIFY. (This is scoped to SSE routing only — team seed rows can still appear in `/pull` responses for wildcard actors today because of a separate, pre-existing pull-filter gap, deliberately deferred; see the `sse-family-catalog-channels` archive, task 3.4b.)

#### Scenario: Push accepted triggers SSE notification

- **WHEN** peaky-api accepts one or more events in a push batch
- **THEN** it builds the notification payload via `json.Marshal` (not string concatenation)
- **AND** it computes `family = entity.Family(entityType)` for each accepted event, collects the distinct family channels, and calls `pg_notify` once per distinct `sync:{family}:catalog` (deduplicated per family per batch, see the dedup scenario below)
- **AND** all SSE clients listening on that family channel receive a cursor-pointer message within one network RTT

#### Scenario: All synced families emit notifications

- **WHEN** an accepted event belongs to any synced family (review, product, or template)
- **THEN** a notification is emitted on that family's catalog channel
- **AND** no family is silently skipped — review, product, and template are all covered
- **AND** `template` is plumbed here for forward compatibility only: it is not yet a pull root (see Pull Root Types), no push path produces `template`-family events today, and a `template:*` SSE subscriber's cursor notification is currently a no-op for `pullChanges()`

#### Scenario: Partially accepted event still notifies

- **WHEN** a push event is partially accepted (some fields win on HLC, others lose) and the winning fields are persisted to the event log
- **THEN** a notification is emitted on the event's family catalog channel, exactly as for a fully accepted event
- **AND** only a wholly rejected event, which persists nothing, produces no notification

#### Scenario: Notifications are deduplicated per family per batch

- **WHEN** a single push batch accepts multiple events in the same family
- **THEN** at most one `pg_notify` is emitted on that family's catalog channel for the batch
- **AND** a batch spanning multiple families emits exactly one notification per distinct family

#### Scenario: Client subscribes to entitled family channels on connect

- **WHEN** an actor opens an SSE connection to `/api/sse/events`
- **THEN** for each `canView` entitlement the SSE pod derives `family` as the segment before the first `:`, and if `family` is one of `review`, `product`, or `template` it registers `LISTEN sync:{family}:catalog`
- **AND** wildcard (`review:*`) and specific (`review:review-001`) entitlements collapse to the same single channel, so no channel name passed to `LISTEN` ever contains a literal `*`
- **AND** the pod's single PostgreSQL connection accumulates these listeners without creating additional PG connections per actor

#### Scenario: SSE payload is a cursor pointer only

- **WHEN** the SSE service delivers a notification to a client
- **THEN** the message body contains only `{ "cursor": "...", "family": "..." }` with no domain data
- **AND** the client calls `pullChanges()` using this cursor, and the entitlement-scoped `/pull` endpoint remains the authorization boundary

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

### Requirement: Event Root Reference Stamping

The sync push handler SHALL resolve and persist a `(root_type, root_id)` reference on every accepted event, and SHALL reject any event whose root cannot be resolved. A root entity is its own root; a child entity resolves to the root identified by its composite id.

#### Scenario: A root entity is its own root

- **WHEN** a push event targets a root entity such as `(review, review-001)`
- **THEN** the stored event's `root_type` and `root_id` equal its own `entity_type` and `entity_id`

#### Scenario: A child entity resolves to its parent root

- **WHEN** a push event targets a child entity whose id has the form `{rootId}:{unitId}`, such as `(review_answer, review-001:q1)`
- **THEN** the server resolves the root `(review, review-001)` and stamps it as `root_type`/`root_id` on the stored event

#### Scenario: An unresolvable root is rejected at push

- **WHEN** a push event targets a known **child** entity type whose id has no parseable `{rootId}:` prefix, so its root cannot be resolved (root entity types are always self-rooted and never hit this case)
- **THEN** the server rejects that event with the terminal reason `invalid_entity_id`
- **AND** writes no `events` or `field_versions` rows for it
- **AND** the client marks the corresponding outbox entry as `failed`
- **AND** this is distinct from `invalid_entity_type` (entity type unknown to the registry), which is rejected earlier and never reaches root resolution

#### Scenario: Existing events are backfilled with root references

- **WHEN** the root-reference migration runs against a populated database
- **THEN** every existing `events` row receives a resolved `root_type`/`root_id` using the same resolution rules
- **AND** no event row is left with a null root reference
- **AND** events that cannot be resolved fail the migration loudly rather than being left unscoped

### Requirement: Pull Root Types Include Product

The sync engine SHALL treat a fixed set of entity types as pull roots when resolving entitlements, and SHALL include `product` as a pull root alongside `review`.

#### Scenario: Pull resolves entitlements across all root types

- **WHEN** the pull handler resolves an actor's entitlements
- **THEN** it iterates the configured pull-root types, which include at least `review` and `product`
- **AND** for each root type it resolves the actor's viewable ids (or a family wildcard) independently

#### Scenario: Product entitlement scopes product-rooted events

- **WHEN** an actor is entitled to a specific product `(product, prod-1)` but no others
- **THEN** the pull returns events rooted at `prod-1` (the product and its children)
- **AND** does not return events rooted at other products
- **AND** does not return review or other-family events the actor is not entitled to
