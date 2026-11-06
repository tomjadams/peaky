# Security Review Context

## Scope

Apply this context across Peaky's browser, Nuxt server, Go sync/SSE services,
shared database contracts, CI automation, runtime configuration, and future
infrastructure configuration.

Peaky is local-first. Security conclusions must follow data through local
SQLite, the outbox, sync push/pull, PostgreSQL, and SSE rather than treating a
Vue permission check as enforcement.

## Project invariants

- **The browser is untrusted.** OPFS contains a full local data copy. DevTools
  can read or alter local rows, entitlement snapshots, and outbox events.
- UI permission gates and cached entitlements are UX only. The Go sync backend
  reauthorizes every mutation before persistence.
- The push handler at `services/internal/syncengine/push.go` is the primary
  mutation boundary. It validates batch size, entity/operation shape, root
  scoping, timestamps, field arrays, field count, authorization, and HLC
  conflicts.
- Pull remains the data-disclosure boundary. SSE is only a doorbell:
  `{ cursor, family }`. Family-scoped over-notification is accepted because the
  frame contains no domain data and pull applies entitlements.
- Cross-origin isolation is required for SQLite WASM/OPFS. COOP, COEP, CORP,
  `wasm-unsafe-eval`, and blob worker/connect allowances in `nuxt.config.ts`
  are deliberate functional requirements, not accidental relaxations.
- Client-visible configuration belongs under `runtimeConfig.public`; OIDC
  private key and session values remain server-only.
- `/system` deliberately provides no local SQLite export, raw SQL execution, or
  sync-cursor reset. Its recreate action deletes only the bounded local copy and
  must surface the unsynced outbox count before confirmation.

## Project conventions

- New sync entity types register with the sync entity registry, resolve to an
  entitlement root, receive explicit payload limits, and remain pull-scoped.
- New SSE channels derive from actor entitlements, use the approved
  `review`, `product`, or `template` family, and never carry entity content.
- User-controlled rich text or Markdown is sanitized before rendering. Avoid
  `v-html` unless the sanitization path is explicit.
- Debug globals are controlled by
  `runtimeConfig.public.testHelpersEnabled`: enabled for local development and
  Vercel previews to support E2E, disabled only when
  `VERCEL_ENV=production`. Preview deployments therefore intentionally expose
  `window.peakyDB` and `window.__peakySeed` and must not be treated as a
  production trust boundary.
- Error details written to sync events pass through `sanitiseError()`. Free-text
  `errorMessage` remains an accepted transitional risk; replace it with a
  structured `{ code, kind }` allow-list before those failure events become a
  server-synced surface.
- CI automation credentials, including `CI_AUTOMATION_TOKEN` and
  `CI_AUTOMATION_CHANGELOG_TOKEN`, remain server/CI-only and must not enter
  logs, generated artefacts, or client config.

## Accepted limitations

- Go `peaky-api` and `peaky-sse` currently trust identity and roles from
  `x-actor-*` headers, with `actor_dev` fallback. This is accepted only behind
  the Phase 1 internal network boundary. The forward fix is signed Okta JWT
  validation at `services/internal/middleware/actor.go` and the SSE boundary.
- Persistence deduplicates event IDs and fields, but push lacks an event-ID
  replay fast path. An exact populated replay may be reported as an HLC
  conflict before persistence.
- `sanitiseError()` is a denylist and not a durable substitute for structured
  error fields.

Do not report these accepted limitations as newly introduced findings unless a
change expands their exposure, removes an existing mitigation, or crosses the
documented deployment boundary.

## Deterministic coverage

- `app/**`: local sensitive storage, rendering sinks, test-helper exposure,
  unsafe URL/content handling, and UI-only authorization assumptions.
- `services/internal/syncengine/**`: request limits, registry/root validation,
  per-event authorization, HLC persistence, and pull entitlement filtering.
- `services/internal/sse/**`: actor-derived family channels and content-free
  frames.
- `server/**` and `nuxt.config.ts`: OIDC/session handling, private versus public
  runtime config, security headers, body/upload limits, and production helper
  gating.
- `shared/db/**`: sensitive fields, local persistence, migrations, and sync
  contract changes.
- `scripts/ci/**` and `.factory/skills/merge-check/src/**/*.py`: token handling,
  command construction, logs, generated attestation data, and untrusted MR
  input.
- `**/Pulumi.yaml` and `**/Pulumi.*.yaml` are forward-looking paths. They do not
  currently exist; when introduced, treat stack configuration and secret
  handling as production security surfaces.

## References

- `site/docs/development/threat-model.md`
- `site/docs/development/walkthroughs/local-first/security.md`
- `site/docs/development/walkthroughs/local-first/authorization.md`
- `site/docs/development/walkthroughs/local-first/api.md`
- `services/internal/syncengine/push.go`
- `services/internal/middleware/actor.go`
- `services/internal/sse/handler.go`
- `app/plugins/local-db.client.ts`
- `app/plugins/test-seed.client.ts`
- `app/services/events/sanitiseError.ts`
- `nuxt.config.ts`
