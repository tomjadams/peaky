## Prerequisites

> Issue: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/4>
> MR: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/9>

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Create GitLab issue in a RFC style using `glab` CLI describing the problem and how we intend to approach this from `design.md`
- [x] 0.3 Create feature branch named after the proposed change (already on `feat/oidc-foundation`)
- [x] 0.4 Create MR using conventional commit + template `.gitlab/merge_request_templates/default.md`

## 1. Install dependency and runtime config

> Can be done in isolation before other tasks.

- [x] 1.1 Add `jose` to production dependencies (`pnpm add jose`)
- [x] 1.2 Add private runtime config keys to `nuxt.config.ts` under `runtimeConfig` (private section, never `public`):
  - `oidcOktaDomain` (Okta org domain, e.g. `https://company.okta.com`)
  - `oidcOktaClientId`
  - `oidcOktaPrivateKey` (JWK JSON as delivered by PE — paste verbatim into the env var; `importJWK` parses; see tasks 8.3)
  - `oidcOktaLogoutUrl` (optional, for SLO)
  - `oidcSessionSecret` (48+ char string for H3 session sealing)
- [x] 1.3 Add corresponding `NUXT_*` env var stubs to `.env.example` (no real values)
- [x] 1.4 Update `nuxt.config.ts` CSP `connect-src` to include the Okta domain placeholder (`process.env.NUXT_OIDC_OKTA_DOMAIN ?? ''`)
- [x] 1.5 Add `oidcEnabled` feature flag derived from presence of required env vars; expose as `runtimeConfig.public.oidcEnabled`; (password-protect module was retired concurrent with the OIDC rollout; gate is now sole mechanism for the through-the-front-door flow)
- [x] 1.6 Create `server/routes/auth/dev/login.get.ts` — dev-only session bypass (404 in production); requires only `NUXT_OIDC_SESSION_SECRET` to work locally without a real Okta tenant

## 2. Server utilities

> Isolated — no UI dependencies. Write tests first (RED), then implement (GREEN).

- [x] 2.1 Create `server/utils/auth/pkce.ts`: `generatePkce()` returning `{ codeVerifier, codeChallenge }` using `crypto.subtle` (SHA-256, base64url)
- [x] 2.2 Write unit tests for `generatePkce` in `tests/unit/server/utils/auth/pkce.test.ts`:
  - Challenge is `base64url(sha256(verifier))`
  - Verifier is URL-safe, 43–128 chars
- [x] 2.3 Create `server/utils/auth/okta.ts`:
  - `buildClientAssertion(clientId, tokenUrl, privateKeyPem)` — signs RS256 JWT via `jose` `SignJWT` with claims `{ iss, sub, aud, exp: now+5min, jti: uuid }`
  - `getOktaUrls(domain)` — returns `{ authorizationUrl, tokenUrl, userInfoUrl, jwksUrl, logoutUrl }`
  - `validateIdToken(idToken, jwksUrl, clientId)` — verifies via `jose` `jwtVerify` + `createRemoteJWKSet`; returns `{ sub, email, name, exp }`
- [x] 2.4 Write unit tests for `buildClientAssertion` in `tests/unit/server/utils/auth/okta.test.ts`:
  - JWT `iss` and `sub` equal `clientId`
  - JWT `aud` equals `tokenUrl`
  - JWT `exp` is within 5 minutes of now
  - JWT `jti` is present and non-empty
- [x] 2.5 Create `server/utils/auth/session.ts`:
  - `AuthSession` type: `{ sub: string; email: string; name: string; exp: number }`
  - `getAuthSession(event)` — returns `AuthSession | null` from H3 `useSession`; clears and returns null if `exp` is past
  - `setAuthSession(event, session)` — seals and sets the session cookie
  - `clearAuthSession(event)` — destroys the session

## 3. Nitro OIDC route handlers

> Depends on task group 2. Write integration tests first.

- [x] 3.1 Write integration test for `GET /auth/okta/login` in `tests/integration/auth/login.test.ts`:
  - Returns 302 to Okta `authorizationUrl`
  - Sets a `flow` cookie
  - Response Location contains `response_type=code`, `code_challenge`, `state`, `client_id`, `redirect_uri`
