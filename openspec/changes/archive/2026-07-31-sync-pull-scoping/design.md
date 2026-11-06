## Context

The sync `pull` endpoint is the authorization boundary: it must return exactly the events an actor is entitled to. Today it has two gaps that are harmless with a single pull root (`review`) but become correctness/security failures the moment a second root exists:

- **[#53](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/53) (Problem A) — wildcard collapses the whole filter.** `pull.go` sets `entitled = nil; break` if any pull-root type resolves to `*`; `repo/postgres.go` then runs the query with no entity filter and returns every event of every type. This is currently load-bearing: products reach dev/admin clients *only* because those actors hold `review:*` and the nil-filter sweeps product events in.
- **[#83](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/83) (Problem B) — children don't ride along.** The filter is an exact `(entity_type, entity_id) IN (entitled roots)`. Entitlement `(review, review-001)` never matches child `(review_answer, review-001:q1)`. Scoped actors get a review's own fields but not its answers/notes; this is masked because demo personas hold `review:*`.

This change is the **foundation only**: it fixes both gaps and makes them testable by promoting `product` to a real pull root. It does **not** implement the Templates or Products feature (separate later efforts). The formal contract is `formal_verification/sync/root_scope_alignment.fizz` (pull-side invariants I1–I4), verified manually on <https://fizzbee.io/play> (the FizzBee runner is not yet approved at Adyen — see #29).

## Goals / Non-Goals

**Goals:**

- Stamp every accepted event with a resolved `(root_type, root_id)` at push time; reject events whose root cannot be resolved.
- Backfill `(root_type, root_id)` for all existing entity-scoped events.
- Replace the wildcard-collapse + exact-tuple filter with root-based, per-family wildcard scoping so children ride along and a wildcard in one family never widens another.
- Promote `product` to a pull root (+ authz) so cross-family non-leak is provable.
- Preserve current dev/admin visibility (no regression in what they sync).

**Non-Goals:**

- Templates as a pull root, template draft sync, server-authoritative publish (Sync Templates effort).
- Full product client lifecycle / CRUD flows (Sync Products effort).
- Any UI change, SSE change (family-scoped SSE already shipped), or conflict-resolution UX.

## Decisions

### D1: Resolve and stamp a root on every event

Add `entity.RootFor(entityType, entityID) (rootType, rootID string, ok bool)`:

- A **root type** (`review`, `product`, and — for forward-compat — `template`, `template_draft`) is its own root: `root = (type, id)`.
- A **child type** resolves to its parent root type and the `{rootId}` prefix of its composite id (`review-001:q1` → `review-001`). Children with no parseable `{rootId}:` prefix return `ok=false`.
- `ok=false` ⇒ push rejects the event with terminal reason `invalid_entity_id`; nothing is written. (`invalid_entity_type` is a separate, pre-existing rejection for entity types unknown to the registry, checked before `RootFor` even runs.)

We stamp the root on **all** events now (including any `template_draft*`), so when templates later become a pull root no second backfill is needed. Only `review` and `product` become *pull roots* in this change.

```text
entity            entity_type              entity_id          → root_type        root_id
-------------------------------------------------------------------------------------------------------------------------
review            review                   review-001         → review           review-001
answer            review_answer            review-001:q1      → review           review-001
product           product                  prod-1             → product          prod-1
draft question    template_draft_question  draft-7:q3         → template_draft   draft-7   (stamped, not yet a pull root)
malformed child   review_answer            q1 (no prefix)     → REJECTED (ok=false)
```

### D2: Per-family wildcard pull scoping (the fix for #53)

`pull.go` stops collapsing to `entitled = nil`. It builds two sets across the pull-root types:

```text
for each pullRootType in {review, product}:
    ids = authz.ViewableEntities(actor, pullRootType)
    if ids == ["*"]:  wildcardFamilies += pullRootType         # e.g. "review"
    else:             exactRefs += {(pullRootType, id) ...}    # e.g. (product, prod-1)
```

The repo filters on the **root**, not the entity:

```text
BEFORE (postgres.go):                       AFTER:
  WHERE (entity_type, entity_id)              WHERE ( root_type = ANY($wildcards)
         IN (entitled refs)                          OR (root_type, root_id) IN ($exactRefs) )
  -- and if entitled==nil: NO filter          -- empty scope ⇒ matches nothing (not everything)
  --   → returns ALL events of ALL types
```

Empty scope (no entitlements) now returns **zero** events — the inverse of today's "fetch everything" bug. Children ride along automatically because they carry their root's `(root_type, root_id)` (fix for #83).

### D3: Promote `product` to a pull root

`registry.go` adds `Product` to `pullRoots`. Authz already answers `ViewableEntities(actor, "product")` — the registry resolves any `entityType:*` or `entityType:id` entitlement generically.

**Seed reality (verified against `services/testdata/actors.json`):** every seeded actor (dev, admin, alice, bob, carol) ALREADY holds `product:*`. So removing the nil-collapse causes **no** product-visibility regression — dev/admin keep all products via their existing `product:*`. The fix additionally *corrects* the scoped actors: today alice/bob/carol pull only their reviews' root rows (missing children — Problem B) and receive **no** products at all (product was never a pull root, so their `product:*` was never consulted in pull). After the fix they correctly receive their reviews' children and all products.

### D4: Repo signature

`repo.PullEvents` takes a scope value instead of `entitled []EntitlementRef`:

```go
type PullScope struct {
    Wildcards []string   // root types fully visible (e.g. "review")
    ExactRefs []RootRef  // specific roots (RootRef{RootType, RootID})
}
```

`fake.go` mirrors the same predicate so unit tests and the Postgres path agree.

### D5: Entitlement personas (explicit, 1:1 with the FizzBee model)

Three scoping paths must be exercised, so the seed personas are made explicit. Every seed actor today holds BOTH `review:*`/scoped-review AND `product:*`, so none of them can prove single-family *sealing* — hence the two new personas below.

- **Wildcard cross-family (#53 repro) — no seed change:** `actor_bob` already holds `product:* + review:review-001` (review is scoped, not wildcard). After the fix he must receive every product **and** only `review-001` (plus its children), never `review-999`. He is the exact #53 reproduction (model actor `bob`).
- **Single-family wildcard sealing — new persona:** add `actor_reviewonly` entitled to `review:*` only (no product, no template). He must receive every review event and **zero** product/other-family events — the direct proof that the wildcard-collapse is gone (model actor `reviewonly`, invariant I3).
- **Exact within-family isolation — new persona:** add `actor_scoped` entitled to exactly `review:review-001` + `product:prod-1` (no wildcards). He must receive `prod-1` and `review-001` children, but never `prod-2` or `review-999` — proving the exact-ref path isolates roots *within* the product family too (invariants I1/I4).
- Requires **≥2 product roots with events** in the seed (`prod-1`, `prod-2`); add `prod-2` if only one exists today.
- dev / admin / alice / carol keep `product:*` unchanged — the regression guard.

## Testing strategy

```text
layer            what                                                          backing invariant
---------------  ------------------------------------------------------------  -----------------
unit (Go)        RootFor: roots own themselves; children split prefix;          (unit only — D1
                 malformed child → ok=false (push rejects)                      push guard, not modelled)
unit (Go)        scope predicate: wildcard-in-family, exact-ref, empty=none     I1, I3, I4
fake repo        PullEvents predicate parity with Postgres                      I1..I4
PG integration   backfill: every entity-scoped event gets a root; no nulls      (integration only)
PG integration   actor_bob (product:* + review:review-001) pulls children of    I2, I4
                 001, not 999  (#83 repro)
PG integration   actor_bob → all products + only review-001, never review-999   I1  (#53 repro)
PG integration   actor_reviewonly (review:* only) → all reviews, ZERO products  I3  (sealing)
PG integration   actor_scoped (product:prod-1 + review:review-001) → prod-1 +   I1, I4
                 review-001 children, never prod-2 / review-999
PG integration   dev/admin (review:* + product:*) visibility unchanged          regression guard
pagination       composite cursor still correct with root filter                existing
```

The four `root_scope_alignment.fizz` invariants (I1-I4, all pull-side) are verified manually on fizzbee.io/play and mapped to the integration tests above. The push-side root-resolution guard (D1) is covered by Go unit tests + the spec scenario, not by the model.

## Security Considerations

Reference: site/docs/development/walkthroughs/local-first/security.md

1. **New endpoint / event type?** No new endpoint. No new event type. The push path gains server-side root resolution; validation of the entity type already exists (`Knows`) and is extended to reject unresolvable roots.
2. **New browser storage?** No. Server-only change. Client SQLite schema gains generated-only `root_type`/`root_id` columns later (Templates effort), not here.
3. **Changes who can access data?** Yes — this is the core of the change, and the check is on the **server** in the SQL WHERE clause (not the UI). It tightens access: the wildcard-collapse leak (#53) is closed and scoped actors correctly receive their roots' children (#83). The non-leak is proven by integration tests reproducing #53/#83 and by FizzBee I1/I4.
4. **Renders user content?** No.
5. **New `window.*` globals?** No.

## Risks / Trade-offs

- **Visibility regression risk (LOW — verified):** the seed already grants `product:*` to every actor (D3), so removing the collapse loses no product visibility for dev/admin. A dedicated integration test still asserts dev/admin visibility is unchanged before/after as a guard.
- **Backfill on a large `events` table:** a single `UPDATE` over all rows. Mitigation: the resolution is a pure function of `(entity_type, entity_id)`, expressible as a set-based `UPDATE ... SET root_type = CASE ...`, run once in the migration; indexed afterward.
- **Unresolvable existing rows:** if a legacy child row has a malformed id, the backfill must fail loudly rather than leave a null root (a null root would be invisible to all pulls). Mitigation: backfill asserts zero remaining null roots among `entity_type IS NOT NULL` rows.
- **Two concepts that look alike:** SSE *family* (`channel.go Family`) ≠ pull *root type*. Templates route to the `template` SSE family but their pull root is the `template_draft`. Documented in `RootFor` so the Templates effort doesn't conflate them.

## Migration Plan

Single goose migration in `services/internal/dbmigrate/migrations`, applied at server start before serving:

1. `ALTER TABLE events ADD COLUMN root_type TEXT, ADD COLUMN root_id TEXT;`
2. Backfill set-based `UPDATE` for `entity_type IS NOT NULL` rows: root types map to themselves; known child types map to their parent root type + `split_part(entity_id, ':', 1)`.
3. Guard: `SELECT count(*) FROM events WHERE entity_type IS NOT NULL AND (root_type IS NULL OR root_id IS NULL)` must be 0, else the migration fails.
4. `CREATE INDEX events_root_idx ON events (root_type, root_id, time);`
5. Regenerate sqlc + Drizzle via `make gen:schemas` (the additive columns are generated-only client side).

**Cursor reset:** NOT required. Per-family wildcards preserve dev/admin visibility (D3), so no client needs to re-pull from zero; new pulls simply apply the corrected filter going forward. (Scoped human actors are test-only in this change.)

**Rollback:** Down migration drops `events_root_idx` and the two columns; revert the binary. No data loss (root columns are derived).

## Resolved Questions

- **`template` / `template_draft` pull roots — DEFERRED to Sync Templates.** This change *stamps* their roots (D1, forward-compat) but does NOT promote them to pull roots, keeping the foundation minimal and testable with review + product.
- **Product entitlements — made explicit (D5).** Existing actors keep `product:*`; `actor_bob` is the #53 wildcard cross-family repro; a new `actor_scoped` (`review:review-001` + `product:prod-1`) proves exact within-family isolation; seed carries ≥2 products.
