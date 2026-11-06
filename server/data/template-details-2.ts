import type { TemplateRevisionDetail } from "../../app/models";

const PCI_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001002";
const PCI_REVISION_ID = "01932b3c-7d00-7000-8000-000000001002-revision";
const GDPR_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001003";
const GDPR_REVISION_ID = "01932b3c-7d00-7000-8000-000000001003-revision";
const SOC2_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001004";
const SOC2_REVISION_ID = "01932b3c-7d00-7000-8000-000000001004-revision";

export const templateDetail2: Record<string, TemplateRevisionDetail> = {
  [PCI_TEMPLATE_ID]: {
    id: PCI_REVISION_ID,
    templateId: PCI_TEMPLATE_ID,
    name: "PCI-DSS",
    status: "draft",
    revisionNumber: null,
    revisionSummary: null,
    description: "PCI-DSS compliance review template",
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: null,
    createdAt: "2025-11-20T08:00:00Z",
    updatedAt: "2026-01-10T16:45:00Z",
    publishedAt: null,
    pillars: [
      {
        id: `${PCI_REVISION_ID}:security`,
        templateRevisionId: PCI_REVISION_ID,
        slug: "security",
        name: "Security",
        order: 1,
        questions: [
          {
            id: "q-pci-sec-001",
            order: 1,
            text: "Is **cardholder data** encrypted at rest using AES-256 or equivalent?",
            riskLevel: "critical",
            importance:
              "PCI-DSS Requirement 3.4 mandates encryption of stored cardholder data. AES-256 is the recommended standard for compliance.",
            leadingPractices: [
              {
                id: "lp-pci-1",
                order: 1,
                text: "Encryption keys rotated annually",
              },
              {
                id: "lp-pci-2",
                order: 2,
                text: "Key management procedures documented",
              },
            ],
            helpfulLinks: [
              {
                title: "PCI-DSS v4.0 Requirements",
                url: "https://www.pcisecuritystandards.org/",
              },
            ],
          },
          {
            id: "q-pci-sec-002",
            order: 2,
            text: "Are all **network transmissions** of cardholder data encrypted with TLS 1.2+?",
            riskLevel: "critical",
            importance:
              "PCI-DSS Requirement 4.1 requires strong cryptography for transmission of cardholder data over open, public networks.",
            leadingPractices: [
              {
                id: "lp-pci-3",
                order: 1,
                text: "TLS 1.3 preferred where supported",
              },
              { id: "lp-pci-4", order: 2, text: "Weak cipher suites disabled" },
            ],
            helpfulLinks: [],
          },
        ],
      },
      {
        id: `${PCI_REVISION_ID}:infrastructure`,
        templateRevisionId: PCI_REVISION_ID,
        slug: "infrastructure",
        name: "Infrastructure",
        order: 2,
        questions: [
          {
            id: "q-pci-inf-001",
            order: 1,
            text: "Is the **cardholder data environment (CDE)** properly segmented from other networks?",
            riskLevel: "critical",
            importance:
              "Network segmentation reduces the scope of PCI-DSS compliance and limits the blast radius of potential breaches.",
            leadingPractices: [
              {
                id: "lp-pci-5",
                order: 1,
                text: "CDE network diagram documented and current",
              },
              {
                id: "lp-pci-6",
                order: 2,
                text: "Firewall rules reviewed quarterly",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
      {
        id: `${PCI_REVISION_ID}:operations`,
        templateRevisionId: PCI_REVISION_ID,
        slug: "operations",
        name: "Operations",
        order: 3,
        questions: [
          {
            id: "q-pci-ops-001",
            order: 1,
            text: "Are **access logs** retained for at least one year with 3 months immediately available?",
            riskLevel: "high",
            importance:
              "PCI-DSS Requirement 10.7 mandates specific log retention periods for audit trail history.",
            leadingPractices: [
              {
                id: "lp-pci-7",
                order: 1,
                text: "Centralized log management system in place",
              },
              {
                id: "lp-pci-8",
                order: 2,
                text: "Log integrity monitoring enabled",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
    ],
  },
  [GDPR_TEMPLATE_ID]: {
    id: GDPR_REVISION_ID,
    templateId: GDPR_TEMPLATE_ID,
    name: "GDPR Audit",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    description: "GDPR compliance audit template",
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: "actor-system",
    createdAt: "2025-08-01T12:00:00Z",
    updatedAt: "2025-09-15T11:20:00Z",
    publishedAt: "2025-09-15T11:20:00Z",
    pillars: [
      {
        id: `${GDPR_REVISION_ID}:security`,
        templateRevisionId: GDPR_REVISION_ID,
        slug: "security",
        name: "Data Protection",
        order: 1,
        questions: [
          {
            id: "q-gdpr-sec-001",
            order: 1,
            text: "Is **personal data** encrypted both at rest and in transit?",
            riskLevel: "critical",
            importance:
              "GDPR Article 32 requires appropriate technical measures to ensure security of personal data, including encryption.",
            leadingPractices: [
              {
                id: "lp-gdpr-1",
                order: 1,
                text: "Data classification policy defines personal data categories",
              },
              {
                id: "lp-gdpr-2",
                order: 2,
                text: "Encryption standards documented and enforced",
              },
            ],
            helpfulLinks: [
              {
                title: "GDPR Article 32",
                url: "https://gdpr-info.eu/art-32-gdpr/",
              },
            ],
          },
          {
            id: "q-gdpr-sec-002",
            order: 2,
            text: "Can you fulfill a **data subject access request (DSAR)** within 30 days?",
            riskLevel: "high",
            importance:
              "GDPR Article 15 gives individuals the right to access their personal data. Organizations must respond within one month.",
            leadingPractices: [
              {
                id: "lp-gdpr-3",
                order: 1,
                text: "DSAR process documented and tested",
              },
              {
                id: "lp-gdpr-4",
                order: 2,
                text: "Data inventory maintained for quick retrieval",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
      {
        id: `${GDPR_REVISION_ID}:operations`,
        templateRevisionId: GDPR_REVISION_ID,
        slug: "operations",
        name: "Data Governance",
        order: 2,
        questions: [
          {
            id: "q-gdpr-ops-001",
            order: 1,
            text: "Is there a documented **data retention policy** with automated enforcement?",
            riskLevel: "high",
            importance:
              "GDPR Article 5(1)(e) requires that personal data is kept no longer than necessary. Automated enforcement ensures compliance.",
            leadingPractices: [
              {
                id: "lp-gdpr-5",
                order: 1,
                text: "Retention periods defined per data category",
              },
              {
                id: "lp-gdpr-6",
                order: 2,
                text: "Automated deletion jobs configured and monitored",
              },
            ],
            helpfulLinks: [],
          },
          {
            id: "q-gdpr-ops-002",
            order: 2,
            text: "Have all **data processors** signed appropriate Data Processing Agreements?",
            riskLevel: "medium",
            importance:
              "GDPR Article 28 requires contracts with data processors that provide sufficient guarantees for data protection.",
            leadingPractices: [
              {
                id: "lp-gdpr-7",
                order: 1,
                text: "Vendor risk assessment completed for all processors",
              },
              {
                id: "lp-gdpr-8",
                order: 2,
                text: "DPA inventory maintained and reviewed annually",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
    ],
  },
  [SOC2_TEMPLATE_ID]: {
    id: SOC2_REVISION_ID,
    templateId: SOC2_TEMPLATE_ID,
    name: "SOC 2",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    description: "SOC 2 readiness template for control and audit preparation",
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: "actor-system",
    createdAt: "2025-12-10T09:00:00Z",
    updatedAt: "2026-01-15T13:30:00Z",
    publishedAt: "2026-01-15T13:30:00Z",
    pillars: [
      {
        id: `${SOC2_REVISION_ID}:security`,
        templateRevisionId: SOC2_REVISION_ID,
        slug: "security",
        name: "Security",
        order: 1,
        questions: [
          {
            id: "q-soc-sec-001",
            order: 1,
            text: "Are privileged access paths protected with MFA and quarterly review?",
            riskLevel: "critical",
            importance:
              "SOC 2 controls require strict privileged access governance to reduce unauthorized access risk.",
            leadingPractices: [
              {
                id: "lp-soc-1",
                order: 1,
                text: "Privileged role assignments are reviewed every quarter",
              },
            ],
            helpfulLinks: [],
          },
          {
            id: "q-soc-sec-002",
            order: 2,
            text: "Is security logging centralized and retained according to policy?",
            riskLevel: "high",
            importance:
              "Centralized logs provide evidentiary support and incident response capability for SOC 2 audits.",
            leadingPractices: [
              {
                id: "lp-soc-2",
                order: 1,
                text: "Critical security events generate actionable alerts",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
      {
        id: `${SOC2_REVISION_ID}:operations`,
        templateRevisionId: SOC2_REVISION_ID,
        slug: "operations",
        name: "Operations",
        order: 2,
        questions: [
          {
            id: "q-soc-ops-001",
            order: 1,
            text: "Are incident runbooks documented and validated through tabletop exercises?",
            riskLevel: "high",
            importance:
              "SOC 2 requires demonstrable operational readiness for handling disruptions and incidents.",
            leadingPractices: [
              {
                id: "lp-soc-3",
                order: 1,
                text: "Incident simulations are run at least twice per year",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
      {
        id: `${SOC2_REVISION_ID}:infrastructure`,
        templateRevisionId: SOC2_REVISION_ID,
        slug: "infrastructure",
        name: "Infrastructure",
        order: 3,
        questions: [
          {
            id: "q-soc-inf-001",
            order: 1,
            text: "Is backup restoration tested on a scheduled cadence?",
            riskLevel: "medium",
            importance:
              "Restoration validation is required to demonstrate control effectiveness during SOC 2 audits.",
            leadingPractices: [
              {
                id: "lp-soc-4",
                order: 1,
                text: "Quarterly restore drills are tracked with remediation actions",
              },
            ],
            helpfulLinks: [],
          },
        ],
      },
    ],
  },
};