- [x] 3.2 Create `server/routes/auth/okta/login.get.ts`:
  - Guard: if Okta config env vars are missing, return 503 `{ message: 'OIDC not configured' }`
  - Generate PKCE pair and random `state` (crypto.randomUUID)
  - Store `{ codeVerifier, state, redirect: query.redirect ?? '/' }` in a short-lived H3 flow cookie (encrypted, 10 min)
  - Redirect to Okta authorization URL with `response_type=code`, `scope=openid email profile`, PKCE params, `state`, `redirect_uri=/auth/okta/callback`
- [x] 3.3 Write integration test for `GET /auth/okta/callback` in `tests/integration/auth/callback.test.ts`:
  - State mismatch → 400
  - Missing `code` → 400
  - (Happy path requires mocked Okta token endpoint — use `vi.mock` or MSW)
- [x] 3.4 Create `server/routes/auth/okta/callback.get.ts`:
  - Read flow cookie; 400 if absent or state mismatch
  - 400 if `code` query param is absent
  - Call Okta token endpoint with `code`, `code_verifier`, `client_assertion`, `client_assertion_type`
  - Validate ID token via `validateIdToken`
  - Call `setAuthSession` with `{ sub, email, name, exp }`
  - Clear flow cookie
  - Redirect to `redirect` from flow cookie (default `/`)
- [x] 3.5 Write integration test for `GET /auth/okta/logout` in `tests/integration/auth/logout.test.ts`:
  - Session cookie is cleared
  - Redirects to `/auth/login` when `LOGOUT_URL` unset
  - Redirects to Okta SLO endpoint when `LOGOUT_URL` set
- [x] 3.6 Create `server/routes/auth/okta/logout.get.ts`:
  - Call `clearAuthSession`
  - If `oidcOktaLogoutUrl` is set, redirect to Okta `end_session_endpoint` with `post_logout_redirect_uri=/auth/login`
  - Otherwise redirect to `/auth/login`

## 4. Session API endpoint

> Depends on task group 2. Needed by the client-side composable.

- [x] 4.1 Create `server/api/_auth/session.get.ts`:
  - Call `getAuthSession(event)`
  - If null: return 401
  - Otherwise: return `{ sub, email, name }` (no `exp` — internal detail)
- [x] 4.2 Write integration test: valid session → 200 with user fields; no session → 401

## 5. Client-side composable and middleware

> Depends on task group 4.

- [x] 5.1 Create `app/composables/useAuth.ts`:
  - `useFetch('/api/_auth/session')` with `{ lazy: true, server: false }` (client-only, non-blocking)
  - Expose `{ isLoggedIn: computed, user: computed, login(), logout() }`
  - `login()` navigates to `/auth/okta/login?redirect=<currentPath>`
  - `logout()` navigates to `/auth/okta/logout`
- [x] 5.2 Create `app/middleware/auth.global.ts` (global middleware, opt-out pattern):
  - Applies to every route automatically; skips if `to.meta.public === true`
  - Call `useAuth()`; if `!isLoggedIn` after fetch resolves, redirect to `/auth/login?redirect=<to.fullPath>`
  - Note: middleware runs after hydration — the shell renders first
  - Extend `PageMeta` type with `public?: boolean` in `app/types/auth.d.ts`
- [x] 5.3 Mark explicitly public pages with `definePageMeta({ public: true })`:
  - `app/pages/index.vue` (public landing)
  - `app/pages/auth/login.vue` (login page)
  - All other pages are protected by default — no per-page opt-in needed

## 6. Login page

> Depends on task group 5. UI task — load `nuxt-ui` skill.

- [x] 6.1 Create `app/pages/auth/login.vue`:
  - Full-viewport `bg-muted` canvas with sky→green branded dot grid (CSS radial-gradient + diagonal wash)
  - Inline SVG wordmark — gradient chart mark floating without background box, next to "Peaky" text, left-aligned above card
  - Transparent card with `from-primary/20 via-primary/10 to-transparent p-[1px]` gradient border (dot grid visible through card body)
  - "Continue with Okta" button (`color="neutral" variant="solid"`) with key icon, calling `login()`
  - If `redirect` query param is present, pass it through to `login()`
  - If user is already authenticated (`isLoggedIn`), redirect to `/` immediately

## 7. Adversarial Reviews

> Run after all implementation tasks are complete. One pass over the full change.

- [x] 7.1 Run `ts-reviewer` on:
  - `server/utils/auth/pkce.ts`
  - `server/utils/auth/okta.ts`
  - `server/utils/auth/session.ts`
  - `server/utils/auth/flow.ts`
  - `server/routes/auth/okta/login.get.ts`
  - `server/routes/auth/okta/callback.get.ts`
  - `server/routes/auth/okta/logout.get.ts`
  - `server/api/_auth/session.get.ts`
  - `app/composables/useAuth.ts`
  - `app/middleware/auth.global.ts`
