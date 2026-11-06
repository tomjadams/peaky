import { afterEach, describe, expect, it, vi } from "vitest";

async function loadRuntimeConfig() {
  vi.resetModules();
  vi.stubGlobal("defineNuxtConfig", (config: unknown) => config);
  const config = (await import("../../../nuxt.config")).default as {
    runtimeConfig?: {
      templatePublishingEnabled?: boolean;
      public?: { templatePublishingEnabled?: boolean };
    };
  };
  return config.runtimeConfig;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Template publication runtime gate", () => {
  it("defaults matching private and public values to false", async () => {
    const runtimeConfig = await loadRuntimeConfig();

    expect(runtimeConfig?.templatePublishingEnabled).toBe(false);
    expect(runtimeConfig?.public?.templatePublishingEnabled).toBe(false);
  });

  it("derives matching private and public values from the private source", async () => {
    vi.stubEnv("NUXT_TEMPLATE_PUBLISHING_ENABLED", "true");

    const runtimeConfig = await loadRuntimeConfig();
    expect(runtimeConfig?.templatePublishingEnabled).toBe(true);
    expect(runtimeConfig?.public?.templatePublishingEnabled).toBe(true);
  });

  it("does not allow an independent public environment override", async () => {
    vi.stubEnv("NUXT_TEMPLATE_PUBLISHING_ENABLED", "false");
    vi.stubEnv("NUXT_PUBLIC_TEMPLATE_PUBLISHING_ENABLED", "true");

    const runtimeConfig = await loadRuntimeConfig();
    expect(runtimeConfig?.templatePublishingEnabled).toBe(false);
    expect(runtimeConfig?.public?.templatePublishingEnabled).toBe(false);
  });
});
