import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { reviews } from "../../../server/data/reviews";
import { productReviews } from "../../../server/data/product-reviews";
import { findReviewById } from "../../../server/data/review-lookup";

describe("findReviewById", () => {
  const teamReview = {
    id: "test-team-review",
    name: "Team Review",
    teamId: "team-001",
    orgId: "org-001",
    status: "draft" as const,
    templateId: "t1",
    templateName: "T1",
    templates: [],
    pillars: [],
    assessors: [],
    reviewers: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  const productReview = {
    id: "test-product-review",
    productId: "product-001",
    name: "Product Review",
    status: "draft" as const,
    templateId: "t1",
    templateName: "T1",
    templateIds: ["t1"],
    templateNames: ["T1"],
    templates: [],
    pillars: [],
    assessors: [],
    reviewers: [],
    componentIds: [],
    scope: "full" as const,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    reviews.push(teamReview as never);
    productReviews.push(productReview as never);
  });

  afterEach(() => {
    const teamIdx = reviews.findIndex((r) => r.id === "test-team-review");
    if (teamIdx !== -1) reviews.splice(teamIdx, 1);

    const productIdx = productReviews.findIndex(
      (r) => r.id === "test-product-review"
    );
    if (productIdx !== -1) productReviews.splice(productIdx, 1);
  });

  it("resolves a team review by id", () => {
    const result = findReviewById("test-team-review");
    expect(result).toBeDefined();
    expect(result?.id).toBe("test-team-review");
    expect(result?.name).toBe("Team Review");
  });

  it("resolves a product review by id", () => {
    const result = findReviewById("test-product-review");
    expect(result).toBeDefined();
    expect(result?.id).toBe("test-product-review");
    expect(result?.name).toBe("Product Review");
  });

  it("returns undefined for unknown id", () => {
    const result = findReviewById("does-not-exist");
    expect(result).toBeUndefined();
  });

  it("product review is cast with teamId and orgId for unified interface", () => {
    const result = findReviewById("test-product-review");
    expect(result).toHaveProperty("teamId");
    expect(result).toHaveProperty("orgId");
  });
});
