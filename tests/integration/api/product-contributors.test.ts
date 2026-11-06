import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

const PRODUCT_PAYMENTS = "01932b3c-7d00-7000-8000-000000000001";

describe("GET /api/products/:id/contributors", async () => {
  await setup();

  it("returns contributors for a known product", async () => {
    const response = await $fetch(
      `/api/products/${PRODUCT_PAYMENTS}/contributors`
    );

    expect(response).toHaveProperty("productId", PRODUCT_PAYMENTS);
    expect(response).toHaveProperty("productName");
    expect(response).toHaveProperty("contributors");
    expect(Array.isArray(response.contributors)).toBe(true);
  });

  it("returns empty contributors for unknown product", async () => {
    const response = await $fetch(
      `/api/products/unknown-product-id/contributors`
    );

    expect(response).toMatchObject({
      productId: "unknown-product-id",
      productName: "",
      contributors: [],
    });
  });

  it("uses query params when product is not found", async () => {
    const response = await $fetch(
      `/api/products/unknown-product-id/contributors?teamIds=payments-scalability`
    );

    expect(response).toHaveProperty("productId", "unknown-product-id");
    expect(Array.isArray(response.contributors)).toBe(true);
    // The payments-scalability team has reviews in the seed data
    expect(response.contributors.length).toBeGreaterThan(0);
  });
});
