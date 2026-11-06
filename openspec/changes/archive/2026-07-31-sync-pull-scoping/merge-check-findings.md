# /merge-check findings — MR !110 (fix/sync-pull-scoping)

Working tracker for the round dispatched after rebasing onto `main@8fb570f4`
(which includes the human-acknowledged override feature). Base: `origin/main`.

11 reviewers dispatched: docs-dev-reviewer, docs-product-reviewer, go-reviewer,
go-test-reviewer, outcome-verifier, postgres-reviewer, security-reviewer,
sqlite-reviewer, ts-reviewer, ts-test-reviewer, ux-reviewer.

Clean APPROVEs (0 findings, not tracked below): docs-dev-reviewer,
docs-product-reviewer, sqlite-reviewer, ts-reviewer, ts-test-reviewer, ux-reviewer.

Status legend: `[ ]` not started · `[~]` fixed, awaiting human confirmation ·
`[x]` confirmed by human.

---

## IN-SCOPE (introduced by this MR — must fix)

### F1 — sqlc-generated types stale vs schema (go-reviewer)

- [ ] Status
- **Files:** `services/internal/syncengine/db/models.go`, `services/internal/syncengine/db/queries.sql.go`
- **Issue:** `RootType`/`RootID` generated as `sql.NullString`, but `services/schema.sql` declares both columns `TEXT NOT NULL`. Generated code predates the NOT NULL fix.
- **Fix:** re-run `make gen:sqlc` so generated types become plain `string`.

### F2 — Migration 005 backfill guard gap for NULL `entity_type` rows (postgres-reviewer)

- [ ] Status
- **File:** `services/internal/dbmigrate/migrations/005_add_events_root_refs.sql`
- **Issue:** The backfill `UPDATE` and the guard `SELECT count(*)` both filter on `entity_type IS NOT NULL`, but `entity_type` is nullable (confirmed: other events queries elsewhere filter `entity_type IS NOT NULL`, implying NULL-entity_type rows exist — e.g. system events). Those rows never get `root_type`/`root_id` backfilled, so `ALTER COLUMN root_type SET NOT NULL` fails on them with a raw Postgres constraint error instead of the intended guard message.
- **Fix:** decide + implement a resolution for NULL-`entity_type` rows (e.g. stamp a synthetic `root_type='system'` row, or extend the guard to catch and report them explicitly before the `ALTER COLUMN` runs).

### F3 — `fake.go` cursor comparison doesn't match Postgres composite-cursor semantics (go-reviewer)

- [ ] Status
- **File:** `services/internal/syncengine/repo/fake.go`
- **Issue:** `PullEvents` filters with lexicographic `ev.PushedAt <= after` string compare; the real `postgres.go` implementation uses tuple comparison `(time, id) > ($1, $2)`. At timestamp ties the two repos disagree, which can mask cursor-boundary bugs in unit tests that only exercise the fake.
- **Fix:** align the fake's comparison with the composite `(time, id)` semantics.

### F4 — Dead `uuid.New()` noop + unused import (go-reviewer / go-test-reviewer, duplicate finding)

- [ ] Status
- **File:** `services/internal/syncengine/repo/postgres_integration_test.go:823` (`seedEvent`)
- **Issue:** `_ = uuid.New() // ensure import is used` — a leftover artifact keeping an otherwise-unused `github.com/google/uuid` import alive.
- **Fix:** remove the noop line and the `uuid` import.

### F5 — Non-deterministic `time.Now()` in 6 new integration tests (go-test-reviewer)

- [ ] Status
- **File:** `services/internal/syncengine/repo/postgres_integration_test.go`
- **Tests:** `TestPostgres_PullEvents_RootsNeverNull`, `TestPostgres_PullEvents_ScopedReview_ChildrenOnly`, `TestPostgres_PullEvents_BobWildcardProduct_ScopedReview`, `TestPostgres_PullEvents_ReviewOnlySealedFromProducts`, `TestPostgres_PullEvents_ScopedExactIsolation`, `TestPostgres_PullEvents_DevAdminSeesAll` (all new, confirmed via `git diff --name-only`)
- **Issue:** each seeds event times via `time.Now()` / `time.Now().Add(...)` — non-deterministic test input.
- **Fix:** replace with a fixed reference time (e.g. a package-level `time.Date(...)` constant) so seeded orderings are deterministic and reproducible.

### F6 — `TestPush_StampRootOnAcceptedEvent` missing product-root coverage (go-test-reviewer)

- [ ] Status
- **File:** `services/internal/syncengine/handler_test.go` (new test)
- **Issue:** Only exercises `review`/`review_answer` root stamping; this MR promotes `product` to a pull root but the handler-level stamping test doesn't cover it.
- **Fix:** add a `product` root-stamping case to the same test (or a sibling test).

### F7 — Seed data missing second product root `prod-2` (outcome-verifier)

