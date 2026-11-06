import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

type HealthHandler =
  (typeof import("../../../server/api/health.get"))["default"];

const { useRuntimeConfigMock } = vi.hoisted(() => ({
  useRuntimeConfigMock: vi.fn(),
}));

mockNuxtImport("useRuntimeConfig", () => useRuntimeConfigMock);

describe("GET /api/health", () => {
  let handler: HealthHandler;

  beforeAll(async () => {
    useRuntimeConfigMock.mockReturnValue({
      app: { buildId: "deployment-build" },
    });
    vi.stubGlobal(
      "defineEventHandler",
      (eventHandler: unknown) => eventHandler
    );
    handler = (await import("../../../server/api/health.get")).default;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("returns the active deployment build ID", () => {
    expect(handler({} as never)).toEqual({ buildId: "deployment-build" });
  });
});
