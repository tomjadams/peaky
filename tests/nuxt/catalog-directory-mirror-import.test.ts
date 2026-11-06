import { describe, expect, it } from "vitest";
import { buildLaunchpadCatalogSnapshot } from "../../server/data/catalog-directory-mirror-import";

describe("buildLaunchpadCatalogSnapshot", () => {
  it("maps Launchpad systems into Peaky applications", () => {
    const snapshot = buildLaunchpadCatalogSnapshot({
      generatedAt: "2026-03-20T00:00:00.000Z",
      systems: [
        {
          id: "fluffy",
          domain: "payments",
          title: "Fluffy",
          description: "Main application",
          owner: "team-fluffy",
          dateModified: "2026-03-19T00:00:00.000Z",
        },
      ],
      components: [
        {
          id: "service-fluffy-api",
          title: "Fluffy API",
          description: "Underlying service",
          owner: "team-fluffy",
          system: "fluffy",
          dateModified: "2026-03-19T00:00:00.000Z",
        },
      ],
      groupMetadata: [
        {
          groupName: "team-fluffy",
          humanReadableGroupName: "Team Fluffy",
          status: "ACTIVE",
          primaryContact: "robinv",
          dateCreated: "2026-03-19T00:00:00.000Z",
          dateModified: "2026-03-19T00:00:00.000Z",
        },
      ],
    });

    expect(snapshot.components).toEqual([
      expect.objectContaining({
        id: "fluffy",
        displayName: "Fluffy",
        ownerGroupId: "team-fluffy",
        ownerGroupName: "Team Fluffy",
        type: "system",
        system: "payments",
      }),
    ]);
  });

  it("builds users from group contacts and audit actors", () => {
    const snapshot = buildLaunchpadCatalogSnapshot({
      generatedAt: "2026-03-20T00:00:00.000Z",
      systems: [
        {
          id: "fluffy",
          domain: "payments",
          title: "Fluffy",
          owner: "team-fluffy",
          dateModified: "2026-03-19T00:00:00.000Z",
          createdBy: "stijnh",
        },
      ],
      components: [],
      groupMetadata: [
        {
          groupName: "team-fluffy",
          humanReadableGroupName: "Team Fluffy",
          status: "ACTIVE",
          primaryContact: "robinv",
          productManagerContact: "stijnh",
          dateCreated: "2026-03-19T00:00:00.000Z",
          dateModified: "2026-03-19T00:00:00.000Z",
        },
      ],
    });

    expect(snapshot.users).toEqual(
      expect.arrayContaining([
        { id: "robinv", displayName: "Robinv" },
        { id: "stijnh", displayName: "Stijnh" },
      ])
    );
  });

  it("excludes denied broadcast groups from the mirror", () => {
    const snapshot = buildLaunchpadCatalogSnapshot({
      generatedAt: "2026-03-20T00:00:00.000Z",
      systems: [],
      components: [],
      groupMetadata: [
        {
          groupName: "all_employees",
          humanReadableGroupName: "All Employees",
          status: "ACTIVE",
          primaryContact: "ops",
          dateCreated: "2026-03-19T00:00:00.000Z",
          dateModified: "2026-03-19T00:00:00.000Z",
        },
      ],
      excludedGroupNames: ["all_employees"],
    });

    expect(snapshot.groups).toEqual([]);
  });

  it("maps Backstage entities into users, groups, and applications", () => {
    const snapshot = buildLaunchpadCatalogSnapshot({
      generatedAt: "2026-03-20T00:00:00.000Z",
      systems: [],
      components: [],
      groupMetadata: [],
      users: [
        {
          kind: "User",
          metadata: {
            name: "robinv",
          },
          spec: {
            profile: {
              displayName: "Robin van Zanten",
            },
          },
        },
      ],
      groups: [
        {
          kind: "Group",
          metadata: {
            name: "be-internal_services",
            title: "Internal Services",
            description: "Internal Services team",
          },
          spec: {
            type: "team",
            groupMetadata: {
              groupName: "be-internal_services",
              status: "ACTIVE",
              primaryContact: "robinv",
              dateCreated: "2026-03-19T00:00:00.000Z",
              dateModified: "2026-03-19T00:00:00.000Z",
            },
          },
          relations: [
            {
              type: "hasMember",
              targetRef: "user:default/robinv",
            },
          ],
        },
      ],
      systemEntities: [
        {
          kind: "System",
          metadata: {
            name: "accessportal-system",
            title: "Access Portal System",
            description: "Access Portal which facilitates access requests",
          },
          spec: {
            owner: "be-internal_services",
            domain: "platform-engineering",
          },
        },
      ],
    });

    expect(snapshot.users).toEqual([
      { id: "robinv", displayName: "Robin van Zanten" },
    ]);
    expect(snapshot.groups).toEqual([
      expect.objectContaining({
        id: "be-internal_services",
        displayName: "Internal Services",
        memberCount: 1,
      }),
    ]);
    expect(snapshot.components).toEqual([
      expect.objectContaining({
        id: "accessportal-system",
        displayName: "Access Portal System",
        ownerGroupId: "be-internal_services",
        ownerGroupName: "Internal Services",
        system: "platform-engineering",
      }),
    ]);
  });
});
