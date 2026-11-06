# TypeScript Test Review Context

## Scope

Review TypeScript tests in the repository's four explicitly separated suites:

| Suite | Boundary |
| --- | --- |
| Vitest unit/Nuxt | `tests/unit/**/*.test.ts` and `tests/nuxt/**/*.test.ts`, via `vitest.config.ts` |
| Vitest integration | Only the three files listed in `vitest.integration.config.ts` |
| Playwright functional | `tests/e2e/**`, Chromium project, excluding `tests/e2e/a11y/**` |
| Playwright accessibility | `tests/e2e/a11y/**`, `a11y` project |

The current integration allowlist is
`tests/integration/migrations.test.ts`,
`tests/integration/field-version-events-migration.test.ts`, and
`tests/integration/api/sync.test.ts`. Other files under `tests/integration/`
are not in that Vitest suite unless the config is deliberately updated.

## Project invariants and risk matrices

These are mandatory Peaky test invariants, not examples:

| Surface | Mandatory invariant |
| --- | --- |
| Unit tests | Import and execute production code, never a local copy or no-op stub |
| Database behavior | Lives in `tests/integration/`, not unit or Nuxt suites |
| Vue component mounting | Lives in `tests/nuxt/`, not `tests/unit/ui/` |
| External requests | `$fetch` is stubbed or mocked in unit tests |
| Time-dependent behavior | Clock is pinned with Vitest fake timers |
| Random backoff/jitter | `Math.random` is pinned and exact output is asserted |
| SQLite enum changes | Migration coverage proves applied DDL constraints match exported Drizzle enum values |

For local-first sync changes, preserve coverage at the relevant existing seams:
HLC clock ordering, bootstrap and inbound sync, concurrent sync, retry/backoff,
pending queue behavior, SSE client behavior, entitlement behavior, and actor
selection/override. These names identify required review surfaces when changed;
they do not require unrelated tests for every TypeScript change.

## Project conventions

- Oxlint bans imports matching `.*server/db.*` in `tests/unit/**/*` and
  `tests/nuxt/**/*`; move real database tests to `tests/integration/`.
- Oxlint bans `@testing-library/vue` in `tests/unit/ui/**/*`; component tests
  belong in the Nuxt test environment.
- A test must exercise the actual module. Local reimplementations, `typeof`
  checks on stubs, and `not.toThrow()` on no-op stubs are invalid coverage.
- Mock owned boundaries such as external services, not pure utilities or
  internal call sequences. More than three mocks is a review signal to
  simplify the seam.
- Prefer named constants or factories for repeated domain data. Reuse
  `tests/setup.ts`, `tests/nuxt/helpers/`, and `tests/e2e/helpers/` within their
  suite boundaries.
- Consolidate tests that traverse the same logic path and vary only one input.
  Test names describe behavior, not calls or loops.
- Coverage measures `app/services/**`, `app/composables/**`, `app/ui/**`,
  `app/local-db/**`, `shared/**`, `server/api/**`, and `server/utils/**`.
  Generated declarations, tests/specs, and `server/data/**` are excluded.
  Thresholds are lines 35, functions 50, branches 65, statements 35, and must
  not be lowered.
- Repository review thresholds are 300/500 lines for unit files, 400/600 for
  integration files, and 500/800 for E2E files (warning/critical).

## Deterministic coverage

- Pair `vi.useFakeTimers()` with `vi.setSystemTime(...)` for wall-clock
  behavior and restore real timers after each test.
- Stub `Math.random` to a known value and assert exact jitter/backoff results;
  statistical assertions are not accepted.
- Use exact values and collection sizes when known. Do not use conditional
  assertions that can silently skip checks.
- Run `pnpm test:run` for unit/Nuxt tests,
  `pnpm test:integration` for the explicit integration allowlist, and
  `pnpm test:coverage` for the coverage ratchet. Playwright boundaries are
  `pnpm test:e2e`, `pnpm test:a11y`, and the gated live sync-stack test
  `pnpm test:e2e:sync`.
- `pnpm test:e2e:sync` executes only
  `tests/e2e/sync-scoped-pull.spec.ts` and requires
  `PEAKY_E2E_SYNC_STACK=1` plus the running API, SSE, and PostgreSQL stack.

## References

- `vitest.config.ts`
- `vitest.integration.config.ts`
- `playwright.config.ts`
- `.oxlintrc.json`
- `package.json`
- `tests/setup.ts`
- `tests/unit/services/sync/HLCClock.test.ts`
- `tests/unit/services/sync/SyncEngine.bootstrap.test.ts`
- `tests/unit/services/sync/SyncEngine.concurrency.test.ts`
- `tests/unit/services/sync/inbound.test.ts`
- `tests/unit/composables/sync/useSseClient.test.ts`
- `tests/unit/services/entitlement/EntitlementService.test.ts`
- `tests/e2e/sync-scoped-pull.spec.ts`
- `tests/integration/migrations.test.ts`
- `Makefile`
