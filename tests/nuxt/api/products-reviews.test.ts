import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  setupNitroStubs,
  resetNitroStubs,
  setRouterParam,
  setBody,
  setQuery,
  setActorHeaders,
} from "../helpers/nitro";
import { seedProduct, resetArray } from "../helpers/seed";
import {
  clearLifecycleAuditEvents,
  getLifecycleAuditEvents,
} from "../../../server/data/lifecycle-audit";
import {
  clearRuntimeEvents,
  getEventsByReviewId,
} from "../../../server/data/review-events";
import { products, setArchivedProductIds } from "../../../server/data/products";
import { productReviews } from "../../../server/data/product-reviews";
import { templateFixtureDrafts } from "../../../server/data/templates";
type ProductsIndexPostHandler =
  (typeof import("../../../server/api/products/index.post"))["default"];
type ProductPatchHandler =
  (typeof import("../../../server/api/products/[id].patch"))["default"];
type ProductDeleteHandler =
  (typeof import("../../../server/api/products/[id].delete"))["default"];
type ProductReviewsGetHandler =
  (typeof import("../../../server/api/products/[id]/reviews.get"))["default"];
type ProductReviewsPostHandler =
  (typeof import("../../../server/api/products/[id]/reviews.post"))["default"];

interface CreatedProduct {
  id: string;
  name: string;
  origin: string;
  isExternal: boolean;
}

interface ProductReviewRecord {
  id: string;
  productId?: string;
  name: string;
  status: string;
  templateIds?: string[];
  templateRevisionIds?: string[];
  applicationIds?: string[];
}

/** First seeded template ID from server/data/templates.ts */
const ORR_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001001";
const ORR_REVISION_ID = "01932b3c-7d00-7000-8100-000000001001";
const DRAFT_REVISION_ID = templateFixtureDrafts[0]!.id;

