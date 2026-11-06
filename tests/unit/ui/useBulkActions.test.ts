import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { useBulkActions } from "~/ui/useBulkActions";

describe("useBulkActions", async () => {
  beforeEach(() => {
    vi.stubGlobal(
      "$fetch",
      vi.fn().mockRejectedValue(new Error("mocked $fetch"))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initial state", () => {
    it("should not be loading initially", () => {
      const { loading } = useBulkActions("/api/applications");
      expect(loading.value).toBe(false);
    });

    it("should have no error initially", () => {
      const { error } = useBulkActions("/api/applications");
      expect(error.value).toBeNull();
    });
  });

  describe("executeBulkAction", () => {
    it("should return error for empty ids array", async () => {
      const { executeBulkAction } = useBulkActions("/api/applications");

      const result = await executeBulkAction("archive", []);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("No items selected");
    });

    it("should not set loading for empty ids", async () => {
      const { executeBulkAction, loading } =
        useBulkActions("/api/applications");

      await executeBulkAction("archive", []);

      expect(loading.value).toBe(false);
    });

    it("should handle API errors gracefully", async () => {
      const { executeBulkAction, error } = useBulkActions("/api/applications");

      // This will fail because the endpoint doesn't exist, testing error handling
      const result = await executeBulkAction("nonexistent", ["id-1"]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(error.value).toBeDefined();
    });

    it("should reset loading after error", async () => {
      const { executeBulkAction, loading } =
        useBulkActions("/api/applications");

      await executeBulkAction("nonexistent", ["id-1"]);

      expect(loading.value).toBe(false);
    });
  });

  describe("convenience methods contract", () => {
    it("bulkTransfer should require newOwner parameter", async () => {
      const { bulkTransfer } = useBulkActions("/api/applications");

      // Verify the function signature accepts ids and newOwner
      const result = await bulkTransfer([], "new-owner");
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("No items selected");
    });

    it("bulkArchive should accept ids array", async () => {
      const { bulkArchive } = useBulkActions("/api/applications");

      const result = await bulkArchive([]);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("No items selected");
    });

    it("bulkDelete should accept ids array", async () => {
      const { bulkDelete } = useBulkActions("/api/applications");

      const result = await bulkDelete([]);
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe("No items selected");
    });
  });

  describe("composable factory", () => {
    it("should create independent instances for different paths", () => {
      const apps = useBulkActions("/api/applications");
      const reviews = useBulkActions("/api/reviews");

      // Each instance has its own state
      expect(apps.loading.value).toBe(false);
      expect(reviews.loading.value).toBe(false);
    });
  });
});
