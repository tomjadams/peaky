## Why

Peaky's current first-party UX still depends on Nitro server memory and route-scoped APIs for canonical state. That works for a pre-production mock backend, but it leaves the network and server availability in the critical path for everyday work. It also means the app cannot yet deliver the instant, resilient experience we want when the future remote Postgres service has weak failover characteristics or brief outages.

At the same time, we already know the long-term direction:

- editable first-party data must work local-first
- the app will keep human-oriented shared APIs and add `/integrations/*` case by case for machine-led automation
- reviews need a shared core that can span teams today and products or organizations later
- auditability must become CloudTrail-like, with visible provenance for machine-generated draft answers

We need a Stage 1 that gives us the local-first foundation now, before choosing PowerSync vs ElectricSQL and before introducing production Postgres sync.

## What Changes

1. Introduce a **local-first foundation** for first-party editing flows (reviews, products, template authoring) using a client-local database, reactive query layer, local outbox, and entitlement snapshots.
2. Add a **non-production remote sync simulator** backed by in-memory server state so we can validate push/pull cursors, outbox behavior, entitlement refresh, and multi-device semantics before Stage 2 production sync.
3. Introduce an **append-only audit/event model** with actor provenance, machine-generated answer provenance, and history derived from events instead of bespoke mutable session storage.
4. Reshape the review architecture toward a **shared review core** behind existing `/teams` and `/products` facades, including a `workspace` read model for full assessment hydration.
5. Keep the architecture **sync-engine neutral** in Stage 1 while explicitly preferring structured optimistic template collaboration over CRDTs, including markdown import/export for heavier authoring workflows.
6. Add **lifecycle governance and operator visibility** through owner/admin authorization rules, archive/restore/delete flows, audit paper trails, and a minimal Admin Events surface with live-tail support.
7. Create walkthroughs in parallel with the OpenSpec artifacts so the local-first architecture, data model, authorization model, API shape, and audit model survive context resets.

## Capabilities

### New Capabilities

- `local-first`: On-device persistence, reactive query projections, outbox-based background sync, selective replication boundaries, entitlement snapshots, and a non-production sync simulator
- `auditing`: Append-only audit events, user vs integration actor tracking, visible automation provenance, and event-derived review history
- `authorization`: owner/admin lifecycle rules, reviewer-specific review governance, typed confirmation for destructive actions, and admin-only operator access to audit surfaces

### Modified Capabilities

- `assessment`: Answering and progress flows become local-first, with immediate local commits and queued sync
- `reviews`: Review hydration moves toward a workspace projection and shared core model while preserving existing team/product facades
- `products`: Product create/edit flows become local-first for editable products while retaining linked component lookups from the external catalog
- `template-studio`: Template draft authoring becomes local-first through structured template units and markdown import/export, with publishing remaining an explicit server-authoritative action
- `admin-visibility`: Admin Events now exposes merged lifecycle/review activity plus browser-local pending events for operators

## Impact

- **Client architecture**: new local persistence layer, reactive query layer, local outbox, entitlement cache, and workspace projections
- **Backend architecture**: repository boundary, event-backed sync simulator endpoints, lifecycle actor parsing on the server, and in-memory remote state for protocol rehearsal
- **Domain model**: shared review core, audit events, current-state projections, subject-oriented ownership direction, lifecycle states, explicit sync metadata, provider-neutral IDs in core records, and structured template authoring units
- **API surface**: staged move toward human-oriented shared routes plus future `/integrations/*`, with sync contracts validated early through the simulator and admin audit routes added for operator visibility
- **Documentation**: walkthroughs for local-first architecture, data model, authorization, API, and auditing; decision log updated with the staged local-first direction
