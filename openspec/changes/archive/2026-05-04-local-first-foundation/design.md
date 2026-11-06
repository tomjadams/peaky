## Context

Peaky currently has two useful but temporary properties:

1. The domain is already rich enough to justify a serious backend model: reviews, products, templates, rules, notes, attachments, history, future campaigns, and machine-driven automation.
2. The runtime is still effectively server-memory-first: mutable arrays and objects in `server/data/*` back the app, so every meaningful interaction still depends on the Nitro server being available.

That creates a gap between where the product is headed and how it behaves today.

```text
TODAY

Vue / Nuxt UI
   -> route-scoped composables
   -> Nitro REST endpoints
   -> server/data/* in-memory stores

Result:
- browser refresh survives
- server restart loses state
- network/server still in the critical path
- no true offline editing
- no real sync rehearsal yet
```

Stage 1 closes that gap without pretending production sync is solved.

```text
STAGE 1 TARGET

Vue / Nuxt UI
   -> domain composables
   -> reactive query layer
   -> local SQLite (WASM + OPFS + worker)
   -> local outbox + entitlement snapshot
   -> background sync client
   -> sync simulator endpoints (Nitro + in-memory server store)

Result:
- local database becomes the session source of truth
- instant UI for first-party edits
- offline and transient-outage resilience
- push/pull cursor protocol validated before Postgres exists
- PowerSync vs ElectricSQL decision deferred
```

```text
BEHAVIORAL INVERSION

Before
  user edit
    -> HTTP request
    -> Nitro mutation
    -> server memory changes
    -> response returns
    -> UI reflects success

After
  user edit
    -> local database commit
    -> UI reflects success immediately
    -> outbox queues remote sync
    -> background sync reconciles later
```

## Current implementation snapshot

The original design intent is now implemented more concretely than this file first described.

Use these walkthroughs as the source of truth for the as-built shape:

- `site/docs/development/walkthroughs/local-first/index.md`
- `site/docs/development/walkthroughs/local-first/architecture.md`
- `site/docs/development/walkthroughs/local-first/data-model.md`
- `site/docs/development/walkthroughs/local-first/authorization.md`
- `site/docs/development/walkthroughs/local-first/api.md`
- `site/docs/development/walkthroughs/local-first/auditing.md`

The highest-impact implementation deltas since this design was first drafted are:

- browser-local persistence now runs on SQLocal + SQLite WASM + OPFS with shared Drizzle schemas and shared SQL migrations
- products, templates, and reviews all support archive / restore, with permanent delete gated behind archived state plus typed confirmation
- authorization rules are now explicit enough to warrant their own walkthrough: product owners/admins, template owners/admins, reviewer/admin review controls, and admin-only access to the Admin Events surface
- auditing now includes a real `/admin/events` operator surface, SSE live tail, and merge logic that combines remote audit streams with browser-local pending events
- the API remains in a hybrid state: local-first foundations are in place, but review creation still uses product/team-scoped routes while lifecycle actions share `/api/reviews/:id`

Treat the rest of this document as the design rationale and migration record, with the walkthroughs carrying the freshest implementation detail.

## Goals / Non-Goals

**Goals:**

- Make reviews, products, and template drafts commit locally first
- Preserve local state across browser refresh and transient server outages
- Introduce a remote sync simulator that exercises the same future sync contract we expect to use with Postgres
- Introduce append-only audit events with visible provenance for machine-generated draft answers
- Introduce explicit lifecycle authorization and destructive-action safeguards that work in both local-first and server-authoritative paths
- Move review hydration toward a single workspace projection instead of many chatty assessment reads
- Keep `/teams` and `/products` as user-facing facades while steering the internals toward a shared review core
- Create walkthroughs and decision-log context in parallel with the proposal artifacts

**Non-Goals:**

- Choosing PowerSync or ElectricSQL in this change
- Shipping production Postgres sync, failover, WAL tuning, or durability guarantees
- Introducing CRDTs in Stage 1
- Shipping the full `/integrations/*` surface area
- Shipping first-class campaign UI in this change
- Replacing the current identity provider or service catalog in this change

