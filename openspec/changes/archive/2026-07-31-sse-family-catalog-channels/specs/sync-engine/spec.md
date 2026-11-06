## MODIFIED Requirements

### Requirement: SSE Fan-Out Service (peaky-sse)

The system SHALL provide a separate Go service (`cmd/peaky-sse`) that delivers cursor-pointer notifications to connected browser clients via Server-Sent Events, using PostgreSQL LISTEN/NOTIFY as the pub-sub primitive. Every SSE channel SHALL use the single per-family catalog form `sync:{family}:catalog`, where `family` is one of `review`, `product`, or `template`. Both the subscription side (LISTEN) and the notification side (NOTIFY) SHALL derive this same channel from the family, so the doorbell is guaranteed to reach every entitled client. `team` is NOT a family: it is neither an entitlement key nor a synced entity type, and SHALL be excluded as a routing concept.

#### Scenario: Push accepted triggers SSE notification

- **WHEN** peaky-api accepts one or more events in a push batch
- **THEN** it builds the notification payload via `json.Marshal` (not string concatenation)
- **AND** it computes `family = entity.Family(entityType)` for each accepted event, collects the distinct family channels, and calls `pg_notify` once per distinct `sync:{family}:catalog` (deduplicated per family per batch, see the dedup scenario below)
- **AND** all SSE clients listening on that family channel receive a cursor-pointer message within one network RTT

#### Scenario: All synced families emit notifications

- **WHEN** an accepted event belongs to any synced family (review, product, or template)
- **THEN** a notification is emitted on that family's catalog channel
- **AND** no family is silently skipped — review, product, and template are all covered

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
