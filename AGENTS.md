<coding_guidelines>

## Rules

The `.factory/` harness — rules, skills, commands, and adversarial droids — is the [RTF Harness](https://containers.pages.is.adyen.internal/rtf/harness/), synced by agent-marketplace (gitignored; run `direnv allow` once to bootstrap it at user scope).

Follow the conventions in `.factory/rules/`, mandatory for every interaction:

- **Token Efficiency**: `.factory/rules/token-efficiency.md` — tool selection, read strategy, summary rules

MRs are also governed by the shared [CI Automation](https://containers.pages.is.adyen.internal/ci-automation/) GitLab components (title, size, labels, issue traceability); config lives in `.gitlab/ci-automation.yaml`.

---

## Make commands

We use `make` to automate routine tasks. Run `make help` for the full list.

**Quality gate (run before every MR):**

- **mr** / **pr**: Run all quality gates — OpenSpec → TypeScript lint → docs → typecheck → audit → unit tests → Go format/lint/tests → integration tests
- quality: Same as `mr` without the success banner
- openspec-validate: Strictly validate all live specifications and active changes with the project-pinned OpenSpec CLI

**Linting and formatting:**

- lint: Run oxlint (correctness + suspicious + perf + complexity) then ESLint (+ security plugin)
- lint-fix: Run oxlint and ESLint with auto-fix
- lint-docs: Lint markdown docs with rumdl
- typecheck: Run TypeScript type checking (nuxt typecheck)
- audit: Check dependencies for known vulnerabilities (pnpm audit --prod)

**Testing:**

- test: Run unit tests (fast, ~16s)
- test:coverage: Run unit tests with coverage report and ratchet thresholds
- test:integration: Run selected Node integration tests
- test:e2e: Run functional E2E tests (Playwright, chromium, ~3m)
- test:a11y: Run accessibility tests
- test:all: Run all tests (unit + integration + E2E + a11y)

**Formal verification** (not in `make mr`; needs `brew install fizzbee` — see the [walkthrough](site/docs/development/walkthroughs/formal-verification.md)):

- verify: Model-check every `formal_verification/**/*.fizz` spec (~70s)
- `verify/<subfolder>/<name>`: Check one spec
- verify-mbt: Replay traces from a spec's state space against the real implementation (needs `brew install fizzbee-mbt`)

A passing `verify` proves the *model* consistent; it never reads the code. `tests/guards/spec-drift.test.ts` (runs in `make test`, no tooling needed) and `verify-mbt` are what tie specs to the implementation.

**Development:**

- dev: Bootstrap dev environment
- watch: Hot-reload server (and clean previous build artifacts)
- build: Build binary
- preview: Preview production build
- clean: Clean build artifacts (.nuxt, .output, dist)
- docs: Serve documentation site (Zensical)
- docs-build: Build documentation site for deployment

**Git hooks (automatic):**

- pre-commit: lint-staged (oxlint → eslint → oxfmt on staged code, rumdl on staged markdown), Go and Python gates, and the threat-model drift guard when a mirrored source is staged
- pre-push: intentionally empty — the full quality gate is `make mr`, enforced again by CI

## GitLab issues (`glab`)

Use `/new-work` (`.factory/commands/new-work.md`) to draft and file work items; it picks the right template from `.gitlab/issue_templates/` and asks for consent before posting. Prefer `glab` subcommands over hand-built `glab api` payloads. Two things that will bite you otherwise:

- **`glab issue create --epic` takes the epic's global `id`, not its `iid`.** `--epic 6` files under the epic whose `id` is 6, which is `iid` 5. Resolve it first: `glab api "/groups/containers%2Frtf/epics/<iid>" | jq .id`. To fix after the fact: `glab api --method PUT "/projects/4174/issues/<iid>" -F epic_id=<global-id>`.
- **`glab api --method POST /projects/4174/issues` with `--input <json>` returns 401** on the standard local setup, while GETs and `PUT … -F key=value` on the same token work. Don't debug it — use `glab issue create`.
- **Never use `glab mr create -i <issue-iid>` to link an existing work item.**
  On this GitLab instance it creates a draft MR from an issue-derived branch
  instead of the branch you pushed. Create from the pushed branch and add
  `Closes #<issue-iid>` to the MR description instead.

Project is `containers/rtf/peaky`, id `4174`. Security findings belong under Epic `#6 Peaky | Beta: Security Review`.

## TL;DR - Read These Files by Task Type

| Task Type                 | Read This File                                                | Key Patterns                                                                                                                    |
| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Vue components            | `site/docs/development/vue.md`                                | Script setup order, computed for derived state, component extraction signals                                                    |
| TypeScript modules        | `site/docs/development/typescript.md`                         | ES2024 patterns (??, ?., toSorted), nullish coalescing, copy-on-write                                                           |
| UI styling — brand tokens | `DESIGN.md`                                                   | Hex values, type scale, spacing, component token specs (YAML front matter)                                                      |
| UI styling — patterns     | `site/docs/development/visual-design.md`                      | Semantic colors, Vue code examples, component patterns, anti-patterns                                                           |
| API routes                | `site/docs/development/walkthroughs/codebase/contributing.md` | Nitro server routes, worked example, Zod validation                                                                             |
| Writing tests             | `site/docs/development/testing.md`                            | Red/Green/Refactor TDD, test naming, anti-patterns                                                                              |
| OpenSpec workflow         | `site/docs/development/ai.md`                                 | Factory commands vs skills, project-pinned CLI, upgrade runbook                                                                 |
| Security                  | `site/docs/development/threat-model.md`                       | Canonical posture: security stack, STRIDE ledger, known gaps, drift markers (narrative: `walkthroughs/local-first/security.md`) |
| Contributing              | `site/docs/development/walkthroughs/codebase/contributing.md` | Quality gates, pipeline, checklist                                                                                              |
| Go backend services       | `site/docs/development/golang.md`                             | DI, interfaces, naming, sync.Pool, sqlc, HLC conflict, TDD, memory                                                              |
| PostgreSQL schema         | `site/docs/development/postgresql.md`                         | Schema pipeline, data types, indexing, migrations, LISTEN/NOTIFY, sqlc                                                          |
| Architecture decisions    | `site/docs/development/decisions.md`                          | Why things are built this way, ADRs                                                                                             |

## Critical Patterns (Memorize These)

**Vue Script Setup Order:**

1. Imports → 2. Props/Emits → 3. Constants → 4. Reactive State → 5. Computed → 6. Watchers → 7. Handlers → 8. Lifecycle

**Semantic Colors (never use raw slate/gray):**

- Text: `text-default`, `text-muted`, `text-dimmed`, `text-highlighted`
- Background: `bg-muted` (page), `bg-elevated` (cards), `bg-default` (sidebar)
- Status badges: `color="success"` (green), `color="primary"` (blue), `color="error"` (red)
- **Dark mode is the default** — never hardcode `bg-white`; use `bg-elevated` so cards invert correctly

**TypeScript ES2024:**

- Use `??` not `||` for defaults (preserves 0, false, '')
- Use `toSorted()` not `sort()` (immutable)
- Use `?.` for safe property access

**Testing:**

- Write failing test first (RED)
- Minimal implementation (GREEN)
- Clean up (REFACTOR)
- Never change test to make it pass

**SQLite migrations (local-first blind spot):**

- E2e tests always create a fresh DB — they never catch mismatches between the Drizzle schema and CHECK constraints in existing client databases
- Any change to a Drizzle `enum` column in `shared/db/schema/` **requires a migration** — SQLite cannot `ALTER COLUMN`, so the table must be recreated with `CREATE TABLE ... new`, `INSERT ... SELECT`, `DROP`, `ALTER ... RENAME`
- After writing the SQL file: (1) register it in `shared/db/migrations/index.ts`, (2) run `pnpm db:migrations:embed` to regenerate `sqlite-content.ts`
- The guard is `tests/integration/migrations.test.ts > events CHECK constraints match the Drizzle schema enum values` — it reads `sqlite_master` after applying all migrations and asserts every exported enum value is present in the DDL. If this test fails, a migration is missing.
- The same pattern applies to any other table with enum columns — add a matching assertion block to that test when you introduce a new constrained enum

**PostgreSQL-to-Drizzle generator is non-authoritative:**

- Treat `scripts/generate-drizzle-from-sql.ts` and `shared/db/schema/generated/` as unused legacy tooling pending issue [#142](https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/142); do not import, run, regenerate, extend, or include their output in unrelated work
- PostgreSQL uses `services/schema.sql`, Goose migrations, and `make gen:sqlc`; sqlc-generated Go code remains authoritative for its configured queries/models
- Runtime SQLite uses the hand-written `shared/db/schema/*.ts` barrel plus explicit `shared/db/migrations/sqlite/*.sql`; update and behavior-test those paths directly
- Do not claim PostgreSQL DDL generates the runtime SQLite Drizzle schema; cross-database agreement is enforced through persistence behavior tests

**Threat model drift (security blind spot):**

- `site/docs/development/threat-model.md` is the canonical security posture; the local-first security walkthrough is its narrative. Both mirror code facts — cited file paths, sync entity types, operations, batch/field caps, rate/size limits — marked inline with `<!-- drift:<key> -->` comments.
- The guard is `tests/guards/threat-model-drift.test.ts`. It runs in `make test` **and at pre-commit** whenever a mirrored source is staged (the two docs, `SECURITY.md`, `AGENTS.md`, `site/zensical.toml`, `nuxt.config.ts`, `push.go`, the entity registry) or any file the docs might cite is deleted.
- When it fails, decide which side is wrong before changing either: behavior genuinely changed → update the threat model (and consider whether the change deserves a Known Gaps row); only a constant moved → update the value next to its marker. Never delete a marker or a cited path just to silence the guard.
- Marker conventions: a numeric value sits immediately **before** its marker on the same line; set values (entity types, operations) list **after** it; each marker lives in exactly one of the two docs.
- Adding security-relevant surface — a sync entity type, endpoint, identity header, token, or client-exposed config — means updating the threat model in the same MR. Renaming or deleting a file the docs cite means updating the citation.

**Local-first update rollout and observability:**

- The migration runner (`app/local-db/migrations.ts`) records every migration attempt to `_migration_log` (a separate table bootstrapped before Drizzle migrations, immune to schema failures). After a successful batch it emits a `ClientSchemaMigrated.v1` system event to `events` so rollouts appear in the admin activity feed.
- Bootstrap failures are propagated to `useState('local-db-error')` by the plugin (`app/plugins/local-db.client.ts`), persisted to `localStorage`, and displayed to the user as a recovery overlay in `app.vue` — no console required.
- The recovery overlay offers "Clear local data and reload": sets `peaky-clear-db-on-reload` in localStorage, then on next startup the plugin deletes the OPFS database files before re-initialising (no lock-conflict because the SQLocal worker hasn't started yet).
- `window.peakyDB.migrationLog()` returns the full `_migration_log` for support/debug sessions. `window.peakyDB.clearLocalData()` triggers the same reset flow programmatically.
- **Hot-tab problem**: `app/composables/useDeploymentVersion.ts` polls `/__health` every 5 minutes and compares the server's `buildId` to the client's. On mismatch it sets `hasNewVersion = true`; `app.vue` shows a dismissible "New version available — Reload" banner. This prevents users on stale tabs from hitting API or schema mismatches silently.

</coding_guidelines>