## Decisions

### 1. Merge the old Stage 2 into Stage 1

The biggest immediate value is not just Drizzle schemas on the server. It is the full on-device loop that gives the app a Linear-like feel before production sync exists.

```text
Old plan                     Revised plan

Stage 1: schemas            Stage 1: schemas + local database + outbox + simulator
Stage 2: local database     Stage 2: Postgres-backed sync and production hardening
```

**Rationale:** without the local database, reactive query layer, and outbox, we still would not get instant UI or learn enough about sync semantics before Stage 2.

### 2. Drizzle is the schema backbone, not the local-first solution

Drizzle will define schemas, queries, and migrations for shared domain tables. It does not solve client-local persistence, outbox behavior, or sync.

Stage 1 therefore uses these layers together:

| Layer                | Role                                        |
| -------------------- | ------------------------------------------- |
| Drizzle              | shared schema, adapters, migrations         |
| SQLite WASM + OPFS   | browser-local durable store                 |
| reactive query layer | recompute local projections without polling |
| outbox               | queue local mutations for background sync   |
| sync simulator       | rehearse remote push/pull protocol          |

```text
STAGE 1 STACK

┌───────────────────────────── First-party browser runtime ─────────────────────────────┐
│ Vue / Nuxt pages                                                                      │
│    -> domain composables                                                              │
│    -> reactive query layer                                                            │
│    -> local SQLite (WASM + OPFS + worker)                                             │
│    -> outbox + entitlement snapshot                                                   │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │ shared schema + repository contracts
                              ┌─────────▼─────────┐
                              │ Drizzle backbone  │
                              └─────────┬─────────┘
                                        │ same domain model
                    ┌───────────────────▼────────────────────┐
                    │ Nitro sync simulator + remote memory    │
                    └───────────────────┬────────────────────┘
                                        │ later replaced by
                                        ▼
                              Postgres-backed sync in Stage 2
```

### 3. Canonical first-party state lives in the local database

Pinia is optional and must not become the canonical persisted domain store.

```text
GOOD
local SQLite -> reactive query layer -> composables -> UI

OPTIONAL
Pinia -> selections, filters, banners, sync-status UI

BAD
Pinia -> mirrors full domain tables and becomes a second source of truth
```

```text
READ / WRITE OWNERSHIP

screen load
  -> composable asks reactive query layer
  -> reactive query layer reads local SQLite
  -> UI hydrates from local state

user edit
  -> composable writes local SQLite
  -> projection recomputes
  -> UI updates immediately
  -> outbox queues remote sync

Pinia sidecar only
  -> filters
  -> selections
  -> banners
  -> sync-status chrome
```

**Rationale:** duplicating persisted domain state in Pinia creates drift, duplicated caching rules, and a harder migration to real sync.

### 4. Keep human-facing facades, evolve the internals toward a shared review core

Users will continue to think and navigate in terms of:

- Teams
- Products
- future Organizations

Stage 1 keeps those facades intact while the data model moves toward:

```text
Subject (team | product | organization)
   -> Review
   -> Template version(s)
   -> Current-state projections
   -> Audit events
```

```text
USER-FACING SURFACE                 INTERNAL SHARED CORE

/teams/* -----------------------\
/products/* ---------------------> subject(type = team | product | organization)
future /organizations/* --------/                 |
                                                 +--> review
                                                 +--> template selection(s)
                                                 +--> current-state projections
                                                 +--> audit events
```

We do not need to expose `/subjects/*` everywhere in the UI to benefit from that internal direction.

### 5. Review hydration moves toward a workspace projection

`workspace` is a screen-oriented read model, not a new business entity.

Instead of fetching review metadata, questions, pillars, answers, notes, permissions, and history through separate reads, Stage 1 will move the assessment flow toward a single projection shaped for the page.

```text
GET /reviews/:id/workspace

returns:
- review metadata
- subject metadata
- selected template version(s)
- questions and current answers
- notes and attachment metadata
- latest readiness or maturity details
- capabilities / permissions
- recent event-backed history entries
```

