import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { H3Event } from "h3";
import { getLifecycleActor } from "../../../../server/utils/lifecycleActor";
import { getAuthSession } from "../../../../server/utils/auth/session";
import { isOidcEnabled } from "../../../../server/utils/auth/oidc-config";
import { DEFAULT_LIFECYCLE_ACTOR } from "~/lifecycle/management";

vi.mock("../../../../server/utils/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("../../../../server/utils/auth/oidc-config", () => ({
  isOidcEnabled: vi.fn(),
}));

// Re-establish default mock after `mockReset()`. The hoisted vi.mock provides
// a vi.fn(); each beforeEach calls mockReset() which clears both the call
// history and any pre-set implementation, then the per-test mockResolvedValue
// / mockResolvedValueOnce calls re-establish behavior.

const mockedGetAuthSession = vi.mocked(getAuthSession);
const mockedIsOidcEnabled = vi.mocked(isOidcEnabled);

const originalNodeEnv = process.env.NODE_ENV;

let headersForStub: Record<string, string | undefined> = {};

function buildEvent(): H3Event {
  return { context: {} } as H3Event;
}

function baseExp(): number {
  return 1_000_000_000; // pinned clock avoids wall-clock drift in assertions
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  vi.setSystemTime(1_000_000_000_000);
  vi.stubGlobal("getHeader", (_event: H3Event, name: string) =>
    name in headersForStub ? headersForStub[name] : undefined
  );
  vi.stubGlobal("getQuery", () => ({}));
  // Stub the h3 `createError` so the fail-closed 401 throw in
  // `getLifecycleActor` propagates as a regular Error we can match against.
  vi.stubGlobal(
    "createError",
    (input: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(input.statusMessage), input)
  );
  mockedGetAuthSession.mockReset();
  mockedIsOidcEnabled.mockReturnValue(false);
  headersForStub = {};
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("getLifecycleActor (B-1 trust hierarchy)", () => {
  it("uses the sealed OIDC session when present and never trusts a spoofed x-actor-roles header", async () => {
    mockedGetAuthSession.mockResolvedValue({
      sub: "00uhf9thcrWEZyNRe417",
      email: "heitor.lessa@adyen.com",
      name: "Heitor Lessa",
      exp: baseExp(),
      groups: [],
    });

    // Client tries to escalate via spoofed header — must be ignored when
    // an IdP-issued session is present.
    headersForStub = {
      "x-actor-id": "spoofed-id",
      "x-actor-name": "Spoofed Name",
      "x-actor-roles": "admin",
    };

    const actor = await getLifecycleActor(buildEvent());

    expect(actor.id).toBe("00uhf9thcrWEZyNRe417");
    expect(actor.name).toBe("Heitor Lessa");
    expect(actor.roles).toEqual(["member"]);
  });

  it("elevates session actor to admin when session groups contain 'peaky-admins'", async () => {
    mockedGetAuthSession.mockResolvedValue({
      sub: "00uhf9thcrWEZyNRe417",
      email: "heitor.lessa@adyen.com",
      name: "Heitor Lessa",
      exp: baseExp(),
      groups: ["peaky-admins", "platform-team"],
    });

    headersForStub = { "x-actor-roles": "member" };

    const actor = await getLifecycleActor(buildEvent());

    expect(actor.roles).toEqual(["admin"]);
  });

  it("falls back to client-supplied headers when OIDC is disabled (dev/e2e path)", async () => {
    mockedGetAuthSession.mockResolvedValue(null);
    mockedIsOidcEnabled.mockReturnValue(false);

    headersForStub = {
      "x-actor-id": "dev-user",
      "x-actor-name": "Dev User",
      "x-actor-roles": "admin",
    };

    const actor = await getLifecycleActor(buildEvent());

    expect(actor).toEqual({
      id: "dev-user",
      name: "Dev User",
      roles: ["admin"],
    });
  });

  it("rejects the request when OIDC is enabled but no session exists (fail closed on Spoofable headers)", async () => {
    mockedGetAuthSession.mockResolvedValue(null);
    mockedIsOidcEnabled.mockReturnValue(true);

    headersForStub = {
      "x-actor-id": "spoofed-id",
      "x-actor-name": "Spoofed Name",
      "x-actor-roles": "admin",
    };

    await expect(getLifecycleActor(buildEvent())).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: expect.stringContaining("Unauthorized"),
    });
  });

  it("rejects the request in production even when OIDC is disabled and Spoofable headers are supplied", async () => {
    process.env.NODE_ENV = "production";
    mockedGetAuthSession.mockResolvedValue(null);
    mockedIsOidcEnabled.mockReturnValue(false);

    headersForStub = {
      "x-actor-id": "spoofed-id",
      "x-actor-name": "Spoofed Name",
      "x-actor-roles": "admin",
    };

    await expect(getLifecycleActor(buildEvent())).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: expect.stringContaining("Unauthorized"),
    });
  });

  it("falls back to DEFAULT_LIFECYCLE_ACTOR when both session and headers are absent", async () => {
    mockedGetAuthSession.mockResolvedValue(null);
    headersForStub = {};

    const actor = await getLifecycleActor(buildEvent());

    expect(actor).toEqual(DEFAULT_LIFECYCLE_ACTOR);
  });

  it("prefers preferred_username over email and sub when name is missing", async () => {
    mockedGetAuthSession.mockResolvedValue({
      sub: "00u-fallback",
      email: "user@adyen.com",
      name: undefined,
      preferred_username: "username-from-claims",
      exp: baseExp(),
      groups: [],
    });

    headersForStub = {};
    const actor = await getLifecycleActor(buildEvent());
    expect(actor.name).toBe("username-from-claims");
    expect(actor.id).toBe("00u-fallback");
  });

  it("preserves an explicitly blank session name instead of falling through", async () => {
    mockedGetAuthSession.mockResolvedValue({
      sub: "00u-blank",
      email: "user@adyen.com",
      name: "",
      preferred_username: "username-from-claims",
      exp: baseExp(),
      groups: [],
    });

    headersForStub = {};
    const actor = await getLifecycleActor(buildEvent());
    expect(actor.name).toBe("");
    expect(actor.id).toBe("00u-blank");
  });

  it("falls back from header to query param when headers are absent (dev/test path)", async () => {
    // Some test envs and the simulator strip custom headers — the actor
    // resolver falls through to the matching query param. Order matters:
    // header wins over query when both are supplied (previous test would
    // catch a regression that flipped the precedence).
    mockedGetAuthSession.mockResolvedValue(null);
    headersForStub = {};
    vi.stubGlobal("getQuery", () => ({
      actorId: "00u-from-query",
      actorName: "Query User",
      actorRoles: "admin",
    }));

    const actor = await getLifecycleActor(buildEvent());
    expect(actor.id).toBe("00u-from-query");
    expect(actor.name).toBe("Query User");
    expect(actor.roles).toEqual(["admin"]);
  });
});
