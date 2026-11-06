import { describe, expect, it } from "vitest";
import {
  dedupeDirectoryGroups,
  getDirectoryGroupAliases,
} from "../../../app/catalog-directory-mirror/groups";

describe("catalog directory group dedupe", () => {
  const duplicateGroups = [
    {
      id: "account-management",
      displayName: "Account Management",
      description: "https://hub.is.adyen.com/account-management",
      memberCount: 22,
    },
    {
      id: "TS_Account_Management",
      displayName: "Account Management",
      description:
        "Workday Integration: group for team Account Management with ID SOC-030.",
      memberCount: 2,
    },
    {
      id: "be-internal_services",
      displayName: "Internal Services",
      description: "https://hub.is.adyen.com/internal-services",
      memberCount: 10,
    },
    {
      id: "internal_services",
      displayName: "Internal Services",
      description: "Internal Services (legacy duplicate)",
      memberCount: 10,
    },
  ];

  it("keeps the preferred canonical group for duplicate names", () => {
    expect(dedupeDirectoryGroups(duplicateGroups)).toEqual([
      expect.objectContaining({
        id: "account-management",
        displayName: "Account Management",
      }),
      expect.objectContaining({
        id: "be-internal_services",
        displayName: "Internal Services",
      }),
    ]);
  });

  it("returns all aliases for a canonical group id", () => {
    expect(
      getDirectoryGroupAliases(duplicateGroups, "be-internal_services")
    ).toEqual(["be-internal_services", "internal_services"]);
  });
});