- [x] 7.2 Run `vue-reviewer` on:
  - `app/pages/auth/login.vue`
- [x] 7.3 Run `ui-review` on:
  - `app/pages/auth/login.vue`
- [x] 7.4 Run `test-reviewer` on:
  - `tests/unit/server/utils/auth/pkce.test.ts`
  - `tests/unit/server/utils/auth/okta.test.ts`
  - `tests/integration/auth/login.test.ts`
  - `tests/integration/auth/callback.test.ts`
  - `tests/integration/auth/logout.test.ts`
  - `tests/integration/auth/session.test.ts`
- [x] 7.5 Run `security-reviewer` on:
  - `server/routes/auth/okta/callback.get.ts` (token exchange, session creation)
  - `server/utils/auth/okta.ts` (private key handling, JWT construction)
  - `server/utils/auth/session.ts` (session sealing/reading)
  - `server/api/_auth/session.get.ts` (session exposure boundary)
- [x] 7.6 Run `ux-reviewer` on the full login → protected route → redirect → login → post-login redirect flow (deferred — requires live Okta; UX verified via code review; marked as pending manual verification)
- [x] 7.7 Address all review findings

## Housekeeping

- [x] Run `make mr` — all quality gates must pass before submitting MR
- [x] Update decision log `site/docs/development/decisions.md` with the `private_key_jwt` choice and rationale
- [x] Update GitLab issue with task completions

## 8. Live verification hardening

> Surfaced during issue #82 walkthrough on `fork/main @ feat/okta-2nd-stage`. Each task is the diff between the original MVP (delivered in MR !9) and what we now run on Vercel prod.

### 8.1 Endpoint discovery via `.well-known/openid-configuration`

> Design decision 3. Replaces the hardcoded `/oauth2/default/v1/...` URLs that the real `sso.adyen.com` org does not provision — it runs the legacy auth server at `/oauth2/v1/...`.

- [x] 8.1.1 Refactor `getOktaUrls(domain)` into `discoverOktaUrls(domain)` in `server/utils/auth/discovery.ts` (`getOktaUrls` re-exported from `okta.ts` for back-compat with the older import sites):
  - Fetches `${domain}/.well-known/openid-configuration` on first use, caches per-domain
  - Maps `issuer` / `authorization_endpoint` / `token_endpoint` / `userinfo_endpoint` / `jwks_uri` / `end_session_endpoint` onto `OktaUrls`
  - Concurrent first-call callers share one in-flight Promise; rejections are evicted from the cache so transient failures stay retryable
  - Carry an `AbortSignal.timeout(5000)` so a slow Okta origin fails fast (security WARN-1 closure)
- [x] 8.1.2 Both `login.get.ts` and `callback.get.ts` already `await getOktaUrls(...)` (the wrapper route), which in turn delegates to `discoverOktaUrls`; the URL set flows unchanged through the rest of the handler
- [x] 8.1.3 Unit tests in `tests/unit/server/utils/auth/okta.test.ts`:
  - Mapping from real `sso.adyen.com` discovery doc (legacy auth server) produces correct `OktaUrls`
  - Adapts to the alternate `dev-12345.okta.com/oauth2/default` Custom Authorization Server shape
  - Trailing slash in `domain` is stripped before fetching
  - Per-domain cache hits, no-cache-on-rejection, missing-field error

### 8.2 Request-origin OAuth `redirect_uri`

> Design decision 5. Replaces the `NUXT_PUBLIC_BASE_URL ?? "http://localhost:3000"` fallback that surfaced as `redirect_uri mismatch` on the first Vercel preview deploy.

- [x] 8.2.1 In `server/routes/auth/okta/login.get.ts` derive the redirect base from `getRequestURL(event).origin` instead of an env var
- [x] 8.2.2 In `server/routes/auth/okta/callback.get.ts` derive the redirect base from the same source (must match what login sent to Okta)
- [x] 8.2.3 In `server/routes/auth/okta/logout.get.ts` derive `post_logout_redirect_uri` from the same source for the SLO redirect

### 8.3 JWK JSON private key loader

> Design decision 4. PE distributes the private key as a JWK JSON object, not PEM. jose v6's `importPKCS8` throws hard on JSON; we route through `importJWK` with an explicit JSON.parse fallback.