```text
HYDRATION SHAPE

Before
  review screen
    -> GET review
    -> GET questions
    -> GET pillars
    -> GET answers
    -> GET notes
    -> GET attachments
    -> GET permissions
    -> GET history

After
  review screen
    -> GET /reviews/:id/workspace
         -> review
         -> subject
         -> template versions
         -> questions + answers
         -> notes + attachments
         -> latest readiness / maturity details
         -> capabilities
         -> recent history
```

**Rationale:** this reduces endpoint chatter today and becomes a natural local projection later.

### 6. Use current-state tables plus append-only events

Stage 1 will model both:

```text
CURRENT STATE
- review_answer_state
- review_note_state
- review_attachment
- review_score_state

EVENT LOG
- review_event
```

```text
TWO MODELS, TWO JOBS

user or automation action
            |
            +--> append review_event -----------------------> audit trail / history / provenance
            |
            +--> update current-state rows -----------------> workspace / fast page reads

event log answers:   what happened?
current state answers: what is true now?
```

**Rationale:**

- current state keeps reads fast and simple
- event log gives CloudTrail-like auditability
- history can be derived from events instead of bespoke mutable session state
- automation provenance becomes first-class rather than bolted on

### 7. Sync simulator is a protocol rehearsal layer, not a fake production backend

The simulator must validate the future sync contract, not invent temporary CRUD semantics.

```text
Client                                  Nitro simulator

bootstrap  ---------------------------> returns actor + entitlements + cursors
push(events since local cursor) ------> accepts / rejects + advances remote cursor
pull(remote cursor) ------------------> returns events since cursor
```

```text
SYNC REHEARSAL LOOP

Client device                                         Nitro simulator

local DB + outbox                                     remote memory
clientCursor = c42                                    remoteCursor = r17
pending events = [e18, e19]

bootstrap ------------------------------------------> actor, entitlements, cursors
push(c42, [e18, e19]) ------------------------------> accept/reject + advance cursor
pull(after r17) ------------------------------------> [e18, e19] since cursor
local state converges <----------------------------- remote outcomes + new cursor

if simulator resets:
  client cursors become stale
  client re-bootstrap is allowed
```

Simulator properties:

- stores remote state in memory only
- may lose state on cold start
- is allowed to require re-bootstrap after reset
- is not a durability or resilience milestone

**Rationale:** this de-risks Stage 2 by validating the protocol and data model before Postgres exists.

### 8. Entitlements are cached locally and refreshed on reconnect

Stage 1 supports offline editing for several days by caching an entitlement snapshot derived from the authenticated user plus catalog-backed group and role resolution.

Reconnect policy:

```text
offline edit allowed by cached snapshot
      ↓
reconnect refreshes entitlements
      ↓
if access revoked:
  - data remains visible but read-only
  - unsynced edits move to a needs-review queue
  - audit events record the downgrade / review requirement
```

```text
ENTITLEMENT DRIFT

snapshot S1 says: edit allowed
        |
        +--> user keeps working offline
        +--> outbox accumulates unsynced events
        |
reconnect
        |
        +--> fetch fresh snapshot S2
                |
                +--> still allowed
                |      -> sync proceeds normally
                |
                +--> access revoked
                       -> keep data visible
                       -> mark resource read-only
                       -> move unsynced edits to needs-review queue
                       -> append downgrade / review audit event
```

Core tables and APIs keep provider-neutral names such as `actorId`, `groupId`, and `componentId`. Any provider-specific key shapes stay inside adapters and import metadata rather than leaking into first-party contracts.

### 8.1 Authorization and lifecycle governance are now first-class

This design originally treated authorization mostly as an entitlement-snapshot concern.
The implemented system now has a more explicit policy layer for lifecycle and operator behavior.

```text
products   -> product owners or admins may archive / restore / delete
templates  -> template owners or admins may archive / restore / delete
team reviews    -> reviewers or admins may archive / restore
product reviews -> product owners or admins may archive / restore
review delete   -> admins only
admin events    -> admins only
```

