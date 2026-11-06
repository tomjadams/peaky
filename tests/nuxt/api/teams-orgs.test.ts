import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearRuntimeEvents,
  getEventsByReviewId,
} from "../../../server/data/review-events";
import { reviews } from "../../../server/data/reviews";
import {
  templateDetails,
  templateFixtureDrafts,
  templates as templateCatalog,
} from "../../../server/data/templates";
import {
  setupNitroStubs,
  resetNitroStubs,
  type NitroStubs,
} from "../helpers/nitro";
import { resetArray } from "../helpers/seed";

// ---------------------------------------------------------------------------
// Handler types
// ---------------------------------------------------------------------------

interface OrganizationRecord {
  id: string;
  name: string;
}

interface OrganizationPreferencesResult {
  orgId: string;
  preferences: {
    defaultReviewCadence: "monthly" | "quarterly";
  };
}

interface TeamRecord {
  name: string;
  orgName: string;
}

interface TeamReviewRecord {
  id: string;
  updatedAt: string;
}

interface CreatedTeamReview {
  id: string;
  teamId: string;
  templateIds: string[];
  templateRevisionIds: string[];
}

const ORR_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001001";
const ORR_REVISION_ID = "01932b3c-7d00-7000-8100-000000001001";
const DRAFT_REVISION_ID = templateFixtureDrafts[0]!.id;

type OrgsIndexHandler =
  (typeof import("../../../server/api/orgs/index.get"))["default"];
type OrgByIdHandler =
  (typeof import("../../../server/api/orgs/[id].get"))["default"];
type OrgPreferencesGetHandler =
  (typeof import("../../../server/api/orgs/[id]/preferences.get"))["default"];
type OrgPreferencesPatchHandler =
  (typeof import("../../../server/api/orgs/[id]/preferences.patch"))["default"];
type TeamsIndexHandler =
  (typeof import("../../../server/api/teams/index.get"))["default"];
type TeamReviewsGetHandler =
  (typeof import("../../../server/api/teams/[id]/reviews.get"))["default"];
