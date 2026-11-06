export interface ApplicationRecord {
  id: string;
  name: string;
  status: "ready" | "in_progress" | "action_needed";
  owner: string;
  teamId: string;
  orgId: string;
  orgName: string;
  productId: string;
  productName: string;
  lastUpdated: string;
  progress: number;
  archived?: boolean;
}

export const applications: ApplicationRecord[] = [
  {
    id: "01932b3c-7d00-7000-8000-000000004001",
    name: "Launchpad System",
    status: "ready",
    owner: "Developer Portal Experience - DPX",
    teamId: "idp-developer_portal_experience",
    orgId: "org-platform-engineering",
    orgName: "Platform Engineering",
    productId: "product-platform-control-plane",
    productName: "Platform Control Plane",
    lastUpdated: "2026-02-18T09:00:00Z",
    progress: 100,
  },
  {
    id: "01932b3c-7d00-7000-8000-000000004002",
    name: "ModificationQueueProcessor",
    status: "in_progress",
    owner: "Payments Scalability",
    teamId: "payments-scalability",
    orgId: "org-payments",
    orgName: "Payments",
    productId: "01932b3c-7d00-7000-8000-000000000001",
    productName: "Demo Payments Scalability",
    lastUpdated: "2026-02-12T14:00:00Z",
    progress: 65,
  },
  {
    id: "01932b3c-7d00-7000-8000-000000004003",
    name: "Access Portal System",
    status: "ready",
    owner: "Internal Services",
    teamId: "be-internal_services",
    orgId: "org-business-enablement",
    orgName: "Business Enablement",
    productId: "product-operations-insights",
    productName: "Operations Insights",
    lastUpdated: "2026-02-08T16:45:00Z",
    progress: 100,
  },
  {
    id: "01932b3c-7d00-7000-8000-000000004004",
    name: "Looker System",
    status: "action_needed",
    owner: "Internal Services",
    teamId: "be-internal_services",
    orgId: "org-business-enablement",
    orgName: "Business Enablement",
    productId: "product-operations-insights",
    productName: "Operations Insights",
    lastUpdated: "2026-02-10T13:30:00Z",
    progress: 30,
  },
  {
    id: "01932b3c-7d00-7000-8000-000000004005",
    name: "Payment Gateway",
    status: "in_progress",
    owner: "Payments Scalability",
    teamId: "payments-scalability",
    orgId: "org-payments",
    orgName: "Payments",
    productId: "01932b3c-7d00-7000-8000-000000000001",
    productName: "Demo Payments Scalability",
    lastUpdated: "2026-01-12T09:15:00Z",
    progress: 65,
  },
];