- [x] 8.3.1 In `server/utils/auth/okta.ts` switch `buildClientAssertion` from `importPKCS8` to `importJWK`
- [x] 8.3.2 Accept either a stringified JWK JSON or a parsed `JsonWebKey` object on the `privateKeyJwk` parameter
- [x] 8.3.3 Rename param from `privateKeyPem` to `privateKeyJwk` and update the docstring to mention the matching public-key registration requirement
- [x] 8.3.4 Update the unit test fixture in `tests/unit/server/utils/auth/okta.test.ts`:
  - Generate fixtures via `exportJWK` (was `exportPKCS8`)
  - Add a second test case that builds the assertion from a parsed `JsonWebKey` object directly

### 8.4 Richer claim extraction in `IdTokenClaims` / `AuthSession`

> Lays the groundwork for `groups`-driven roles and the human-facing Profile modal enhancements.

- [x] 8.4.1 Extend `IdTokenClaims` in `server/utils/auth/okta.ts` with `given_name`, `family_name`, `email_verified`, `preferred_username`, `ldap_uid`, `picture`, `groups` (all optional — their absence is not an error)
- [x] 8.4.2 Extend `AuthSession` in `server/utils/auth/session.ts` to mirror the same fields
- [x] 8.4.3 `validateIdToken` populates the new fields defensively and gates `groups` (whitelist of strings only)
- [x] 8.4.4 `/api/_auth/session.get.ts` surfaces the new fields to the client

### 8.5 `useCurrentActor` sourced from OIDC session

> Replaces the placeholder local-storage "Local profile" picker. Identity flows from the Okta session everywhere downstream code reads it.

- [x] 8.5.1 In `app/composables/useAuth.ts` extend the `AuthUser` interface with the same optional claim set used in `IdTokenClaims`
- [x] 8.5.2 In `app/composables/auth/useCurrentActor.ts`:
  - Source the active `LifecycleActor` from `useAuth().user`
  - Project Okta `sub` → `id`, `name` → `name`, `groups.contains("peaky-admins"|"peaky-admin")` → `["admin"]` else `["member"]` (the generic tenant-wide `admin` group is intentionally excluded — see design.md §8.5)
  - Module-level `watch` mirror writes the projected actor to localStorage under `peaky:current-actor` so the synchronous `readPersistedActor()` / `readPersistedReviewActor()` helpers used by services outside Vue setup keep returning the right identity
  - `setActor` / `setRoles` are no-ops (deprecation warnings) — these are removed entirely in task 8.6
- [x] 8.5.3 Verify all existing call-sites compile and tests stay green (mocks return the same `{ id, name, roles }` shape they always did — service tests untouched)

### 8.6 Profile modal refactor — human-facing UI

- [x] 8.6.1 In `app/components/NavigationSidebar.vue`:
  - Replace `useCurrentActor` + `useCatalogUserSearch` + `UserAutocomplete` imports with `useAuth`
  - Avatar initials from `user.name`, swap to `user.picture` if `picture` claim is present
  - Tooltip on hover shows email/name (not the Okta `sub`)
  - Modal body: large avatar + name + email + `email_verified` check icon + `Admin` badge when in peaky-admin group
  - Modal footer: helper line + `Close` + `Sign out` (calls `useAuth().logout()` → `/auth/okta/logout`)
  - Collapsed `Identity details (for support)` disclosure at the bottom that reveals `sub` and (when present) `groups` — supports the "show what's in the JWT" use case without putting it front-and-centre
- [x] 8.6.2 In `app/composables/auth/useCurrentActor.ts` delete `setActor` / `setRoles` entirely (no callers)
- [x] 8.6.3 Wrap `logout()` in a typed `onSignOut()` that discards the `navigateTo` return so the `UButton` `@click` signature stays void-shaped

## 9. Server-side actor trust model reset

> Closes `/merge-check` B-1: `server/utils/lifecycleActor.ts:getLifecycleActor` no longer trusts client-supplied `x-actor-id` / `x-actor-name` / `x-actor-roles` request headers as the source-of-truth for identity. Surfaced because the new self-claim Admin toggle (§10) made the gap reachable in production.