type TeamReviewsPostHandler =
  (typeof import("../../../server/api/teams/[id]/reviews.post"))["default"];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Teams/Organizations API handlers", () => {
  const stubs: NitroStubs = setupNitroStubs();
  const initialReviews = structuredClone(reviews);

  let orgsIndexHandler: OrgsIndexHandler;
  let orgByIdHandler: OrgByIdHandler;
  let orgPreferencesGetHandler: OrgPreferencesGetHandler;
  let orgPreferencesPatchHandler: OrgPreferencesPatchHandler;
  let teamsIndexHandler: TeamsIndexHandler;
  let teamReviewsGetHandler: TeamReviewsGetHandler;
  let teamReviewsPostHandler: TeamReviewsPostHandler;

  beforeAll(async () => {
    orgsIndexHandler = (await import("../../../server/api/orgs/index.get"))
      .default;
    orgByIdHandler = (await import("../../../server/api/orgs/[id].get"))
      .default;
    orgPreferencesGetHandler = (
      await import("../../../server/api/orgs/[id]/preferences.get")
    ).default;
    orgPreferencesPatchHandler = (
      await import("../../../server/api/orgs/[id]/preferences.patch")
    ).default;
    teamsIndexHandler = (await import("../../../server/api/teams/index.get"))
      .default;
    teamReviewsGetHandler = (
      await import("../../../server/api/teams/[id]/reviews.get")
    ).default;
    teamReviewsPostHandler = (
      await import("../../../server/api/teams/[id]/reviews.post")
    ).default;
  });

  beforeEach(() => {
    resetNitroStubs(stubs);
  });

  afterEach(() => {
    resetArray(reviews, initialReviews);
    clearRuntimeEvents();
  });

  // ── Organizations ─────────────────────────────────────────────────────

  it("GET /api/orgs returns organizations sorted by name", () => {
    const organizations = orgsIndexHandler({} as never) as OrganizationRecord[];
    const names = organizations.map((organization) => organization.name);
    const sortedNames = [...names].toSorted((a, b) => a.localeCompare(b));

    expect(names).toEqual(sortedNames);
  });

  it("GET /api/orgs/:id returns organization details", () => {
    // Org data comes from the catalog directory — read-only reference data
    const orgs = orgsIndexHandler({} as never) as OrganizationRecord[];
    const firstOrg = orgs[0]!;

    stubs.routerParams = { id: firstOrg.id };

    const organization = orgByIdHandler({} as never) as OrganizationRecord;

    expect(organization.id).toBe(firstOrg.id);
    expect(organization.name).toBe(firstOrg.name);
  });

  it("GET /api/orgs/:id/preferences returns org preferences", () => {
    const orgs = orgsIndexHandler({} as never) as OrganizationRecord[];
    const firstOrg = orgs[0]!;

    stubs.routerParams = { id: firstOrg.id };

    const result = orgPreferencesGetHandler(
      {} as never
    ) as OrganizationPreferencesResult;

    expect(result.orgId).toBe(firstOrg.id);
    expect(result.preferences.defaultReviewCadence).toMatch(
      /monthly|quarterly/
    );
  });

  it("PATCH /api/orgs/:id/preferences validates payload", async () => {
    const orgs = orgsIndexHandler({} as never) as OrganizationRecord[];
    const firstOrg = orgs[0]!;

    stubs.routerParams = { id: firstOrg.id };
    stubs.body.value = {};

    await expect(orgPreferencesPatchHandler({} as never)).rejects.toMatchObject(
      {
        statusCode: 400,
      }
    );
  });

  it("PATCH /api/orgs/:id/preferences updates preferences", async () => {
    const orgs = orgsIndexHandler({} as never) as OrganizationRecord[];
    const firstOrg = orgs[0]!;

    stubs.routerParams = { id: firstOrg.id };
    stubs.body.value = { defaultReviewCadence: "monthly" };

    const result = await orgPreferencesPatchHandler({} as never);

    expect(result.orgId).toBe(firstOrg.id);
    expect(result.preferences.defaultReviewCadence).toBe("monthly");
  });

  // ── Teams ─────────────────────────────────────────────────────────────

  it("GET /api/teams returns teams sorted by organization then name", () => {
    const teams = teamsIndexHandler({} as never) as TeamRecord[];

    for (let i = 1; i < teams.length; i += 1) {
      const prev = teams[i - 1]!;
      const current = teams[i]!;
      const orgComparison = prev.orgName.localeCompare(current.orgName);

      if (orgComparison === 0) {
        expect(prev.name.localeCompare(current.name)).toBeLessThanOrEqual(0);
      } else {
        expect(orgComparison).toBeLessThanOrEqual(0);
      }
    }
  });

  // ── Team reviews ──────────────────────────────────────────────────────

  it("GET /api/teams/:id/reviews returns reviews sorted by updatedAt desc", () => {
    // Find a team that has reviews in the seed data
    const teamId = reviews[0]?.teamId;
    expect(teamId).toBeDefined();

    stubs.routerParams = { id: teamId! };

    const reviewsResponse = teamReviewsGetHandler(
      {} as never
    ) as TeamReviewRecord[];

    for (let i = 1; i < reviewsResponse.length; i += 1) {
      const prevUpdatedAt = new Date(
        reviewsResponse[i - 1]!.updatedAt
      ).getTime();
      const currentUpdatedAt = new Date(
        reviewsResponse[i]!.updatedAt
      ).getTime();
      expect(prevUpdatedAt).toBeGreaterThanOrEqual(currentUpdatedAt);
    }
  });

  it("GET /api/teams/:id/reviews returns empty array for teams with no reviews", () => {
    // be-internal_services is a real catalog team with no seed reviews
    stubs.routerParams = { id: "be-internal_services" };

    const reviewsResponse = teamReviewsGetHandler(
      {} as never
    ) as TeamReviewRecord[];

    expect(reviewsResponse).toEqual([]);
  });

  it("GET /api/teams/:id/reviews hides archived reviews by default and includes them on request", () => {
    // Use a teamId from existing seed data
    const teamId = reviews[0]?.teamId;
    expect(teamId).toBeDefined();

    reviews.push({
      id: "test-archived-review",
      name: "Archived team review",
      teamId: teamId!,
      orgId: "org-test",
      templateId: "01932b3c-7d00-7000-8000-000000001001",
      templateName: "Operational Readiness Review (ORR)",
      templateIds: ["01932b3c-7d00-7000-8000-000000001001"],
      templateNames: ["Operational Readiness Review (ORR)"],
      templates: [],
      pillars: [],
      status: "archived",
      createdAt: "2026-03-18T00:00:00Z",
      updatedAt: "2026-03-18T00:00:00Z",
      assessors: [],
      reviewers: [],
    } as never);

    stubs.routerParams = { id: teamId! };

    const activeReviews = teamReviewsGetHandler(
      {} as never
    ) as TeamReviewRecord[];

    expect(
      activeReviews.some((review) => review.id === "test-archived-review")
    ).toBe(false);

    stubs.query = { includeArchived: "true" };

    const allReviews = teamReviewsGetHandler({} as never) as TeamReviewRecord[];

    expect(
      allReviews.some((review) => review.id === "test-archived-review")
    ).toBe(true);
  });

  it("POST /api/teams/:id/reviews returns 404 for unknown team", async () => {
    stubs.routerParams = { id: "team-unknown" };
    stubs.body.value = {
      name: "Q2 Review",
      templateRevisionIds: [ORR_REVISION_ID],
    };

    await expect(teamReviewsPostHandler({} as never)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("POST /api/teams/:id/reviews returns 400 for invalid Revision count", async () => {
    // Use a known catalog team — the POST handler validates team existence
    const teams = teamsIndexHandler({} as never) as { id: string }[];
    const catalogTeam = teams[0]!;

    stubs.routerParams = { id: catalogTeam.id };
    stubs.body.value = {
      name: "Q2 Review",
      templateRevisionIds: [],
    };

    await expect(teamReviewsPostHandler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it.each([
    ["a parent Template ID", [ORR_TEMPLATE_ID]],
    ["duplicate Revision IDs", [ORR_REVISION_ID, ORR_REVISION_ID]],
    ["a draft Revision", [DRAFT_REVISION_ID]],
  ])("POST /api/teams/:id/reviews rejects %s", async (_label, revisionIds) => {
    const teams = teamsIndexHandler({} as never) as { id: string }[];
    stubs.routerParams = { id: teams[0]!.id };
    stubs.body.value = {
      name: "Invalid Review",
      templateRevisionIds: revisionIds,
    };

    await expect(teamReviewsPostHandler({} as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("POST /api/teams/:id/reviews rejects a Revision of an archived Template", async () => {
    const teams = teamsIndexHandler({} as never) as { id: string }[];
    const entry = templateCatalog.find(
      (candidate) => candidate.template.id === ORR_TEMPLATE_ID
    )!;
    const originalStatus = entry.template.status;
    entry.template.status = "archived";
    stubs.routerParams = { id: teams[0]!.id };
    stubs.body.value = {
      name: "Invalid Review",
      templateRevisionIds: [ORR_REVISION_ID],
    };

    try {
      await expect(teamReviewsPostHandler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    } finally {
      entry.template.status = originalStatus;
    }
  });

  it("POST /api/teams/:id/reviews rejects a retired Revision", async () => {
    const teams = teamsIndexHandler({} as never) as { id: string }[];
    const revision = templateDetails[ORR_REVISION_ID]!;
    const originalStatus = revision.status;
    revision.status = "retired";
    stubs.routerParams = { id: teams[0]!.id };
    stubs.body.value = {
      name: "Invalid Review",
      templateRevisionIds: [ORR_REVISION_ID],
    };

    try {
      await expect(teamReviewsPostHandler({} as never)).rejects.toMatchObject({
        statusCode: 400,
      });
    } finally {
      revision.status = originalStatus;
    }
  });

  it("POST /api/teams/:id/reviews creates a review", async () => {
    const teams = teamsIndexHandler({} as never) as { id: string }[];
    const catalogTeam = teams[0]!;

    stubs.routerParams = { id: catalogTeam.id };
    stubs.body.value = {
      name: "Integration Test Review",
      templateRevisionIds: [ORR_REVISION_ID],
    };

    const created = (await teamReviewsPostHandler(
      {} as never
    )) as CreatedTeamReview;

    expect(created.teamId).toBe(catalogTeam.id);
    expect(created.templateIds).toEqual([ORR_TEMPLATE_ID]);
    expect(created.templateRevisionIds).toEqual([ORR_REVISION_ID]);
    expect(
      getEventsByReviewId(created.id).some(
        (reviewEvent) => reviewEvent.eventType === "ReviewCreated.v1"
      )
    ).toBe(true);
  });
});