describe("Products API handlers - delete and reviews", () => {
  const initialProducts = structuredClone(products);
  const initialProductReviews = structuredClone(productReviews);

  const stubs = setupNitroStubs();

  let productsIndexPostHandler: ProductsIndexPostHandler;
  let productPatchHandler: ProductPatchHandler;
  let productDeleteHandler: ProductDeleteHandler;
  let productReviewsGetHandler: ProductReviewsGetHandler;
  let productReviewsPostHandler: ProductReviewsPostHandler;

  beforeAll(async () => {
    productsIndexPostHandler = (
      await import("../../../server/api/products/index.post")
    ).default;
    productPatchHandler = (
      await import("../../../server/api/products/[id].patch")
    ).default;
    productDeleteHandler = (
      await import("../../../server/api/products/[id].delete")
    ).default;
    productReviewsGetHandler = (
      await import("../../../server/api/products/[id]/reviews.get")
    ).default;
    productReviewsPostHandler = (
      await import("../../../server/api/products/[id]/reviews.post")
    ).default;
  });

  beforeEach(() => {
    resetNitroStubs(stubs);
  });

  afterEach(() => {
    resetArray(products, initialProducts);
    setArchivedProductIds([]);
    resetArray(productReviews, initialProductReviews);
    clearLifecycleAuditEvents();
    clearRuntimeEvents();
  });

  describe("DELETE /api/products/:id", () => {
    it("returns 400 when id is missing", async () => {
      try {
        await productDeleteHandler({} as never);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Product ID is required");
      }
    });

    it("returns 404 for unknown product", async () => {
      setRouterParam(stubs, "id", "product-unknown");

      try {
        await productDeleteHandler({} as never);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Product not found");
      }
    });

    it("rejects deleting active products", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>
      );

      setRouterParam(stubs, "id", created.id);

      try {
        await productDeleteHandler({} as never);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain(
          "Only archived products can be deleted"
        );
      }
    });

    it("permanently deletes archived products and related reviews", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>,
        { name: "Deletable Product" }
      );

      setRouterParam(stubs, "id", created.id);
      setBody(stubs, { status: "archived" });
      await productPatchHandler({} as never);

      setBody(stubs, { confirmationName: created.name });

      const deleted = (await productDeleteHandler(
        {} as never
      )) as CreatedProduct;

      expect(deleted.id).toBe(created.id);
      expect(products.some((product) => product.id === created.id)).toBe(false);
      expect(
        productReviews.some((review) => review.productId === created.id)
      ).toBe(false);
    });

    it("requires typing the product name before permanent delete", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>,
        { name: "Confirm Delete Product" }
      );

      setRouterParam(stubs, "id", created.id);
      setBody(stubs, { status: "archived" });
      await productPatchHandler({} as never);

      setBody(stubs, { confirmationName: "Wrong Name" });

      await expect(productDeleteHandler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("records an audit event when archived products are deleted", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>,
        { name: "Audit Delete Product" }
      );

      setActorHeaders(stubs, {
        id: "heitorl",
        name: "Heitor",
        roles: "admin",
      });
      setRouterParam(stubs, "id", created.id);
      setBody(stubs, { status: "archived" });
      await productPatchHandler({} as never);

      clearLifecycleAuditEvents();
      setBody(stubs, { confirmationName: created.name });
      await productDeleteHandler({} as never);

      expect(getLifecycleAuditEvents()).toMatchObject([
        {
          action: "delete",
          subjectType: "product",
          subjectId: created.id,
          actorId: "heitorl",
          associatedResources: {
            reviewsCount: 0,
            activeReviewCount: 0,
          },
        },
      ]);
    });
  });

  describe("GET /api/products/:id/reviews", () => {
    it("throws error for unknown product", async () => {
      setRouterParam(stubs, "id", "product-unknown");

      try {
        await productReviewsGetHandler({} as never);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Product not found");
      }
    });

    it("returns empty array for product with no reviews", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>
      );

      setRouterParam(stubs, "id", created.id);

      const result = (await productReviewsGetHandler(
        {} as never
      )) as ProductReviewRecord[];

      expect(result).toEqual([]);
    });

    it("hides archived reviews by default and returns them when requested", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>
      );

      productReviews.push({
        id: "product-review-archived",
        productId: created.id,
        name: "Archived product review",
        templateIds: [ORR_TEMPLATE_ID],
        templateRevisionIds: [ORR_REVISION_ID],
        templateNames: ["Operational Readiness Review (ORR)"],
        templateId: ORR_TEMPLATE_ID,
        templateRevisionId: ORR_REVISION_ID,
        templateName: "Operational Readiness Review (ORR)",
        templates: [],
        pillars: [],
        status: "archived",
        createdAt: "2026-03-18T00:00:00Z",
        updatedAt: "2026-03-18T00:00:00Z",
        assessors: [],
        reviewers: [],
      } as never);

      setRouterParam(stubs, "id", created.id);

      const activeResult = (await productReviewsGetHandler(
        {} as never
      )) as ProductReviewRecord[];

      expect(
        activeResult.some((review) => review.id === "product-review-archived")
      ).toBe(false);

      setQuery(stubs, { includeArchived: "true" });

      const fullResult = (await productReviewsGetHandler(
        {} as never
      )) as ProductReviewRecord[];

      expect(
        fullResult.some((review) => review.id === "product-review-archived")
      ).toBe(true);
    });
  });

  describe("POST /api/products/:id/reviews", () => {
    it("returns 404 for unknown product", async () => {
      setRouterParam(stubs, "id", "product-unknown");
      setBody(stubs, {
        name: "Q1 Review",
        templateRevisionIds: [ORR_REVISION_ID],
      });

      await expect(
        productReviewsPostHandler({} as never)
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("rejects an empty Template Revision selection", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>
      );

      setRouterParam(stubs, "id", created.id);
      setBody(stubs, {
        name: "Q1 Review",
        templateRevisionIds: [],
      });

      await expect(
        productReviewsPostHandler({} as never)
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it.each([
      ["a parent Template ID", [ORR_TEMPLATE_ID]],
      ["duplicate Revision IDs", [ORR_REVISION_ID, ORR_REVISION_ID]],
      ["a draft Revision", [DRAFT_REVISION_ID]],
    ])("rejects %s", async (_label, revisionIds) => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>
      );
      setRouterParam(stubs, "id", created.id);
      setBody(stubs, {
        name: "Invalid Review",
        templateRevisionIds: revisionIds,
      });

      await expect(
        productReviewsPostHandler({} as never)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects applications outside the Product component scope", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>
      );
      setRouterParam(stubs, "id", created.id);
      setBody(stubs, {
        name: "Invalid Review",
        templateRevisionIds: [ORR_REVISION_ID],
        applicationIds: ["application-outside-product"],
      });

      await expect(
        productReviewsPostHandler({} as never)
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("creates a product review", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>,
        { componentIds: ["application-1"] }
      );

      setRouterParam(stubs, "id", created.id);
      setBody(stubs, {
        name: "Q1 Review",
        templateRevisionIds: [ORR_REVISION_ID],
        applicationIds: ["application-1"],
      });

      const review = (await productReviewsPostHandler(
        {} as never
      )) as ProductReviewRecord;

      expect(review.productId).toBe(created.id);
      expect(review.name).toBe("Q1 Review");
      expect(review.status).toBe("draft");
      expect(review.templateIds).toEqual([ORR_TEMPLATE_ID]);
      expect(review.templateRevisionIds).toEqual([ORR_REVISION_ID]);
      expect(review.applicationIds).toEqual(["application-1"]);
      expect(
        getEventsByReviewId(review.id).some(
          (reviewEvent) => reviewEvent.eventType === "ReviewCreated.v1"
        )
      ).toBe(true);
    });
  });
});
