---
attestation:
  kind: release-evidence
  change: implement-maturity-score
  scope: copy-text handoff and provider boundary
  commit_sha: 8d97f6b39e0f520693c20595493c6b7789d47cc8
  generated_at: '2026-08-26T23:08:14Z'
  verdict: EVIDENCE-RECORDED
---

# Release evidence — copy-text handoff (implement-maturity-score, group 11.5)

## What shipped

- **Copy-text handoff** as the primary, always-available handoff action:
  `renderHandoffText` (`app/services/handoff/copyText.ts`) renders the
  synchronized draft snapshot as ordered, provider-neutral plain text —
  derived label and review context first, then per-practice blocks in draft
  order. `useHandoffCopy.ts` performs the user-directed clipboard write with
  success and copy-failure feedback. No public flag gates the control.
- **Existing-ticket association** through append-only
  `review_handoff_association` transitions (provider, external ID, https URL)
  with duplicate-conflict display, explicit replacement, and immutable
  history. No ticket creation, no provider-observed status.
- **No provider side effects**: no provider adapter, route, or sync entity
  type ships. The only outbound paths are the ordinary review-root sync push
  and the clipboard.

## Evidence commands and results

| Command | Result |
| --- | --- |
| `pnpm vitest run tests/unit/services/handoff/copyText.test.ts tests/unit/composables/handoff/useHandoffCopy.test.ts` | 11 passed — ordered payload, derived label, provider-neutral text, success/copy-failure feedback |
| `pnpm vitest run tests/guards/handoff-provider-boundary.test.ts` | 32 passed — no handoff module performs network I/O, clipboard is the only browser API, no provider route or entity type exists, the capability never reaches client code or public config |
| `pnpm vitest run tests/unit/services/handoff/limits.test.ts` + `go test -count=1 ./internal/syncengine/handoff/` | both runtimes pass the shared `tests/fixtures/handoff-limits.v1.json` vectors, including `javascript:` and protocol-relative URL rejection |
| Full `pnpm vitest run` and `pnpm test:integration` | green — see the group-11 task run for totals |

## Private provider capability: disabled in deployment

`PROVIDER_HANDOFF_INTEGRATION_ENABLED` is the only switch for any future
provider operation, and it is off everywhere it matters:

- **Default disabled** — `services/internal/app/config.go` enables it only on
  the exact value `"true"`; `TestConfigFromEnv_ProviderHandoffIntegrationDefaultsDisabled`
  and `TestConfigFromEnv_ProviderHandoffIntegrationEnabledOnlyByExactTrue`
  (`services/internal/app/config_test.go`) pass (`go test -count=1 ./internal/app/`).
- **Absent from deployment configuration** — no reference in
  `docker-compose.yml` or `docker/`, so deployed services run with the
  default (disabled).
- **Fail-closed choke point** — `ProviderHandoffPolicy`
  (`services/internal/authz/provider.go`) denies before any adapter or
  network invocation when the capability is disabled, without consulting the
  authorizer; `go test -count=1 ./internal/authz/` passes.
- **Never client-visible** — the capability is server-only configuration;
  `tests/guards/handoff-provider-boundary.test.ts` proves no client or public
  config file references it.

Screenshots: none — no visual change beyond the covered handoff UI (groups
9–10 component/browser tests).
