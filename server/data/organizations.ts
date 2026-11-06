import type { Organization } from "../../app/models";

export interface OrganizationPreferences {
  defaultReviewCadence: "monthly" | "quarterly";
  notifyAdvisors: boolean;
  preferredTemplateIds: string[];
}

export const organizations: Organization[] = [
  {
    id: "org-payments",
    name: "Payments",
    description:
      "Owns payment processing, settlement, and treasury integrations.",
  },
  {
    id: "org-fp",
    name: "Financial Products",
    shortName: "FP",
    description:
      "Builds and scales customer-facing financial products and risk tooling.",
  },
  {
    id: "org-pe",
    name: "Platform Engineering",
    shortName: "PE",
    description:
      "Provides shared platform services, APIs, and core reliability foundations.",
  },
  {
    id: "org-cx",
    name: "Customer Experience",
    shortName: "CX",
    description:
      "Owns customer-facing interfaces and end-to-end user experience quality.",
  },
  {
    id: "org-te",
    name: "Tech Enablement",
    description:
      "Enables developer productivity through internal tools, automation, and support.",
  },
  {
    id: "org-ipo",
    name: "Identity Performance Optimization",
    shortName: "IPO",
    description:
      "Leads identity, access, and authentication performance optimization initiatives.",
  },
];

const organizationPreferencesById: Record<string, OrganizationPreferences> = {
  "org-payments": {
    defaultReviewCadence: "quarterly",
    notifyAdvisors: true,
    preferredTemplateIds: [
      "01932b3c-7d00-7000-8000-000000001002",
      "01932b3c-7d00-7000-8000-000000001004",
    ],
  },
  "org-fp": {
    defaultReviewCadence: "quarterly",
    notifyAdvisors: true,
    preferredTemplateIds: ["01932b3c-7d00-7000-8000-000000001001"],
  },
  "org-pe": {
    defaultReviewCadence: "monthly",
    notifyAdvisors: true,
    preferredTemplateIds: [
      "01932b3c-7d00-7000-8000-000000001001",
      "01932b3c-7d00-7000-8000-000000001004",
    ],
  },
  "org-cx": {
    defaultReviewCadence: "quarterly",
    notifyAdvisors: true,
    preferredTemplateIds: [
      "01932b3c-7d00-7000-8000-000000001001",
      "01932b3c-7d00-7000-8000-000000001003",
    ],
  },
  "org-te": {
    defaultReviewCadence: "monthly",
    notifyAdvisors: false,
    preferredTemplateIds: ["01932b3c-7d00-7000-8000-000000001001"],
  },
  "org-ipo": {
    defaultReviewCadence: "quarterly",
    notifyAdvisors: true,
    preferredTemplateIds: ["01932b3c-7d00-7000-8000-000000001004"],
  },
};

export const getOrganizationById = (
  orgId: string
): Organization | undefined => {
  return organizations.find((organization) => organization.id === orgId);
};

export const getOrganizationPreferences = (
  orgId: string
): OrganizationPreferences | undefined => {
  const preferences = organizationPreferencesById[orgId];

  if (!preferences) return undefined;
  return {
    ...preferences,
    preferredTemplateIds: [...preferences.preferredTemplateIds],
  };
};

export const setOrganizationPreferences = (
  orgId: string,
  updates: Partial<OrganizationPreferences>
): OrganizationPreferences | undefined => {
  const current = organizationPreferencesById[orgId];

  if (!current) return undefined;

  const next: OrganizationPreferences = {
    defaultReviewCadence:
      updates.defaultReviewCadence ?? current.defaultReviewCadence,
    notifyAdvisors: updates.notifyAdvisors ?? current.notifyAdvisors,
    preferredTemplateIds: updates.preferredTemplateIds ?? [
      ...current.preferredTemplateIds,
    ],
  };

  organizationPreferencesById[orgId] = next;
  return { ...next, preferredTemplateIds: [...next.preferredTemplateIds] };
};