- [ ] Status
- **File:** `services/internal/dbmigrate/seed/001_demo_data.sql`
- **Issue:** tasks.md / design.md call for ≥2 seeded product roots (`prod-1`, `prod-2`) so cross-product scoping is demonstrable in `make watch` dev runs. Only `prod-1` is seeded; tests work around this by seeding `prod-2` directly, but the demo data doesn't reflect the design.
- **Fix:** add a second product event row for `prod-2` to the seed SQL.

### F8 — Weak assertion in `TestRegistry_ViewableEntities_Review_Scoped` (go-test-reviewer)

- [ ] Status
- **File:** `services/internal/authz/registry_test.go` (new test)
- **Issue:** Only asserts `len(ids) == 2`, not that the IDs are actually `review-001`/`review-002`. A bug returning the wrong 2 IDs would pass.
- **Fix:** assert on the actual ID values (e.g. `ElementsMatch` or explicit equality).

---

## OUT-OF-SCOPE (pre-existing or false positive — banking, not fixing in this MR)

### O1 — 4 mis-tagged BLOCKs on pre-existing tests (go-test-reviewer)

- **Tests:** `TestPush_RejectsFuturePushedAt` (`handler_test.go:1113`), `TestPostgres_PullEvents_EntitlementScoping` (×2 `time.Now()` calls, lines 220-221), `TestPostgres_PullEvents_FieldVersionsAttached` (line 317)
- **Verified:** `git diff origin/main...HEAD -- <file> | grep '^+func Test'` shows none of these functions are added/modified by this MR — all pre-existing, already used `time.Now()` before this MR.
- **Disposition:** pre-existing test debt, not introduced by this MR. Bank as a follow-up issue (non-deterministic time in the existing sync test suite).

### O2 — File-size WARNs on `handler_test.go` / `postgres_integration_test.go` (go-test-reviewer)

- **Verified:** `handler_test.go` was 1581 lines and `postgres_integration_test.go` was 636 lines on `origin/main` **before** this MR — both already over the 500/600-line thresholds. This MR added to already-oversized files (1655 / 825 lines after) but didn't create the violation.
- **Disposition:** pre-existing size debt. Bank as a follow-up (split by domain/scenario).

### O3 — `testHelpersEnabled` public runtime-config gate vs `import.meta.dev` (security-reviewer)

- **Verified:** `git show origin/main:app/plugins/test-seed.client.ts` shows the exact same `useRuntimeConfig().public.testHelpersEnabled` gate already existed before this MR. `useSyncClient.ts` (this MR) just extends the same established convention — it was explicitly requested in an earlier /merge-check round to match `test-seed.client.ts`'s existing pattern.
- **Disposition:** pre-existing architectural decision, not a new risk introduced by this diff. Bank as an advisory note if the team wants to reconsider the pattern repo-wide.

### O4 — Global mutable maps in `root.go` — false positive (go-reviewer)

- **Verified:** the identical package-level `var x = map[...]bool{...}` idiom already exists in the same package: `entity/channel.go:12` (`families`) and `entity/registry.go:39` (`validOps`), both pre-existing this MR.
- **Disposition:** matches established codebase convention. No fix needed — dismissed.

### O5 — authz `resourceFor` / `entity.RootFor` mismatch for `template_draft` (go-reviewer)

- **Issue:** `authz/resource.go` maps `template_draft` → `"template"` resource, while `entity.RootFor` stamps `template_draft` as its own root type. Latent inconsistency.
- **Verified:** neither `authz/resource.go` nor its resourceFor mapping is touched by this diff; the MR's own code comments explicitly defer `template_draft` becoming a pull root to the future "Sync Templates" effort.
- **Disposition:** pre-existing, out of scope. Bank as a follow-up for when `template_draft` becomes a pull root.

### O6 — tasks.md wording "Update CHANGELOG.md" (outcome-verifier F3)

- **Verified:** root `CHANGELOG.md` is git-cliff auto-generated (see `.factory/merge-check.yml`'s `attestation_exempt` comment); the hand-written entry lives in `site/docs/product_changelog.md`, which **was** updated by this MR.
- **Disposition:** not a gap, just imprecise task wording. No code fix needed (optionally reword tasks.md 7.2 for clarity — cosmetic, deferred).

### O7 — outcome-verifier C57 (CodeRabbit not yet run)

- **Disposition:** expected — Group 8 workflow step that happens after /merge-check. Not a finding, just the next step in the process.

---

## Plan of execution

For each IN-SCOPE finding (F1–F8), in order:

1. Explain what the finding means and why it matters.
2. Implement the fix.
3. **Stop and wait for explicit human confirmation** that the fix matches the finding's intent before moving to the next one.
4. Commit only when explicitly told to (grouping decided together — not necessarily one commit per finding).

OUT-OF-SCOPE items (O1–O7) are not fixed in this MR. They'll be banked via the
`/merge-check override` human-acknowledged mechanism (or filed as follow-up
issues) once all IN-SCOPE findings are resolved, ahead of the final attestation.