Permanent delete has a second guard beyond authorization:

```text
allowed actor
  + archived state
  + exact typed confirmation
  = destructive action allowed
```

That policy model now lives in the dedicated authorization walkthrough so it can evolve without overloading this design document.

### 8.2 Operator visibility exists now, not only as a future need

The original Stage 1 design talked about auditability as a model-layer capability.
The implementation now includes an operator-facing read surface:

- `GET /api/admin/events`
- `GET /api/admin/events/stream`
- `/admin/events`

That surface merges:

- lifecycle audit events
- review events
- browser-local pending events derived from the outbox

So the next design question is not whether Peaky should have an admin audit surface.
It is how rich that surface and surrounding authorization UX should become in later stages.

### 9. Selective replication is mandatory from the beginning

The local-first store must not default to "sync everything".

Stage 1 assumes:

- editable reviews / products / templates replicate fully
- broad discovery surfaces replicate metadata only
- component-based and organization-based targeting remain future-friendly

```text
REPLICATION TIERS

Tier A: full local copies
  - editable reviews
  - editable products
  - editable template drafts

Tier B: metadata only
  - discovery lists
  - search / filter indexes
  - high-level summaries

Tier C: fetch on demand or defer
  - broad history slices
  - portfolio analytics
  - bulky evidence artifacts
```

**Rationale:** this keeps browser startup, storage, and query costs bounded before Stage 2 expands the dataset.

### 10. Template collaboration stays structured and optimistic in Stage 1

We expect template collaboration to look like several people editing different pillars, questions, or rules far more often than several people doing free-form concurrent edits on the exact same unit.

```text
TEMPLATE AUTHORING SHAPE

template draft
  -> template metadata
  -> pillar rows
       -> question rows
  -> rule rows

Author A edits pillar A question
Author B edits pillar B rule
  -> both changes should sync independently
```

Stage 1 therefore assumes:

- template drafts are modeled as structured authoring units, not one monolithic blob
- pillars, questions, and rules keep stable IDs so non-overlapping edits can merge cleanly
- ordering uses durable position keys rather than raw array indexes so adjacent inserts do not force whole-draft conflicts
- optimistic locking plus audit-backed conflict review is the default strategy for same-entity collisions
- markdown import/export is the escape hatch for heavier external authoring workflows such as Google Docs-based drafting

```text
DEFAULT CONFLICT STRATEGY

different pillar / question / rule edits
  -> sync both changes

same question or same rule edited concurrently
  -> preserve both sides
  -> mark conflict explicitly
  -> show recommended resolution nudge

large external authoring session
  -> export markdown
  -> edit externally
  -> import markdown
  -> use the same conflict-marker + review flow when needed
```

CRDTs remain deferred unless this structured model stops being good enough in practice.

### 11. Hybrid API is the long-term contract

Shared, human-oriented APIs remain the primary first-party contract.

`/integrations/*` is reserved for machine-led automation and added only when a concrete consumer needs it.

```text
shared API
- reviews, products, templates, campaigns

/integrations/*
- readiness by component id
- machine draft answers
- automation jobs / exports
```

```text
API PLANES

humans / first-party UI  ----------> shared API ---------> reviews, products, templates, campaigns
machines / automation    ----------> /integrations/* ----> imports, readiness lookups, exports
local-first runtime      ----------> /sync/* ------------> bootstrap, push, pull
```

This change only lays the foundation for that split. It does not need to ship the entire integration surface.

### 12. Core naming stays provider-neutral

This design keeps provider names out of core table columns, API fields, and event data fields unless the provider itself is the subject of the data.

Naming rules:

- use `...Id` and `...Ids` for identifiers in Peaky's core model
- use simple domain names such as `componentId`, `groupId`, and `organizationId`
- keep provider-specific concerns in adapter code, sync imports, or integration metadata
- keep `actorId` as a stable principal identifier rather than encoding provider-prefixed values like `provider:username`

