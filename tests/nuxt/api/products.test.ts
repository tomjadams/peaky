import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  setupNitroStubs,
  resetNitroStubs,
  setRouterParam,
  setBody,
  setActorHeaders,
} from "../helpers/nitro";
import { seedProduct, resetArray } from "../helpers/seed";
import {
  clearLifecycleAuditEvents,
  getLifecycleAuditEvents,
} from "../../../server/data/lifecycle-audit";
import { clearRuntimeEvents } from "../../../server/data/review-events";
import { products, setArchivedProductIds } from "../../../server/data/products";
import { productReviews } from "../../../server/data/product-reviews";
type ProductsIndexGetHandler =
  (typeof import("../../../server/api/products/index.get"))["default"];
type ProductsIndexPostHandler =
  (typeof import("../../../server/api/products/index.post"))["default"];
type ProductByIdHandler =
  (typeof import("../../../server/api/products/[id].get"))["default"];
type ProductPatchHandler =
  (typeof import("../../../server/api/products/[id].patch"))["default"];

interface ProductRecord {
  id: string;
  name: string;
  origin: string;
  isExternal: boolean;
  createdAt: string;
}

interface CreatedProduct {
  id: string;
  name: string;
  origin: string;
  isExternal: boolean;
}

const createProductPayload = (overrides: Record<string, unknown> = {}) => ({
  name: "Test Product",
  origin: "bespoke",
  isExternal: false,
  productManagerId: "vlads",
  teamIds: ["checkout-core"],
  ...overrides,
});

