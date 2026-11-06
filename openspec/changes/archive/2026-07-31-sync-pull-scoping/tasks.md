> WORKING AGREEMENT — MILESTONE STOPS
> Implementation pauses at a HUMAN CHECKPOINT after EVERY task group (1-7). At each
> checkpoint the agent STOPS, summarises what changed + how it was tested (commands +
> results), and waits for the user's manual validation before starting the next group.
> No group is begun while the previous checkpoint is unconfirmed. A commit is created
> at the end of each validated group. The final gate (group 8) and the human sign-off
> there still apply before opening the MR.

## Prerequisites

> Issue: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/53> (Problem A) · <https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/83> (Problem B)
> MR: _to be created at the end of the human validation gate_

- [x] 0.1 Load `glab` skill before any GitLab task
- [x] 0.2 Issues describing the problem + approach exist (#53, #83; both under Epic #3 "Sync Engine")
- [x] 0.3 Feature branch `fix/sync-pull-scoping` created off `main`

## 1. Schema + backfill migration

> dependencies: none (first)

- [x] 1.1 Add `root_type TEXT`, `root_id TEXT` to `events` in `services/schema.sql`; add `CREATE INDEX events_root_idx ON events (root_type, root_id, time)`
- [x] 1.2 New goose migration in `services/internal/dbmigrate/migrations`: add columns; set-based backfill `UPDATE` for `entity_type IS NOT NULL` (root types → self; known child types → parent root type + `split_part(entity_id, ':', 1)`); create index
- [x] 1.3 Migration guard: fail loudly if any `entity_type IS NOT NULL` row has a null `root_type`/`root_id` after backfill
- [x] 1.4 Write the Down migration (drop index + both columns)
- [x] 1.5 `pnpm gen:schemas` to regenerate Drizzle SQLite types + client SQLite migration `0014_events_root_refs.sql`; run `pnpm db:migrations:embed` to refresh the embedded migration bundle in `shared/db/migrations/sqlite-content.ts`; confirm all tests green
- [x] 1.6 **HUMAN CHECKPOINT** — user validated schema + migration (apply up/down, backfill guard, drift gate)

## 2. Root resolution + push stamping

> dependencies: group 1

- [x] 2.1 (RED) Unit tests for `entity.RootFor(type,id)`: root types own themselves; review/template_draft children split the `{rootId}:` prefix; malformed child → `ok=false`
- [x] 2.2 (GREEN) Implement `entity.RootFor` in the `entity` package; document SSE-family vs pull-root-type distinction
- [x] 2.3 Push handler resolves the root and rejects `ok=false` with terminal `invalid_entity_id` (no `events`/`field_versions` rows written)
- [x] 2.4 Persist `(root_type, root_id)` on the `events` INSERT in `repo/postgres.go` (and the fake repo); updated seed SQL to stamp roots on seed events
- [x] 2.5 **HUMAN CHECKPOINT** — stop; user validates `RootFor` + push stamping/rejection (unit tests green) before group 3

## 3. Per-family pull scoping (fixes #53 + #83)

> dependencies: groups 1, 2

- [x] 3.1 (RED) Unit tests for the scope predicate: wildcard-in-family matches the family; exact ref matches only that root; empty scope matches nothing
- [x] 3.2 (GREEN) Rework `pull.go`: remove the `entitled = nil; break` collapse; build `PullScope{Wildcards, ExactRefs}` across pull-root types
- [x] 3.3 Rework `repo/postgres.go pullEventRows`: filter on `root_type = ANY($wildcards) OR (root_type, root_id) IN ($exactRefs)`; preserve composite-cursor pagination; empty scope returns zero rows
- [x] 3.4 Mirror the predicate in `repo/fake.go` so unit + integration paths agree; `SeedEvent` stays explicit (callers set `RootType`/`RootID`); integration `seedEvent` helper resolves via `entity.RootFor`; updated all call sites
- [x] 3.5 **HUMAN CHECKPOINT** — stop; user validates per-family pull scoping rework (collapse removed, predicate, cursor pagination) before group 4

## 4. Product as a pull root + authz

> dependencies: group 3

- [x] 4.1 Add `Product` to `pullRoots` in `entity/registry.go`
- [x] 4.2 Ensure `authz.ViewableEntities(actor, "product")` resolves correctly (`resourceFor` / authorizer)
- [x] 4.3 Verify the seed already grants `product:*` to all actors (no change needed for dev/admin); confirm `ViewableEntities(actor,'product')` resolves both wildcard and scoped (`product:prod-1`)
- [x] 4.4 Push still rejects client-pushed events for types that are not legal client roots (no behavior change for product/review)
- [x] 4.5 **HUMAN CHECKPOINT** — stop; user validates product pull root + authz resolution before group 5

## 5. Test surface (no template machinery)

> dependencies: groups 1-4

### 5A. Server-side predicate coverage (Go, runs in CI)

- [x] 5.1 Add personas to `services/testdata/actors.json`: `actor_reviewonly` (`review:*` only, no product/template) and `actor_scoped` (`review:review-001` + `product:prod-1`, no wildcards); ensure ≥2 product roots (`prod-1`, `prod-2`) have seeded events (add `prod-2` if missing). `actor_bob` (`product:*` + `review:review-001`) is the existing #53 wildcard repro persona
- [x] 5.2 PG integration: backfill correctness (every entity-scoped event has a non-null root; zero nulls)
- [x] 5.3 PG integration: scoped actor pulls children of `review-001` (answers/notes) and NOT `review-999` (#83 repro)
- [x] 5.4 PG integration: `actor_bob` (`product:*` + `review:review-001`) returns all products + only `review-001` (+children), never `review-999` (#53 repro)
- [x] 5.5 PG integration: `actor_reviewonly` (`review:*` only) returns all reviews and ZERO product events (single-family wildcard sealing, I3)
- [x] 5.6 PG integration: `actor_scoped` (`product:prod-1` + `review:review-001`) returns `prod-1` + `review-001` children, never `prod-2` or `review-999` (exact within-family isolation)
- [x] 5.7 PG integration: dev/admin visibility unchanged before/after (regression guard)
- [x] 5.8 Property/unit test for the scope predicate against the fake repo
- [x] **HUMAN CHECKPOINT (5A)** — stop; user validates server-side predicate coverage (personas, #53/#83 repros, regression guard, fake-repo property test) + commit before 5B

### 5B. Persona scoped-pull e2e (reusable helper, ported from MR !29 `f13bb6b6`)

> Extracts the persona multi-client pattern from `f13bb6b6:tests/e2e/template-product-sync.spec.ts` into a reusable, Cedar-forward helper. Assertions are phrased as entitlement-scoped visibility ("actor A writes X; actor B sees / does not see X"), not template-specific — this is the contract Cedar authorization will need automated coverage for.

- [x] 5.9 Extract reusable persona helper to `tests/e2e/helpers/personas.ts`: `personaPage(browser, persona)` (new context + `peaky:current-actor` init script + `awaitSeedReady`), `awaitSeedReady`, `syncNow` (drains outbox — bg tabs are timer-throttled), `hasLocalRow(page, table, needle)` (generalized from `hasLocalQuestionText`), and `expectSees` / `expectDoesNotSee(persona, table, needle)` scoped-visibility wrappers. `PERSONAS` registry mirrors `services/testdata/actors.json` (`actor_reviewonly`, `actor_scoped`, `actor_bob`, `dev`/`admin`)
- [x] 5.10 Confirm `app/plugins/test-seed.client.ts` exposes the mutations the personas need (`syncNow`, `saveAnswer`, `createReview`, `createProduct`); extend the bridge if any are missing
- [x] 5.11 New gated spec `tests/e2e/sync-scoped-pull.spec.ts` (`test.skip` unless `PEAKY_E2E_SYNC_STACK=1`; `mode: serial`); review/product only, no template machinery. Header documents the env var + `make test:e2e:sync`
- [x] 5.12 e2e #53 repro: `actor_bob` (`product:*` + `review:review-001`) sees all products + `review-001` children after sync, never `review-999`
- [x] 5.13 e2e #83 repro: `actor_scoped` (`review:review-001` + `product:prod-1`) sees `review-001` children, never `review-999` or `prod-2`
- [x] 5.14 e2e sealing + write→see loop: `actor_reviewonly` sees all reviews + ZERO products; an entitled writer changes a `review-001` answer → `actor_scoped` sees it; a write on `review-999` → `actor_scoped` does NOT see it
- [x] 5.15 Add `make test:e2e:sync` target (sets `PEAKY_E2E_SYNC_STACK=1`, runs the gated spec against the `make watch` stack); add to `make help`
- [x] 5.16 **HUMAN CHECKPOINT (5B)** — user validated; 3/3 tests passed (8.7s)

## 6. FizzBee reconciliation

> dependencies: groups 1-5 (wording must match shipped behavior)

- [x] 6.1 Reconcile `formal_verification/sync/root_scope_alignment.fizz` to the specs: pull-only invariants I1-I4 (push-side root guard dropped → unit test); third family renamed generic "other"; actors `bob`/`reviewonly`
- [x] 6.2b Re-confirm the model still matches the shipped predicate after implementation (no code drift)
- [x] 6.2 Keep `formal_verification/sync/template_publish_lifecycle.fizz` PARKED (NOT part of this MR; belongs to Sync Templates)

## 7. Docs

- [x] 7.1 Update `site/docs/development/decisions.md` (root-ref + per-family pull scoping; SSE-family vs pull-root distinction)
- [x] 7.2 Update `site/docs/product_changelog.md` (root `CHANGELOG.md` is git-cliff auto-generated)
- [x] 7.3 Update `site/docs/development/testing.md` — document `make test:e2e:sync` target, `EXTRA_ARGS` pattern (`--headed`, `--reporter=list`), and the persona e2e helper workflow
- [x] 7.4 **HUMAN CHECKPOINT** — user validated docs

## 8. Human validation gate + reviewers (BEFORE commit/MR)

> The MR is NOT opened until this gate passes.

- [x] 8.1 `make mr` green (lint, docs, typecheck, audit, unit, integration)
- [x] 8.2 Run `/merge-check` — DONE: multiple rounds run across the branch's life; final attestation `attestations/mr-110.md` (commit `9379dc4f`, 2026-07-03) — 11 reviewers, 0 block/warn/info, outcome-verifier 12/12 criteria mapped, discrimination 3/3 killed, verdict APPROVE.
- [x] 8.3 **HUMAN GATE**: user verifies `root_scope_alignment.fizz` on <https://fizzbee.io/play> (no counterexample) and reviews specs/design/tasks + the diff — PASSED (5 nodes, IsLive:true, 2026-07-02)
- [x] 8.4 **HUMAN GATE**: user runs CodeRabbit; address findings — DONE: CodeRabbit round 6-9 fixes applied (commits `af055c0c`..`05228bdc`), including the `invalid_entity_id` rejection-reason split (see Known Gaps below).
- [x] 8.5 User sign-off → commit the attestation (follow-up commit) and open the MR — DONE: MR !110 opened, reviewed, and merged (`Closes #53`, `Closes #83`); both issues closed.

## Housekeeping

- [x] Run `make mr` — DONE, see 8.1 (duplicate of 8.1, kept for the pre-`/merge-check` gate ordering).
- [x] Update decision log `site/docs/development/decisions.md` — DONE, see 7.1 (duplicate entry, same evidence).
- [x] Update GitLab issues #53 and #83 with task completions — DONE via MR !110's `Closes #53`/`Closes #83`; both issues are `state: closed`.

## Manual tasks

- [x] FizzBee: verify `root_scope_alignment.fizz` on <https://fizzbee.io/play> — DONE, duplicate of 8.3 (same evidence).
- [x] CodeRabbit review (not yet instrumented in CI — run manually) — DONE, duplicate of 8.4 (same evidence).

## Known Gaps (resolved)

- [x] **Spec-text drift**: `design.md` and `specs/sync-engine/spec.md`'s "unresolvable root" scenario said the push handler rejects with `invalid_entity_type`, but shipped `push.go` uses the distinct `invalid_entity_id` reason for that case (`invalid_entity_type` is a separate, earlier check for entity types unknown to the registry). Corrected in `design.md`, `specs/sync-engine/spec.md`, and task 2.3 above (2026-07-31).
