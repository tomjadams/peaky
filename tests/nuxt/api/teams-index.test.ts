import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/teams", () => {
  it("only includes teams that already have reviews", async () => {
    const handler = (await import("../../../server/api/teams/index.get"))
      .default;
    const teams = handler({} as never) as Array<{ id: string }>;

    expect(teams).toHaveLength(1);
    expect(teams[0]?.id).toBe("payments-scalability");
  });
});
