import type { H3Event } from "h3";
import {
  DEFAULT_LIFECYCLE_ACTOR,
  type LifecycleActor,
  type LifecycleRole,
  VALID_LIFECYCLE_ROLES,
} from "~/lifecycle/management";
import { getAuthSession } from "./auth/session";
import { isOidcEnabled } from "./auth/oidc-config";

/**
 * Server-recognised admin group names. Mirrors `useCurrentActor`'s
 * `ADMIN_GROUPS` constant: a session claim containing any of these names
 * elevates the lifecycle actor to `admin`. Keep in sync with the
 * client-side list when new IdP groups are added.
 */
const ADMIN_LIFECYCLE_GROUPS = new Set<string>(["peaky-admins", "peaky-admin"]);

function getQueryValue(event: H3Event, queryName: string): string | undefined {
  const globalGetQuery = (
    globalThis as {
      getQuery?: (event: H3Event) => Record<string, unknown>;
    }
  ).getQuery;

  if (typeof globalGetQuery !== "function") {
    return undefined;
  }

  const queryValue = globalGetQuery(event)[queryName];
  return typeof queryValue === "string" ? queryValue : undefined;
}

function parseLifecycleRoles(value?: string): LifecycleRole[] {
  if (!value) {
    return [...DEFAULT_LIFECYCLE_ACTOR.roles];
  }

  const parsedRoles = value
    .split(",")
    .map((role) => role.trim())
    .filter((role): role is LifecycleRole =>
      VALID_LIFECYCLE_ROLES.has(role as LifecycleRole)
    );

  return parsedRoles.length > 0
    ? parsedRoles
    : [...DEFAULT_LIFECYCLE_ACTOR.roles];
}

function getActorValue(
  event: H3Event,
  headerName: string,
  queryName: string
): string | undefined {
  const headerValue = getHeader(event, headerName);

  if (headerValue) {
    return headerValue;
  }

  return getQueryValue(event, queryName);
}

function actorFromHeaders(event: H3Event): LifecycleActor {
  return {
    id:
      getActorValue(event, "x-actor-id", "actorId") ??
      DEFAULT_LIFECYCLE_ACTOR.id,
    name:
      getActorValue(event, "x-actor-name", "actorName") ??
      DEFAULT_LIFECYCLE_ACTOR.name,
    roles: parseLifecycleRoles(
      getActorValue(event, "x-actor-roles", "actorRoles") ?? undefined
    ),
  };
}

function actorFromSession(
  session: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>
): LifecycleActor {
  // The OIDC `groups` claim absent in PE IdP today — honour self-claim
  // placeholder flag the AppActor carry-over may surface. Until Cedar ops
  // ship, `sub` is the only trusted id we derive server-side; the
  // placeholder is the local `peaky:actor-override-roles` value the
  // Profile modal toggles. Server cannot read localStorage — so we
  // fall back to groups-based admin elevation only.
  const groups = session.groups ?? [];
  const isAdmin = groups.some((g) => ADMIN_LIFECYCLE_GROUPS.has(g));
  return {
    id: session.sub,
    name:
      session.name ??
      session.preferred_username ??
      session.email ??
      session.sub,
    roles: [isAdmin ? "admin" : "member"],
  };
}

/**
 * Resolves the lifecycle actor for the current request.
 *
 * Trust hierarchy (closes /merge-check B-1 — `x-actor-roles` spoofing):
 *   1. Sealed OIDC session, when present. Identity, name and role claims
 *      come from the IdP-issued token — the client cannot forge them.
 *   2. Client-supplied `x-actor-*` headers, used as a fallback ONLY when
 *      OIDC is not configured (dev / tests / e2e paths where OIDC is
 *      intentionally disabled). In production OIDC is always configured, so
 *      this branch is unreachable from a real client.
 *
 * The function fails closed in production or when OIDC is enabled but no
 * session is present: it throws a 401 `Unauthorized`. Returning a fake
 * `roles: ["member"]` actor would let an unauthenticated caller slip
 * past downstream checks that grant the member role. The dev-only header
 * fallback is the single path where unauthenticated requests get an actor.
 */
export async function getLifecycleActor(
  event: H3Event
): Promise<LifecycleActor> {
  const session = await getAuthSession(event);
  if (session) {
    return actorFromSession(session);
  }

  // Fail closed: in production, or when OIDC is enabled in non-prod, never
  // return an anonymous `member` actor — that would let unauthenticated
  // callers slip past role-based checks downstream. Throw a 401 and let
  // Nitro surface the rejection at the wire. The header fallback below is
  // reserved for the dev / test / e2e path where OIDC env vars are
  // intentionally unset.
  if (process.env.NODE_ENV === "production" || isOidcEnabled(event)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  return actorFromHeaders(event);
}
