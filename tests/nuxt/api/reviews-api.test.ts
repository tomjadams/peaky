import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import type { H3Event } from "h3";
import type { Review } from "~/models";
import { productReviews } from "../../../server/data/product-reviews";
import { reviews } from "../../../server/data/reviews";
import {
  clearRuntimeEvents,
  getEventsByReviewId,
} from "../../../server/data/review-events";
import {
  setupNitroStubs,
  resetNitroStubs,
  type NitroStubs,
} from "../helpers/nitro";
import { resetArray } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

// oxlint-disable-next-line no-redundant-type-constituents
type EventHandler = (event: H3Event) => Promise<unknown> | unknown;

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

let nextId = 1;

function buildTestReview(overrides: Partial<Review> = {}): Review {
  const id = `test-review-${nextId++}`;
  return {
    id,
    name: `Test Review ${id}`,
    teamId: "test-team-001",
    orgId: "test-org-001",
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    templateName: "Operational Readiness Review (ORR)",
    templateIds: ["01932b3c-7d00-7000-8000-000000001001"],
    templateNames: ["Operational Readiness Review (ORR)"],
    templates: [
      {
        templateId: "01932b3c-7d00-7000-8000-000000001001",
        templateRevisionId: "01932b3c-7d00-7000-8000-000000001001-revision",
        templateName: "Operational Readiness Review (ORR)",
        revisionNumber: 1,
        revisionSummary: null,
        progress: 0,
        pillars: [],
      },
    ],
    pillars: [],
    status: "in-progress",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    assessors: [
      { id: "advisor-001", name: "Elena Kowalski", email: "elena@test.com" },
    ],
    advisors: [
      { id: "advisor-001", name: "Elena Kowalski", email: "elena@test.com" },
    ],
    reviewers: [
      { id: "advisor-001", name: "Elena Kowalski", email: "elena@test.com" },
    ],
    ...overrides,
  } as Review;
}