- [x] 9.1 In `server/utils/lifecycleActor.ts` make `getLifecycleActor(event)` async; prefer the sealed OIDC session (read via `getAuthSession`) when present; fall back to the legacy header path only when `getAuthSession` returns null (dev/e2e path)
- [x] 9.2 When resolving from a session, derive `id` from `sub`, `name` from `name ?? preferred_username ?? email ?? sub`, and `roles` from `groups` (`admin` iff `groups` contains `peaky-admins`, else `member`)
- [x] 9.3 In `server/utils/reviewContentAccess.ts` make `requireReviewContentActor` async to await `getLifecycleActor`; apply the await in the three notes/attachments route handlers
- [x] 9.4 Promote the twelve lifecycle API handlers (`events.get.ts`, `admin/events*`, `templates/*`, `teams/[id]/reviews.post.ts`, `products/*`) to async and await `getLifecycleActor`
- [x] 9.5 Verify `tests/unit/server/utils/lifecycleActor.test.ts` covers the trust hierarchy: session wins over a spoofed admin header, group-based role elevation, dev/e2e header fallback, default fallback, name preference
- [x] 9.6 Update `tests/nuxt/api/admin-events.test.ts` and `admin-events-stream.test.ts` to handle the async handler return (await + `rejects.toThrow`)

## 10. Local admin self-claim (Cedar placeholder)

> Allows the Profile modal to surface the upcoming Admin UI without granting server-side authorisation. Removed in the Cedar MR (Scenario 4 of `Requirement: Local Admin Self-Claim`).

- [x] 10.1 In `app/composables/auth/actor-override.ts` extract `readActorOverride` / `writeActorOverride` helpers + `ACTOR_OVERRIDE_STORAGE_KEY` constant; SSR-safe (`typeof window === "undefined"` returns null)
- [x] 10.2 In `app/composables/auth/useCurrentActor.ts` add a reactive `override` ref (`LifecycleRole[] | null`) mirroring `peaky:actor-override-roles` + `isSelfClaimAdmin` computed + `setSelfClaimAdmin` writer; merge the mirror roles into `actor.value.roles` only for the local UI projection
- [x] 10.3 In `app/components/NavigationSidebar.vue` swap `isOidcAdmin` for an `effectiveIsAdmin` derived from the actor roles; render an `UTooltip`-wrapped `USwitch` in the Profile modal with a `text-warning` caption that leads with the consequence
- [x] 10.4 Unit tests for `actor-override.ts` (`tests/unit/composables/auth/actor-override.test.ts`): round-trip + bad JSON + empty-array + non-array + SSR guard
- [x] 10.5 Drop all client-side `[AUTH-DEBUG]` DOM-badge / `globalThis.__AUTH_DEBUG_LINES__` / `console.info` sinks from `app/composables/useAuth.ts`; keep only the server-side `[AUTH-DEBUG]` env-gated log as the dev-only escape hatch

## 11. Hard cookie-size budget enforcement

> Closes CodeRabbit CR-3: `server/utils/auth/session.ts` no longer relies on documentation alone to keep the sealed session under the 4 KB browser cookie ceiling. The reviewer is right that the raw `id_token` plus a wide `groups[]` claim can blow past the ceiling.

- [x] 11.1 In `server/utils/auth/session.ts` export `COOKIE_BUDGET_BYTES = 3000` (leaves headroom for iron-webcrypto HMAC-SHA256 + base64 inflation; sealed output stays under 4 KB)
- [x] 11.2 Add `enforceCookieBudget(session)` pure helper: drops optional fields in deterministic priority order — `id_token → picture → groups → preferred_username → ldap_uid → given_name → family_name → email_verified` — until the budget is met; never drops the required four (sub/email/name/exp); pure / no I/O / no input mutation
- [x] 11.3 In `setAuthSession` call `enforceCookieBudget` before `session.update(...)`; emit a `[AUTH-DEBUG]` `console.warn` carrying the input payload size and the dropped key list when the budget is exceeded (dropping `id_token` means the user falls back to local-only logout — recorded fall-through in `logout.get.ts`)
- [x] 11.4 Update the `AuthSession.id_token` JSDoc to describe the new path: budget exceeded → drop → local-only logout preferred over `ERR_COOKIE_SIZE`
- [x] 11.5 Add 6 unit tests in `tests/unit/server/utils/auth/session.test.ts` — under-budget pass-through, no input mutation, id_token-first drop order, multi-field cascade, never-drop-required-4 invariant, budget stays < 4 KB

## 12. `validateIdToken` test surface (B-3)

> Closes /merge-check B-3: critical OIDC signature verification path now has a real fixture-driven test surface.