**Rationale:** this keeps the API easier to use, avoids locking the core schema to today's providers, and still leaves room to record source-provider metadata where it matters.

## Testing strategy

```text
┌─────────────────────────────────────────────────────────────┐
│ Stage 1 verification ladder                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Unit tests                                               │
│    - Drizzle schema helpers                                 │
│    - repository adapters                                    │
│    - projection builders                                    │
│    - outbox state transitions                               │
│                                                             │
│ 2. Nuxt API tests                                           │
│    - sync simulator bootstrap / push / pull                 │
│    - entitlement refresh and rejection semantics            │
│    - workspace response shapes                              │
│                                                             │
│ 3. UI / composable tests                                    │
│    - reactive query recomputation                           │
│    - local-first answer / product / template edits          │
│    - template adjacent inserts and ordering behavior        │
│    - conflict-marker and review guidance behavior           │
│    - pending-change review queue behavior                   │
│                                                             │
│ 4. E2E happy paths                                          │
│    - edit review offline, reconnect, sync                   │
│    - create/edit product locally first                      │
│    - edit template draft locally first                      │
│    - export/import template markdown with conflict review   │
└─────────────────────────────────────────────────────────────┘
```

The remote simulator lets us exercise multi-device and reconnect scenarios before Stage 2 production sync exists.

## Risks / Trade-offs

- **Browser storage complexity**: SQLite WASM + OPFS + worker setup is more complex than IndexedDB wrappers, but it better matches the relational domain model.
- **Simulator false confidence**: the in-memory remote rehearsal validates protocol and conflict semantics, not durability or operational resilience.
- **Stage 1 scope size**: merging the local database and simulator into Stage 1 increases surface area, but it unlocks the actual local-first value earlier.
- **Dual model cost**: current-state tables plus event log add model complexity, but they are the cleanest way to satisfy both fast UI reads and CloudTrail-like history.
- **Entitlement drift**: cached permissions always carry revocation delay. The read-only downgrade and review queue make the trade-off explicit.

## Migration Plan

1. Introduce shared Drizzle schemas and repository boundaries while preserving existing facades.
2. Add client-local SQLite, reactive query layer, and outbox for first-party editing domains.
3. Add workspace projections and event-backed history read models.
4. Add simulator bootstrap / push / pull endpoints backed by in-memory remote state.
5. Move review, product, and template draft editing flows to local-first reads and writes.
6. Add entitlement snapshots and reconnect downgrade behavior.
7. Keep PowerSync vs ElectricSQL and Postgres-backed sync for Stage 2.

```text
MIGRATION LADDER

today
  -> shared Drizzle schemas + repositories
  -> local SQLite + reactive queries
  -> workspace projection + event-backed history
  -> sync simulator endpoints
  -> local-first review / product / template flows
  -> entitlement snapshots + reconnect downgrade
  -> Stage 2 Postgres-backed sync

fallback during Stage 1
  -> existing Nitro routes + in-memory adapter remain available
```

Rollback is straightforward during Stage 1 because the existing Nitro routes and in-memory data layer remain available as the fallback adapter while the local-first path is introduced incrementally.

## Open Questions / Resolved Follow-Ups

### Resolved during implementation

| Topic | Current answer |
| --- | --- |
| sync engine choice for Stage 2 | still intentionally deferred at the architecture level; Stage 1 stays sync-engine neutral |
| cross-tab support | required; the local-first client is not designed as a single-tab-only system |
| campaign entities | deferred to a separate governance-focused change |
| authorization walkthrough | split into its own walkthrough because the policy layer is now large enough to evolve independently |

### Still open

| Topic | Why it remains open |
| --- | --- |
| pending-publish template flow | current implementation keeps publish server-authoritative; future offline publishing semantics still need product and UX design |
| richer admin/operator visibility | `/admin/events` exists now, but ownership visibility, grouped drilldowns, and policy explainability are still early |
| long-term review route shape | implementation still uses product/team-scoped create routes even though the internal design is moving toward a shared subject core |