function buildTestProductReview(overrides: Record<string, unknown> = {}) {
  const id = `test-product-review-${nextId++}`;
  return {
    id,
    productId: "test-product-001",
    name: `Test Product Review ${id}`,
    status: "in-progress",
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    templateName: "Operational Readiness Review (ORR)",
    templateIds: ["01932b3c-7d00-7000-8000-000000001001"],
    templateNames: ["Operational Readiness Review (ORR)"],
    templates: [],
    pillars: [],
    assessors: [],
    reviewers: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Reviews API", () => {
  const stubs: NitroStubs = setupNitroStubs();

  const initialReviews = structuredClone(reviews);
  const initialProductReviews = structuredClone(productReviews);

  let patchHandler: EventHandler;
  let deleteHandler: EventHandler;
  let getHandler: EventHandler;
  let clearReviewLifecycleState: typeof import("../../../server/data/reviews").clearReviewLifecycleState;
  let clearProductReviewLifecycleState: typeof import("../../../server/data/product-reviews").clearProductReviewLifecycleState;

  beforeAll(async () => {
    const patchModule = await import("../../../server/api/reviews/[id].patch");
    const deleteModule =
      await import("../../../server/api/reviews/[id].delete");
    const getModule = await import("../../../server/api/reviews/[id].get");
    const reviewsModule = await import("../../../server/data/reviews");
    const productReviewsModule =
      await import("../../../server/data/product-reviews");

    patchHandler = patchModule.default;
    deleteHandler = deleteModule.default;
    getHandler = getModule.default;
    clearReviewLifecycleState = reviewsModule.clearReviewLifecycleState;
    clearProductReviewLifecycleState =
      productReviewsModule.clearProductReviewLifecycleState;
  });

  beforeEach(() => {
    resetNitroStubs(stubs);
    clearRuntimeEvents();
    nextId = 1;
  });

  afterEach(() => {
    resetArray(reviews, initialReviews);
    resetArray(productReviews, initialProductReviews);
    clearReviewLifecycleState();
    clearProductReviewLifecycleState();
    clearRuntimeEvents();
  });

  describe("GET /api/reviews/:id", () => {
    it("returns 400 when review ID is missing", async () => {
      try {
        await getHandler({} as never);
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Error).message).toContain("Review ID is required");
      }
    });

    it("returns 404 when review does not exist", async () => {
      stubs.routerParams = { id: "nonexistent" };

      try {
        await getHandler({} as never);
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Error).message).toContain("Review not found");
      }
    });

    it("returns review when found", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };

      const result = (await getHandler({} as never)) as Review;
      expect(result).toHaveProperty("id", testReview.id);
      expect(result).toHaveProperty("name", testReview.name);
      expect(result).toHaveProperty("teamId", testReview.teamId);
      expect(result.assessors.map((p) => p.id)).toEqual(["advisor-001"]);
    });
  });

  describe("PATCH /api/reviews/:id", () => {
    it("returns 400 when review ID is missing", async () => {
      stubs.body.value = { name: "New Name" };

      await expect(patchHandler({} as never)).rejects.toThrow(
        "Review ID is required"
      );
    });

    it("returns 400 when name is missing", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = {};

      await expect(patchHandler({} as never)).rejects.toThrow();
    });

    it("returns 400 when name is empty after trim", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = { name: "   " };

      await expect(patchHandler({} as never)).rejects.toThrow();
    });

    it("returns 400 when name exceeds 120 characters", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = { name: "x".repeat(121) };

      await expect(patchHandler({} as never)).rejects.toThrow();
    });

    it("returns 404 when review does not exist", async () => {
      stubs.routerParams = { id: "nonexistent" };
      stubs.body.value = { name: "New Name" };

      await expect(patchHandler({} as never)).rejects.toThrow(
        "Review not found"
      );
    });

    it("returns 409 when duplicate name exists in same team", async () => {
      const existingReview = buildTestReview({ name: "Existing Review" });
      const targetReview = buildTestReview({
        teamId: existingReview.teamId,
        name: "Other Review",
      });
      reviews.push(existingReview, targetReview);

      stubs.routerParams = { id: targetReview.id };
      stubs.body.value = { name: "Existing Review" };

      try {
        await patchHandler({} as never);
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Error).message).toContain(
          "A review with this name already exists"
        );
      }
    });

    it("allows same name on a different review subject", async () => {
      const teamReview = buildTestReview({ name: "Shared Name" });
      reviews.push(teamReview);

      const prodReview = buildTestProductReview({ name: "Different Name" });
      productReviews.push(prodReview as never);

      stubs.routerParams = { id: prodReview.id };
      stubs.body.value = { name: "Shared Name" };

      const result = await patchHandler({} as never);
      expect(result).toHaveProperty("name", "Shared Name");
    });

    it("returns updated review with new updatedAt timestamp", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);
      const beforeUpdate = testReview.updatedAt;

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = { name: "Updated Review Name" };

      const result = await patchHandler({} as never);
      expect(result).toHaveProperty("name", "Updated Review Name");
      expect(result).toHaveProperty("updatedAt");
      expect((result as Record<string, unknown>).updatedAt).not.toBe(
        beforeUpdate
      );
    });

    it("trims whitespace from name", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = { name: "  Trimmed Name  " };

      const result = await patchHandler({} as never);
      expect(result).toHaveProperty("name", "Trimmed Name");
    });

    it("archives a team review for an assigned reviewer and records an audit event", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = {
        action: "archive",
        actor: { id: "advisor-001", name: "Elena Kowalski" },
      };

      const result = await patchHandler({} as never);

      expect(result).toHaveProperty("status", "archived");
      expect(
        getEventsByReviewId(testReview.id).some(
          (reviewEvent) => reviewEvent.eventType === "ReviewArchived.v1"
        )
      ).toBe(true);
    });

    it("rejects archiving a product review for non-owners", async () => {
      const prodReview = buildTestProductReview();
      productReviews.push(prodReview as never);

      stubs.routerParams = { id: prodReview.id };
      stubs.body.value = {
        action: "archive",
        actor: { id: "user-001", name: "Sarah Chen" },
      };

      await expect(patchHandler({} as never)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("restores a product review for an admin and records an audit event", async () => {
      const prodReview = buildTestProductReview();
      productReviews.push(prodReview as never);

      // Archive first
      stubs.routerParams = { id: prodReview.id };
      stubs.body.value = {
        action: "archive",
        actor: { id: "admin-001", name: "Avery Admin" },
      };
      await patchHandler({} as never);

      // Restore
      stubs.body.value = {
        action: "restore",
        actor: { id: "admin-001", name: "Avery Admin" },
      };

      const result = await patchHandler({} as never);

      expect(result).toHaveProperty("status", "in-progress");
      expect(
        getEventsByReviewId(prodReview.id).some(
          (reviewEvent) => reviewEvent.eventType === "ReviewRestored.v1"
        )
      ).toBe(true);
    });
  });

  describe("DELETE /api/reviews/:id", () => {
    it("requires an admin for permanent deletion", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = {
        actor: { id: "advisor-001", name: "Elena Kowalski" },
      };

      await expect(deleteHandler({} as never)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("only deletes archived reviews permanently", async () => {
      const testReview = buildTestReview({ status: "in-progress" });
      reviews.push(testReview);

      stubs.routerParams = { id: testReview.id };
      stubs.body.value = {
        actor: { id: "admin-001", name: "Avery Admin" },
      };

      await expect(deleteHandler({} as never)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("permanently deletes archived team reviews and records the delete event", async () => {
      const testReview = buildTestReview();
      reviews.push(testReview);

      // Archive first
      stubs.routerParams = { id: testReview.id };
      stubs.body.value = {
        action: "archive",
        actor: { id: "admin-001", name: "Avery Admin" },
      };
      await patchHandler({} as never);

      // Delete
      stubs.body.value = {
        actor: { id: "admin-001", name: "Avery Admin" },
      };

      const result = await deleteHandler({} as never);

      expect(result).toHaveProperty("id", testReview.id);
      expect(reviews.some((review) => review.id === testReview.id)).toBe(false);
      expect(
        getEventsByReviewId(testReview.id).some(
          (reviewEvent) => reviewEvent.eventType === "ReviewDeleted.v1"
        )
      ).toBe(true);
    });
  });
});