- [x] 12.1 `tests/unit/server/utils/auth/validateIdToken.test.ts` (NEW, 8 cases) — generate a real RSA keypair at test time, sign ID tokens with `jose.SignJWT`, mock `createRemoteJWKSet` to return a local JWKS backed by the same keypair
- [x] 12.2 Cases: canonical + extended claims; JWKS-URL passthrough; issuer enforcement; issuer-skipped path; audience mismatch (`JWTClaimValidationFailed`); expiry (`JWTExpired`); wrong-key sign (`JWSSignatureVerificationFailed`); minimal payload (no extended claims) still sanitises

## 13. Profile modal extraction (B-4 + UX W-block)

> Closes /merge-check B-4 + W-15, W-16, W-17. NavigationSidebar.vue drops 409 lines → 220 lines; ProfileModal.vue 212 lines owns the self-contained modal block; UX copy leads with the action and is explicit about persistence.

- [x] 13.1 `app/components/ProfileModal.vue` (NEW) — avatar / email / admin badge / self-claim switch / identity details disclosure / footer; `defineModel('open', { default: false })`
- [x] 13.2 `app/components/NavigationSidebar.vue` — drops `useAuth` / `useCurrentActor` / modal-state; renders `<ProfileModal v-model:open="isProfileOpen" />`; keeps `userInitials` only for the trigger avatar
- [x] 13.3 UX copy — tooltip leading with action ("Click to grant Admin role..."); symmetric revoke tooltip; warning copy explicit about persistence ("Persists across page reload until toggled off — visible only to you") and audience ("Local placeholder")
- [x] 13.4 W-14 (confirmation modal on toggle) deliberately deferred — the warning copy + leading-with-action tooltip carry the consequence; an additional `UModal` confirmation adds noise without adding real safety

## Live verification checklist (Populated from issue #82 walkthrough)

Tracked on [containers/rtf/peaky#82](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/82). Updated live as PE confirmed each step.

- [x] Obtain `clientId` and `domain` from PE; generate RSA key pair and register public JWK in Okta — **PE provisioned** the app `0oaxvsw77k7g8Aufk417` and registered an RSA keypair (PE-generated; private half delivered as JWK JSON by email). Confirmed via direct curl on `sso.adyen.com/oauth2/v1/authorize` returning `200` once the redirect_uri was allowlisted.
- [x] Set all five `NUXT_OIDC_*` env vars in Vercel (sensitive) — `DOMAIN`, `CLIENT_ID`, `PRIVATE_KEY` (JWK JSON), `LOGOUT_URL`, `SESSION_SECRET`. `oidcEnabled=true` confirmed in SSR payload via `window.__NUXT__.config.public.oidcEnabled`.
- [x] Login flow end-to-end — landed clean on `https://orr-sample.vercel.app` with `sso.adyen.com` cookies + sealed `peaky_auth` set, redirect following `?redirect=/teams`.
- [x] Post-login redirect from a protected deep link — `/auth/login?redirect=/teams` round-trip works.
- [x] Session expiry forces re-login — sealed cookie TTL `SESSION_MAX_AGE = 24h` confirmed; `getAuthSession` short-circuits on the ID-token `exp` claim too.
- [x] Logout clears session and redirects correctly — `peaky_auth` cookie cleared in DevTools, lands on `/auth/login`.
- [x] SLO redirect when `NUXT_OIDC_OKTA_LOGOUT_URL` is configured — `/auth/okta/logout` redirects to `https://sso.adyen.com/oauth2/v1/logout?post_logout_redirect_uri=…/auth/login`.

## Still pending on issue #82

- [x] `make mr` quality gates green against the Vercel preview — run `pnpm test`, `pnpm typecheck`, lint suite
- [x] Follow-up MR removes `@plutotcool/nuxt-password-protect` + its env vars (landed in this MR)
- [x] Archive this openspec change via `openspec archive oidc-okta-auth`

## Manual tasks (Local dev bypass — no Okta required)

Add to your `.env`:

```text
NUXT_OIDC_SESSION_SECRET=<any-48-char-string>
NUXT_OIDC_OKTA_DOMAIN=https://placeholder.okta.com
NUXT_OIDC_OKTA_CLIENT_ID=placeholder
```

Then run `make dev` and visit `http://localhost:3000/auth/dev/login`. You will be logged in as `dev@peaky.local`. Visit `/auth/okta/logout` to clear the session.