describe("Products API handlers", () => {
  const initialProducts = structuredClone(products);
  const initialProductReviews = structuredClone(productReviews);

  const stubs = setupNitroStubs();

  let productsIndexGetHandler: ProductsIndexGetHandler;
  let productsIndexPostHandler: ProductsIndexPostHandler;
  let productByIdHandler: ProductByIdHandler;
  let productPatchHandler: ProductPatchHandler;

  beforeAll(async () => {
    productsIndexGetHandler = (
      await import("../../../server/api/products/index.get")
    ).default;
    productsIndexPostHandler = (
      await import("../../../server/api/products/index.post")
    ).default;
    productByIdHandler = (await import("../../../server/api/products/[id].get"))
      .default;
    productPatchHandler = (
      await import("../../../server/api/products/[id].patch")
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

  describe("GET /api/products", () => {
    it("returns seeded products on startup", () => {
      const result = productsIndexGetHandler({} as never) as ProductRecord[];

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("POST /api/products", () => {
    it("rejects missing required fields", async () => {
      setBody(stubs, { name: "Missing required fields" });

      await expect(productsIndexPostHandler({} as never)).rejects.toMatchObject(
        {
          statusCode: 400,
        }
      );
    });

    it("creates a product with required fields", async () => {
      setBody(stubs, createProductPayload());

      const created = (await productsIndexPostHandler(
        {} as never
      )) as CreatedProduct;

      expect(created.name).toBe("Test Product");
      expect(created.origin).toBe("bespoke");
      expect(created.isExternal).toBe(false);
      expect(created.id).toMatch(/^product-/);
      expect(getLifecycleAuditEvents()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "create",
            subjectType: "product",
            subjectId: created.id,
            subjectName: "Test Product",
          }),
        ])
      );
    });

    it("creates an external product", async () => {
      setBody(
        stubs,
        createProductPayload({
          name: "Online Payments",
          origin: "bespoke",
          isExternal: true,
        })
      );

      const created = (await productsIndexPostHandler(
        {} as never
      )) as CreatedProduct;

      expect(created.name).toBe("Online Payments");
      expect(created.isExternal).toBe(true);
    });

    it("creates a product with all fields", async () => {
      setBody(
        stubs,
        createProductPayload({
          name: "Platform X",
          origin: "open-source",
          isExternal: false,
          engineeringLeadId: "heitorl",
          componentIds: ["webapp-pal"],
          roadmapUrl: "https://example.com/roadmap",
        })
      );

      const created = (await productsIndexPostHandler(
        {} as never
      )) as CreatedProduct;

      expect(created.name).toBe("Platform X");
      expect(created.origin).toBe("open-source");
    });
  });

  describe("GET /api/products/:id", () => {
    it("throws error for unknown product", async () => {
      setRouterParam(stubs, "id", "product-unknown");

      try {
        await productByIdHandler({} as never);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Product not found");
      }
    });

    it("throws error when id is missing", async () => {
      try {
        await productByIdHandler({} as never);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Product ID is required");
      }
    });

    it("returns product details for existing product", async () => {
      setBody(stubs, createProductPayload({ origin: "vendor" }));
      await productsIndexPostHandler({} as never);

      setRouterParam(stubs, "id", products[products.length - 1]!.id);

      const result = (await productByIdHandler({} as never)) as ProductRecord;

      expect(result.name).toBe("Test Product");
      expect(result.origin).toBe("vendor");
    });
  });

  describe("PATCH /api/products/:id", () => {
    it("returns 404 for unknown product", async () => {
      setRouterParam(stubs, "id", "product-unknown");
      setBody(stubs, { name: "Updated" });

      await expect(productPatchHandler({} as never)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns 400 when id is missing", async () => {
      setBody(stubs, { name: "Updated" });

      await expect(productPatchHandler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("updates product name", async () => {
      setBody(stubs, createProductPayload());
      await productsIndexPostHandler({} as never);

      setRouterParam(stubs, "id", products[0]!.id);
      setBody(stubs, { name: "Updated Name" });

      const result = (await productPatchHandler({} as never)) as ProductRecord;

      expect(result.name).toBe("Updated Name");
      expect(result.origin).toBe("bespoke");
    });

    it("clears URL fields when empty string provided", async () => {
      setBody(
        stubs,
        createProductPayload({
          roadmapUrl: "https://example.com/roadmap",
        })
      );
      await productsIndexPostHandler({} as never);

      setRouterParam(stubs, "id", products[0]!.id);
      setBody(stubs, { roadmapUrl: "" });

      const result = (await productPatchHandler(
        {} as never
      )) as unknown as Record<string, unknown>;

      expect(result.roadmapUrl).toBeUndefined();
    });

    it("rejects invalid origin values", async () => {
      setBody(stubs, createProductPayload());
      await productsIndexPostHandler({} as never);

      setRouterParam(stubs, "id", products[0]!.id);
      setBody(stubs, { origin: "invalid-origin" });

      await expect(productPatchHandler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("restores archived products", async () => {
      setBody(stubs, createProductPayload());
      await productsIndexPostHandler({} as never);

      const productId = products[products.length - 1]!.id;
      setRouterParam(stubs, "id", productId);
      setBody(stubs, { status: "archived" });
      await productPatchHandler({} as never);

      setBody(stubs, { status: "active" });
      const result = (await productPatchHandler({} as never)) as ProductRecord;

      expect(result.id).toBe(productId);
      expect(result.name).toBe("Test Product");
    });

    it("rejects lifecycle updates from non-owners who are not admins", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>,
        { productManagerId: "vlads", engineeringLeadId: "heitorl" }
      );

      setActorHeaders(stubs, {
        id: "someone-else",
        name: "Someone Else",
        roles: "member",
      });
      setRouterParam(stubs, "id", created.id);
      setBody(stubs, { status: "archived" });

      await expect(productPatchHandler({} as never)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("allows product owners to archive and records an audit event", async () => {
      const created = await seedProduct(
        stubs,
        productsIndexPostHandler as (event: never) => Promise<unknown>,
        { productManagerId: "vlads" }
      );
      clearLifecycleAuditEvents();

      setActorHeaders(stubs, {
        id: "vlads",
        name: "Vlad",
        roles: "member",
      });
      setRouterParam(stubs, "id", created.id);
      setBody(stubs, { status: "archived" });

      const result = (await productPatchHandler({} as never)) as ProductRecord;

      expect(result.id).toBe(created.id);

      const auditEvents = getLifecycleAuditEvents();
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]).toMatchObject({
        action: "archive",
        subjectType: "product",
        subjectId: created.id,
        actorId: "vlads",
        associatedResources: {
          reviewsCount: 0,
          activeReviewCount: 0,
        },
      });
    });
  });
});
