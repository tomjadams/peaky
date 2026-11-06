## ADDED Requirements

### Requirement: OIDC Login Via Okta

The system SHALL support user authentication via Okta using the OIDC Authorization Code Flow.

#### Scenario: User initiates login

- **WHEN** an unauthenticated user navigates to `/auth/okta/login`
- **THEN** the server generates a PKCE code verifier/challenge, a random `state` parameter, stores them in a short-lived encrypted cookie, and redirects the browser to the Okta authorization endpoint

#### Scenario: Okta redirects back with authorization code

- **WHEN** Okta redirects to `/auth/okta/callback` with a `code` and `state` query parameter
- **THEN** the server validates the `state` against the stored value, exchanges the code for tokens using `private_key_jwt` client authentication, validates the ID token, creates an encrypted session cookie, and redirects the user to the post-login destination

#### Scenario: State mismatch on callback

- **WHEN** the `state` parameter on the callback does not match the stored value
- **THEN** the server rejects the request with a 400 error and does not create a session

### Requirement: Private Key JWT Client Authentication

The system SHALL authenticate to the Okta token endpoint using `private_key_jwt` (no shared client secret).

#### Scenario: Token request uses client assertion

- **WHEN** the server exchanges an authorization code at the Okta token endpoint
- **THEN** the request includes `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer` and a `client_assertion` JWT signed with the server's RSA private key

#### Scenario: Client assertion JWT claims are correct

- **WHEN** the server builds the client assertion JWT
- **THEN** the JWT contains `iss=<clientId>`, `sub=<clientId>`, `aud=<tokenUrl>`, a short `exp` (≤ 5 minutes), and a unique `jti`

#### Scenario: Private key never leaves the server

- **WHEN** the system is running
- **THEN** the RSA private key is only loaded from the `NUXT_OIDC_OKTA_PRIVATE_KEY` environment variable on the server side and is never included in any client bundle or API response

### Requirement: Encrypted Server-Side Session

The system SHALL store authentication state in an encrypted, sealed cookie session. No tokens are exposed to the client.

#### Scenario: Session cookie is set after successful callback

- **WHEN** the OIDC callback succeeds
- **THEN** the server sets an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie containing the encrypted user identity (claims from the ID token) and session expiry

#### Scenario: Session does not expose raw tokens to client

- **WHEN** a client reads the session cookie or calls the session API endpoint
- **THEN** the response contains only user identity fields (e.g., `sub`, `email`, `name`) and never the raw access token, ID token, or refresh token

#### Scenario: Session expires with the access token

- **WHEN** the access token `exp` claim is in the past
- **THEN** the server treats the session as expired and returns a 401, clearing the session cookie

### Requirement: Logout

The system SHALL support logout that clears the local session and optionally ends the Okta session.

#### Scenario: Local session is cleared on logout

- **WHEN** an authenticated user calls `/auth/okta/logout`
- **THEN** the server clears the session cookie and redirects the user to `/auth/login`

#### Scenario: Okta single sign-out is performed when configured

- **WHEN** `NUXT_OIDC_OKTA_LOGOUT_URL` is set and an authenticated user calls `/auth/okta/logout`
- **THEN** after clearing the local session the server redirects to the Okta `end_session_endpoint` with `id_token_hint` and `post_logout_redirect_uri`

### Requirement: Route Protection With Fast Shell

The system SHALL protect authenticated routes while allowing the app shell to render immediately.

#### Scenario: App shell loads without authentication

- **WHEN** any user (authenticated or not) loads the root page `/`
- **THEN** the page renders the app shell immediately without requiring a valid session

#### Scenario: Protected route redirects unauthenticated user

- **WHEN** an unauthenticated user navigates to any route protected by the `auth` middleware
- **THEN** the client redirects to `/auth/login`, preserving the original path as a `redirect` query parameter

#### Scenario: Post-login redirect restores original destination

- **WHEN** a user completes login after being redirected from a protected route
- **THEN** the system redirects to the original destination path from the `redirect` query parameter, falling back to `/` if absent

### Requirement: Session State Available Client-Side

The system SHALL expose a composable for components to reactively access authentication state.

#### Scenario: Composable returns user info when authenticated

- **WHEN** `useAuth()` is called in a Vue component and the user is authenticated
- **THEN** it returns `{ isLoggedIn: true, user: { sub, email, name } }` without exposing tokens

#### Scenario: Composable returns unauthenticated state when no session

- **WHEN** `useAuth()` is called and no valid session exists
- **THEN** it returns `{ isLoggedIn: false, user: null }`

### Requirement: Local Admin Self-Claim (Cedar placeholder)

The system SHALL expose a self-claim Admin toggle in the Profile modal that lets a signed-in user elevate to the Admin lifecycle role locally by writing `["admin"]` to the localStorage key `peaky:actor-override-roles`. The override is only honoured when the user is authenticated and the override key is present; otherwise the actor's roles derive from the OIDC `groups` claim.

#### Scenario: Self-claim toggle writes override roles

- **WHEN** an authenticated user flips the "Self-claim Admin" switch in the Profile modal to ON
- **THEN** the client writes `["admin"]` to localStorage key `peaky:actor-override-roles` and `actor.value.roles` re-evaluates to include `admin`

#### Scenario: Clearing the toggle removes the override

- **WHEN** the toggle is flipped to OFF
- **THEN** the client removes the override key and `actor.value.roles` falls back to the OIDC `groups` projection (currently `["member"]` because the IdP does not emit the `groups` claim)

#### Scenario: Override survives session refresh and logout-then-login flow

- **WHEN** an authenticated user signs out and signs back in on the same browser
- **THEN** the override key persists across the session refresh and the Admin role continues to apply

#### Scenario: The self-claim toggle is removed when Cedar authz ships

- **WHEN** the Cedar authz engine and the Policies UI subsume the local placeholder
- **THEN** the `peaky:actor-override-roles` key, the `setSelfClaimAdmin`/`isSelfClaimAdmin` exports of `useCurrentActor`, and the `USwitch` in the Profile modal are deleted in the same MR — no residue
