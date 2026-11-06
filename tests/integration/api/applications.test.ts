import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils";

describe("Applications API", async () => {
  await setup();

  it("GET /api/applications returns array of applications", async () => {
    const applications = await $fetch("/api/applications");

    expect(Array.isArray(applications)).toBe(true);
    expect(applications.length).toBeGreaterThan(0);

    const app = applications[0];
    expect(app).toHaveProperty("id");
    expect(app).toHaveProperty("name");
    expect(app).toHaveProperty("status");
    expect(app).toHaveProperty("owner");
    expect(app).toHaveProperty("lastUpdated");
    expect(app).toHaveProperty("progress");
  });

  it("POST /api/applications/bulk/delete accepts ids", async () => {
    const response = await $fetch("/api/applications/bulk/delete", {
      method: "POST",
      body: {
        ids: ["app-001", "app-002"],
      },
    });

    expect(response).toHaveProperty("success", true);
    expect(response).toHaveProperty("message");
    expect(response.ids).toEqual(["app-001", "app-002"]);
  });

  it("POST /api/applications/bulk/transfer accepts ids and new owner", async () => {
    const response = await $fetch("/api/applications/bulk/transfer", {
      method: "POST",
      body: {
        ids: ["app-001"],
        newOwner: "New Team",
      },
    });

    expect(response).toHaveProperty("success", true);
    expect(response).toHaveProperty("newOwner", "New Team");
  });

  it("POST /api/applications/bulk/archive accepts ids", async () => {
    const response = await $fetch("/api/applications/bulk/archive", {
      method: "POST",
      body: {
        ids: ["app-003"],
      },
    });

    expect(response).toHaveProperty("success", true);
  });
});
