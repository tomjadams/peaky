import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

// Valid demo-data IDs (UUID7 format) — must match server/data/*.ts
const TEMPLATE_PEAK_SEASON = "01932b3c-7d00-7000-8000-000000001001";
const TEMPLATE_GDPR = "01932b3c-7d00-7000-8000-000000001003";
const PRODUCT_PAYMENTS = "01932b3c-7d00-7000-8000-000000000001";
const TEAM_PAYMENTS = "payments-scalability";

describe("Review creation API contracts", async () => {
  await setup();

  it("POST /api/teams/:id/reviews supports subject-only scope without applicationIds", async () => {
    const response = await $fetch(`/api/teams/${TEAM_PAYMENTS}/reviews`, {
      method: "POST",
      body: {
        name: `Team Subject Scope ${Date.now()}`,
        templateIds: [TEMPLATE_PEAK_SEASON],
      },
    });

    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("teamId", TEAM_PAYMENTS);
    expect(response).toHaveProperty("templateIds");
    expect(response.templateIds).toEqual([TEMPLATE_PEAK_SEASON]);
    expect(response.applicationIds).toBeUndefined();
  });

  it("POST /api/teams/:id/reviews supports selected-app scope with applicationIds", async () => {
    const response = await $fetch(`/api/teams/${TEAM_PAYMENTS}/reviews`, {
      method: "POST",
      body: {
        name: `Team Selected Apps ${Date.now()}`,
        templateIds: [TEMPLATE_PEAK_SEASON],
        applicationIds: ["modificationqueueprocessor"],
      },
    });

    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("teamId", TEAM_PAYMENTS);
    expect(response.applicationIds).toEqual(["modificationqueueprocessor"]);
  });

  it("POST /api/teams/:id/reviews rejects unknown template IDs", async () => {
    await expect(
      $fetch(`/api/teams/${TEAM_PAYMENTS}/reviews`, {
        method: "POST",
        body: {
          name: `Bad Template ${Date.now()}`,
          templateIds: ["template-does-not-exist"],
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining("Unknown template IDs"),
    });
  });

  it("POST /api/products/:id/reviews creates product review contract", async () => {
    const response = await $fetch(`/api/products/${PRODUCT_PAYMENTS}/reviews`, {
      method: "POST",
      body: {
        name: `Product Review ${Date.now()}`,
        templateIds: [TEMPLATE_PEAK_SEASON, TEMPLATE_GDPR],
      },
    });

    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("productId", PRODUCT_PAYMENTS);
    expect(response.templateIds).toEqual([TEMPLATE_PEAK_SEASON, TEMPLATE_GDPR]);
    expect(response.templateNames.length).toBe(2);
  });
});
