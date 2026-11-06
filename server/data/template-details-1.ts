import type { TemplateRevisionDetail } from "../../app/models";

const ORR_TEMPLATE_ID = "01932b3c-7d00-7000-8000-000000001001";
const ORR_REVISION_ID = "01932b3c-7d00-7000-8000-000000001001-revision";

export const templateDetail1: Record<string, TemplateRevisionDetail> = {
  [ORR_TEMPLATE_ID]: {
    id: ORR_REVISION_ID,
    templateId: ORR_TEMPLATE_ID,
    name: "Operational Readiness Review (ORR)",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    description:
      "A proactive, quarterly, year-round framework for assessing and continuously improving operational readiness.",
    createdByActorId: "actor-system",
    updatedByActorId: "actor-system",
    publishedByActorId: "actor-system",
    createdAt: "2026-01-05T09:00:00Z",
    updatedAt: "2026-01-15T14:30:00Z",
    publishedAt: "2026-01-20T09:00:00Z",
    pillars: [
      {
        id: `${ORR_REVISION_ID}:reliability-resilience`,
        templateRevisionId: ORR_REVISION_ID,
        slug: "reliability-resilience",
        name: "Reliability & Resilience",
        order: 1,
        questions: [
          {
            id: "q-rel-001",
            order: 1,
            type: "checklist",
            text: "How mature is your service reliability definition?",
            riskLevel: "medium",
            importance:
              'SLOs translate business requirements into measurable targets and create the objective basis for reliability decisions. Error budget policies make those targets actionable. Without enforcement, SLOs become vanity metrics and reliability debt accumulates silently. Together, they answer "what does good look like (for our customers)?" and "what do we do when we\'re not there?"',
            checklistItems: [
              {
                id: "cli-orr-001-001",
                order: 1,
                text: "SLOs exist but targets are arbitrary or copied from templates without a technical or business basis",
              },
              {
                id: "cli-orr-001-002",
                order: 2,
                text: "Error budget is tracked informally, with no defined policy or enforcement",
              },
              {
                id: "cli-orr-001-003",
                order: 3,
                text: "SLO breaches are noticed but do not trigger a consistent response",
              },
              {
                id: "cli-orr-001-004",
                order: 4,
                text: "SLO targets documented with rationale tied to a technical (e.g. baseline performance) or contractual basis, not just a number",
              },
              {
                id: "cli-orr-001-005",
                order: 5,
                text: "Error types included in or excluded from SLO calculations are explicitly defined with documented justification for each",
              },
              {
                id: "cli-orr-001-006",
                order: 6,
                text: "SLO dimensions cover all critical aspects of service health for this service type (e.g., availability + latency for request-response; delay + correctness for data pipelines; drift + feature consistency for ML)",
              },
              {
                id: "cli-orr-001-007",
                order: 7,
                text: "Error budget policy documented with defined response actions",
              },
              {
                id: "cli-orr-001-008",
                order: 8,
                text: "Team is aware of current budget status",
              },
              {
                id: "cli-orr-001-009",
                order: 9,
                text: "SLO targets calibrated to measurable business or customer outcomes (e.g., derived from SLA contracts, user research, or churn data)",
              },
              {
                id: "cli-orr-001-010",
                order: 10,
                text: "Multi-window/multi-burn rate alerts active, triggering before the budget is exhausted (identifying rapid vs. slow budget depletion)",
              },
              {
                id: "cli-orr-001-011",
                order: 11,
                text: "Error budget policy enforced when budget is exhausted",
              },
              {
                id: "cli-orr-001-012",
                order: 12,
                text: "SLO targets and budget performance reviewed quarterly to ensure they remain calibrated to current business needs and downstream consumer or customer expectations",
              },
              {
                id: "cli-orr-001-013",
                order: 13,
                text: "Direct financial and/or operational impact of an SLO breach is quantified or estimated (e.g., lost volume, customers impacted, support tickets/overhead)",
              },
              {
                id: "cli-orr-001-014",
                order: 14,
                text: "Multi-quarter error budget trends reviewed to identify systemic reliability risks and inform prioritisation (e.g. architectural investments over new features)",
              },
              {
                id: "cli-orr-001-015",
                order: 15,
                text: "All error budget policy overrides are logged with risk justification, visible to product and engineering leads",
              },
              {
                id: "cli-orr-001-016",
                order: 16,
                text: "Besides direct impact, indirect business impact of an SLO breach is quantified or estimated (e.g. engineering/support overhead, merchant churn risk, impact on volume growth)",
              },
              {
                id: "cli-orr-001-017",
                order: 17,
                text: "(Automated) deployment gates tied to error budget status *(platform capability not yet available)*",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "SLO Onboarding Guide",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/shared-application-capabilities/platform-observability/platform-observability/service-level-objectives-slo/slo-onboarding",
              },
              {
                title: "SLO Training on Campus",
                url: "https://campus.adyen.com/learn/courses/253/service-level-objectives",
              },
              {
                title: "Error Budget Policy",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/shared-application-capabilities/platform-observability/platform-observability/service-level-objectives-slo#error-budgets",
              },
              {
                title: "SLO Repository",
                url: "https://gitlab-infra.is.adyen.com/slo/slo",
              },
              {
                title: "SLO by Team Dashboards",
                url: "https://grafana.is.adyen.com/dashboards/f/370db652d765325a574ab088eb6bbe98/slos-by-team",
              },
              {
                title: "Example: SLO Error Budget Policy",
                url: "https://gitlab-infra.is.adyen.com/slo/slo/-/blob/main/definitions/recurring-and-tokenization/recharge.md?ref_type=heads#error-budget",
              },
              {
                title: "SLO Multi-window/Multi-burn Rate Capability",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/shared-application-capabilities/platform-observability/platform-observability/service-level-objectives-slo/slo-monitoring#alerts",
              },
              {
                title: "Grafana Alerting Plugin (per owner)",
                url: "https://grafana.is.adyen.com/a/adyen-alerting-app/rules-list",
              },
            ],
          },
          {
            id: "q-rel-002",
            order: 2,
            type: "checklist",
            text: "How mature is your service's redundancy and recovery?",
            riskLevel: "medium",
            importance:
              "Service redundancy can prevent a single failure (e.g. on infrastructure) from taking down your service. But redundancy is only real if it's also tested, both at the failover layer (does traffic shift correctly?) and at the data layer (can you actually restore from backup?).",
            checklistItems: [
              {
                id: "cli-orr-002-001",
                order: 1,
                text: "Service is deployed across multiple DCs but failover is untested or requires manual intervention",
              },
              {
                id: "cli-orr-002-002",
                order: 2,
                text: "Backup/recovery ownership is unclear (platform-managed vs. team-managed, see note below)",
              },
              {
                id: "cli-orr-002-003",
                order: 3,
                text: "Recovery procedures are documented but the team has not validated them or confirmed restore capability",
              },
              {
                id: "cli-orr-002-004",
                order: 4,
                text: "Service deployed across all DCs in a region (Tier 1/2) or minimum 2 DCs (Tier 3/4)",
              },
              {
                id: "cli-orr-002-005",
                order: 5,
                text: "Runtime dependencies in the critical path meet the same redundancy standard or have a validated fallback",
              },
              {
                id: "cli-orr-002-006",
                order: 6,
                text: "Automated health-check-based failover configured (no manual intervention required)",
              },
              {
                id: "cli-orr-002-007",
                order: 7,
                text: "Failover tested within the last 180 days",
              },
              {
                id: "cli-orr-002-008",
                order: 8,
                text: "Recovery procedures documented with recovery targets and validated within the last 90 days",
              },
              {
                id: "cli-orr-002-009",
                order: 9,
                text: "Failover tested on a tier-appropriate cadence (Tier 1: quarterly; Tier 2: bi-annually; Tier 3: annually; Tier 4: ad-hoc)",
              },
              {
                id: "cli-orr-002-010",
                order: 10,
                text: "Recovery time measured against recovery targets after each validation",
              },
              {
                id: "cli-orr-002-011",
                order: 11,
                text: "Point-in-time recovery capability validated",
              },
              {
                id: "cli-orr-002-012",
                order: 12,
                text: "Recovery validation is part of the team's regular operational cadence",
              },
              {
                id: "cli-orr-002-013",
                order: 13,
                text: "Failover includes asymmetric load scenarios (e.g. 80/20 DC split)",
              },
              {
                id: "cli-orr-002-014",
                order: 14,
                text: "Chaos engineering explicitly includes DC-failure scenarios (*platform capability partially supported*)",
              },
              {
                id: "cli-orr-002-015",
                order: 15,
                text: "Recovery runbook tested by engineers other than the original author",
              },
              {
                id: "cli-orr-002-016",
                order: 16,
                text: "Symmetric load distribution validated quarterly",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Observatory",
                url: "https://adyen-observatory.intapplb-np.nlzwo1o.adyen.com/environments/live",
              },
              {
                title: "Chaos Engineering Guide",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/adyen-cloud-services/acs-singapore/products/chaos-engineering/user-guides",
              },
              {
                title: "Simulate Network Conditions for Databases",
                url: "https://gitlab.is.adyen.com/containers/toxic_net",
              },
              {
                title: "S3 Best Practices",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/adyen-cloud-services/storage-platform/s3/best-practices-guide",
              },
              {
                title: "Example: Failover Procedure (Grafana Datasource)",
                url: "https://hub.is.adyen.com/engineering/fundamentals/runbooks/services/grafana/procedures/datasource-failover",
              },
              {
                title: "Example: Recovery Runbook (Target2)",
                url: "https://hub.is.adyen.com/engineering/fundamentals/runbooks/services/disasterrecovery/procedures/target2_recovery",
              },
              {
                title: "Example: Database Recovery (India)",
                url: "https://youtrack.is.adyen.com/issue/DBA-3436/Evidence-of-database-data-recovery-for-India-2025-12",
              },
              {
                title: "Example: Contingency Test (Fedline Direct)",
                url: "https://youtrack.is.adyen.com/issue/BNP-5376",
              },
              {
                title: "Business Continuity Testing",
                url: "https://hub.is.adyen.com/engineering/fundamentals/reliability-knowledge-base/business-continuity-testing",
              },
              {
                title: "2026 Business Continuity Test Plan",
                url: "https://docs.google.com/document/d/16JVCGEjBAHwyJu1lO8LG0AhI8Ik90hTx/edit?usp=sharing&ouid=113203795931475268875&rtpof=true&sd=true",
              },
            ],
          },
          {
            id: "q-rel-003",
            order: 3,
            type: "checklist",
            text: "How mature is your service resilience under load and failure?",
            riskLevel: "medium",
            importance:
              "Cascading failures and traffic spikes are among the most common causes of large-scale outages. Resilience patterns (circuit breakers, timeouts, rate limiting) isolate and contain failures before they propagate. Load testing validates capacity before it's needed. Chaos and failure testing proactively exposes weaknesses before they become incidents. Mature service resilience means your service degrades gracefully instead of catastrophically.",
            checklistItems: [
              {
                id: "cli-orr-003-001",
                order: 1,
                text: "Basic timeouts configured on some calls but coverage is inconsistent",
              },
              {
                id: "cli-orr-003-002",
                order: 2,
                text: "Load testing has been done historically but is not repeatable or regularly run",
              },
              {
                id: "cli-orr-003-003",
                order: 3,
                text: "Some circuit breakers or rate limiting in place",
              },
              {
                id: "cli-orr-003-004",
                order: 4,
                text: "Some structured failure or chaos testing has been conducted",
              },
              {
                id: "cli-orr-003-005",
                order: 5,
                text: "Timeouts configured on all synchronous dependency calls (no infinite waits)",
              },
              {
                id: "cli-orr-003-006",
                order: 6,
                text: "Circuit breakers configured on all critical dependencies",
              },
              {
                id: "cli-orr-003-007",
                order: 7,
                text: "Retry policies use exponential backoff with jitter; idempotency maintained",
              },
              {
                id: "cli-orr-003-008",
                order: 8,
                text: "Rate limiting configured per endpoint (and per client where applicable)",
              },
              {
                id: "cli-orr-003-009",
                order: 9,
                text: "Fail-safe or degraded-mode behaviour documented for all critical dependencies (e.g., failing closed for security, failing open for availability, or serving stale cached data)",
              },
              {
                id: "cli-orr-003-010",
                order: 10,
                text: "Idempotent reprocessing capability tested",
              },
              {
                id: "cli-orr-003-011",
                order: 11,
                text: "Data validation and schema enforcement at ingestion boundaries",
              },
              {
                id: "cli-orr-003-012",
                order: 12,
                text: "Retry policies with exponential backoff configured for transient failures",
              },
              {
                id: "cli-orr-003-013",
                order: 13,
                text: "ETL/pipeline task priorities configured considering both task and downstream dependency SLA or requirements",
              },
              {
                id: "cli-orr-003-014",
                order: 14,
                text: "Service load/volume tested with results documented; capacity margin above highest observed peak in the last 90 days meets tier targets (Tier 1/2: ≥3× of which one load test is on the India platform annually; Tier 3/4: ≥2×)",
              },
              {
                id: "cli-orr-003-015",
                order: 15,
                text: "Resilience patterns effectiveness tracked and reviewed quarterly",
              },
              {
                id: "cli-orr-003-016",
                order: 16,
                text: "Load/volume tested to projected peak (incorporating growth trends and planned events) with realistic dependency load included",
              },
              {
                id: "cli-orr-003-017",
                order: 17,
                text: "Bottlenecks identified from load testing tracked and addressed",
              },
              {
                id: "cli-orr-003-018",
                order: 18,
                text: "Breaking point documented; capacity limits known and communicated",
              },
              {
                id: "cli-orr-003-019",
                order: 19,
                text: "Single-host failure tested on a tier-appropriate cadence (e.g., verifying zero-impact recovery after single instance failure)",
              },
              {
                id: "cli-orr-003-020",
                order: 20,
                text: "Resilience patterns validated through scheduled failure injection experiments in non-production, with findings tracked to resolution",
              },
              {
                id: "cli-orr-003-021",
                order: 21,
                text: "Adaptive timeouts based on live dependency health *(platform capability not yet available)*",
              },
              {
                id: "cli-orr-003-022",
                order: 22,
                text: "Service proven to shed excess load gracefully, keeping critical flows available during extreme saturation",
              },
              {
                id: "cli-orr-003-023",
                order: 23,
                text: "Multiple peak load profiles tested (sustained, spike, ramp)",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Tailor Client Resiliency",
                url: "https://hub.is.adyen.com/engineering/fundamentals/adyen-development-frameworks/tailor-stack/client/topics/resiliency",
              },
              {
                title: "Circuit Breaker Documentation",
                url: "https://hub.is.adyen.com/engineering/fundamentals/adyen-development-frameworks/circuitbreaker",
              },
              {
                title: "Rate Limiter Documentation",
                url: "https://hub.is.adyen.com/engineering/fundamentals/adyen-development-frameworks/rate-limiter",
              },
              {
                title: "Timeout Configuration for Feign Clients",
                url: "https://hub.is.adyen.com/engineering/fundamentals/adyen-development-frameworks/tailor-stack/client/topics/resiliency",
              },
              {
                title: "Chaos Engineering Guide",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/adyen-cloud-services/acs-singapore/products/chaos-engineering",
              },
              {
                title: "Running Chaos Experiments",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/adyen-cloud-services/acs-singapore/products/chaos-engineering/user-guides/runningexperiment",
              },
              {
                title: "Simulate Network Conditions for Databases",
                url: "https://gitlab.is.adyen.com/containers/toxic_net",
              },
              {
                title: "Stress Testing Guidance",
                url: "https://docs.google.com/document/d/122-IQtIkdFUzklx-ouO4NazjONNtEw-kajY3u5xsZgg/edit?tab=t.3m2acfue2n9n",
              },
              {
                title: "Productionizing ETLs",
                url: "https://hub.is.adyen.com/engineering/platform/data/user-guides/how-to-etl",
              },
              {
                title: "ETL Task Priorities in Airflow",
                url: "https://hub.is.adyen.com/engineering/platform/data/user-guides/airflow/airflow-priority",
              },
            ],
          },
        ],
      },
      {
        id: `${ORR_REVISION_ID}:observability-response`,
        templateRevisionId: ORR_REVISION_ID,
        slug: "observability-response",
        name: "Observability & Response",
        order: 2,
        questions: [
          {
            id: "q-sec-001",
            order: 1,
            type: "checklist",
            text: "How mature is your operational observability?",
            riskLevel: "medium",
            importance:
              "Observability is the precondition for everything else in this pillar. Without it, incidents are detected by customers before your team, alert noise causes real issues to be missed, and on-call engineers operate blind during the moments that matter most. Coverage, quality, actionability, and useful insights all matter.",
            checklistItems: [
              {
                id: "cli-orr-004-001",
                order: 1,
                text: "Basic dashboards exist but coverage is incomplete or not tied to critical paths",
              },
              {
                id: "cli-orr-004-002",
                order: 2,
                text: "Alerts are configured but severity classification or routing is inconsistent",
              },
              {
                id: "cli-orr-004-003",
                order: 3,
                text: "Significant monitoring gaps exist across critical paths",
              },
              {
                id: "cli-orr-004-004",
                order: 4,
                text: "Alert noise is considered high (e.g. >50% non-actionable) and not regularly reviewed",
              },
              {
                id: "cli-orr-004-005",
                order: 5,
                text: "RED metrics (Rate, Errors, Duration) visible for all endpoints *(for request-response)*",
              },
              {
                id: "cli-orr-004-006",
                order: 6,
                text: "Job success/failure rates, data quality metrics, processing latency, and throughput visible *(for batch/streaming/ML)*",
              },
              {
                id: "cli-orr-004-007",
                order: 7,
                text: "Model performance stability metrics (accuracy, drift), prediction latency and availability, and feature quality visible *(for ML)*",
              },
              {
                id: "cli-orr-004-008",
                order: 8,
                text: "Resource saturation (CPU, memory, connection pools, queue depth) visible for all critical components",
              },
              {
                id: "cli-orr-004-009",
                order: 9,
                text: "All critical paths have symptom-based alerts (e.g., Rate/Errors/Duration for request-response; job failures/data quality/processing lag for batch/ML) calibrated to trigger before SLO breach",
              },
              {
                id: "cli-orr-004-010",
                order: 10,
                text: "Critical alerts route to on-call via PagerDuty with escalation policies configured for teams without 24/7 coverage",
              },
              {
                id: "cli-orr-004-011",
                order: 11,
                text: "All alerts have linked runbooks",
              },
              {
                id: "cli-orr-004-012",
                order: 12,
                text: "Operational dashboards show technical health metrics (e.g., Error Rate) alongside business performance indicators (e.g., Transaction Volume, Conversion Rate) to surface logic-based regressions",
              },
              {
                id: "cli-orr-004-013",
                order: 13,
                text: "Alert noise tracked and reviewed (e.g. target: <15% non-actionable)",
              },
              {
                id: "cli-orr-004-014",
                order: 14,
                text: "On-call page load tracked (e.g. target: <10 pages/week)",
              },
              {
                id: "cli-orr-004-015",
                order: 15,
                text: "Monitoring coverage gaps inventoried and prioritised",
              },
              {
                id: "cli-orr-004-016",
                order: 16,
                text: "Dashboards and alert configuration reviewed quarterly",
              },
              {
                id: "cli-orr-004-017",
                order: 17,
                text: "Dashboards use efficient queries and remain accessible during outages via a read-only fallback or alternative display",
              },
              {
                id: "cli-orr-004-018",
                order: 18,
                text: "Coverage gaps are tracked to zero",
              },
              {
                id: "cli-orr-004-019",
                order: 19,
                text: "Automated anomaly detection supplements threshold-based alerts *(platform capability not yet available out of the box)*",
              },
              {
                id: "cli-orr-004-020",
                order: 20,
                text: "Alert thresholds auto-tuned based on historical signal quality *(platform capability not yet available)*",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "SLO Alert Configuration",
                url: "https://gitlab-infra.is.adyen.com/slo/slo/-/tree/main#sending-alerts-to-pagerduty",
              },
              {
                title: "Prometheus Alerting Rules",
                url: "https://gitlab-infra.is.adyen.com/is/prometheus-rules/",
              },
              {
                title: "PagerDuty Team Request",
                url: "https://accessportal.is.adyen.com/catalog?search=pagerduty",
              },
              {
                title: "PagerDuty Incidents/Alert Load in DX",
                url: "https://app.getdx.com/report/incidents?period=l3m",
              },
              {
                title: "Grafana Alerting Plugin (per owner)",
                url: "https://grafana.is.adyen.com/a/adyen-alerting-app/rules-list",
              },
              {
                title: "Grafana Best Practices",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/shared-application-capabilities/platform-observability/platform-observability/grafana#best-practices",
              },
              {
                title: "Grafana Emergency Instance",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/shared-application-capabilities/platform-observability/platform-observability/grafana/grafana-emergency",
              },
              {
                title: "Streamlining Observability Data",
                url: "https://docs.google.com/document/d/122-IQtIkdFUzklx-ouO4NazjONNtEw-kajY3u5xsZgg/edit?tab=t.u6k3wu6p2vgz#bookmark=id.x982v0bouykm",
              },
              {
                title: "JVM Metrics",
                url: "https://grafana.is.adyen.com/d/Q6p4OfvVz/jvm-metrics",
              },
              {
                title: "Internal Errors Dashboard",
                url: "https://grafana.is.adyen.com/d/obtJs3QWz/internal-errors",
              },
            ],
          },
          {
            id: "q-sec-002",
            order: 2,
            type: "checklist",
            text: "How mature is your incident response capability?",
            riskLevel: "medium",
            importance:
              "Effective incident response depends on multiple elements working together under pressure: clear ownership, reliable alerting, documented procedures, and responders who are trained to execute them. Weakness in any of these areas (unclear on-call ownership, missing runbooks, unpractised responders, or lack of escalation paths) can turn a recoverable incident into a prolonged outage.\n\nIncident response maturity reflects how predictably and efficiently a team can detect, coordinate, and mitigate incidents while minimizing customer impact.",
            checklistItems: [
              {
                id: "cli-orr-005-001",
                order: 1,
                text: "An on-call engineer is designated at all times, but coverage or escalation may be unclear",
              },
              {
                id: "cli-orr-005-002",
                order: 2,
                text: "Alerts reach the on-call engineer, but ownership or response expectations are not well defined",
              },
              {
                id: "cli-orr-005-003",
                order: 3,
                text: "Some runbooks exist but coverage is incomplete or outdated",
              },
              {
                id: "cli-orr-005-004",
                order: 4,
                text: "Incident roles are not fully understood or consistently applied",
              },
              {
                id: "cli-orr-005-005",
                order: 5,
                text: "No structured incident drills have been conducted",
              },
              {
                id: "cli-orr-005-006",
                order: 6,
                text: "On-call schedule published at least 2 weeks in advance",
              },
              {
                id: "cli-orr-005-007",
                order: 7,
                text: "On-call coverage is sufficient for the team's support model, with escalation paths documented",
              },
              {
                id: "cli-orr-005-008",
                order: 8,
                text: "All critical alerts have linked runbooks reviewed within the last 90 days",
              },
              {
                id: "cli-orr-005-009",
                order: 9,
                text: "Team is aware of all incident roles (commander, technical lead, scribe) and understands the expectations of each",
              },
              {
                id: "cli-orr-005-010",
                order: 10,
                text: "Incident drill cadence defined",
              },
              {
                id: "cli-orr-005-011",
                order: 11,
                text: "Runbooks tested by engineers other than the original author",
              },
              {
                id: "cli-orr-005-012",
                order: 12,
                text: "Business impact data available within minutes of incident start",
              },
              {
                id: "cli-orr-005-013",
                order: 13,
                text: "On-call load tracked and balanced across team members",
              },
              {
                id: "cli-orr-005-014",
                order: 14,
                text: "Incident roles rotate across the team to build shared capability",
              },
              {
                id: "cli-orr-005-015",
                order: 15,
                text: "At least one incident/disaster recovery drill completed within the last two quarters (Tier 1/2), of which one covering the India platform where applicable, or within the last year (Tier 3/4)",
              },
              {
                id: "cli-orr-005-016",
                order: 16,
                text: "Runbooks accessible offline to entire team and independently of affected systems (e.g. locally checked out)",
              },
              {
                id: "cli-orr-005-017",
                order: 17,
                text: "Incident / disaster recovery drills conducted on a tier-appropriate cadence (Tier 1/2: quarterly, of which one covering the India platform every two quarters; Tier 3/4: bi-annually)",
              },
              {
                id: "cli-orr-005-018",
                order: 18,
                text: "Incident logs for the last quarter demonstrate adherence to defined response SLAs (communication frequency, role assignment, and MTTA) across all severity levels",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Incident Management Process",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-management",
              },
              {
                title: "Incident Lifecycle",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-management/incident-states",
              },
              {
                title: "Incident Severity Guide",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-management/fundamentals#severity",
              },
              {
                title: "Incident Management Training",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-management#trainings",
              },
              {
                title: "Practicing an Incident",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-io/incident-io-user-handbook#5-practicing-an-incident",
              },
              {
                title: "Runbook Repository",
                url: "https://gitlab.is.adyen.com/adyen-public/runbooks",
              },
              {
                title: "On-Call Documentation",
                url: "https://hub.is.adyen.com/engineering/oncall/on-call-is-the-new-duty",
              },
              {
                title: "Business Continuity Management",
                url: "https://hub.is.adyen.com/our-company/organization/functions/second-line/enterprise-risk/corporate-risk/risk-management/business-continuity-and-crisis-management#description",
              },
              {
                title: "Example: Exercise Incidents",
                url: "https://youtrack.is.adyen.com/issues?q=%23IN%20Incident%20Type:%20Exercise%20sort%20by:created",
              },
            ],
          },
          {
            id: "q-sec-003",
            order: 3,
            type: "checklist",
            text: "How mature is your incident learning and proactive risk practice?",
            riskLevel: "medium",
            importance:
              "Incidents are expensive lessons. The question is whether the cost pays off in improved reliability, or whether the same failure recurs. Post-mortems close the loop on past failures; pre-mortems open the loop on anticipated future ones. Action item tracking is the mechanism that converts insight into change. Without all three, the cycle of incident → learning → improvement breaks down — and reliability debt compounds.",
            checklistItems: [
              {
                id: "cli-orr-006-001",
                order: 1,
                text: "Post-mortems are conducted occasionally after major incidents but not consistently",
              },
              {
                id: "cli-orr-006-002",
                order: 2,
                text: "Findings from post-mortems are rarely tracked to completion",
              },
              {
                id: "cli-orr-006-003",
                order: 3,
                text: "No proactive risk review is conducted before high-risk periods",
              },
              {
                id: "cli-orr-006-004",
                order: 4,
                text: "Blameless post-mortems conducted following a defined structure (timeline, root cause, impact) and oriented toward systemic causes rather than individual error",
              },
              {
                id: "cli-orr-006-005",
                order: 5,
                text: "Action items assigned with owners and due dates",
              },
              {
                id: "cli-orr-006-006",
                order: 6,
                text: "Action items tracked in team backlog and reviewed in team meetings",
              },
              {
                id: "cli-orr-006-007",
                order: 7,
                text: "Pre-mortems conducted before significant high-risk periods",
              },
              {
                id: "cli-orr-006-008",
                order: 8,
                text: "Post-mortem completion rate tracked (target: 100% for SEV-3 and above, as per incident management policy)",
              },
              {
                id: "cli-orr-006-009",
                order: 9,
                text: "Action item completion rate reviewed bi-weekly; target is 100% adherence to defined due dates",
              },
              {
                id: "cli-orr-006-010",
                order: 10,
                text: "Overdue items are visible to the team; items breaching defined due dates are escalated to the team lead for reprioritisation",
              },
              {
                id: "cli-orr-006-011",
                order: 11,
                text: "Pre-mortem findings actively mitigated and inform ORR focus areas",
              },
              {
                id: "cli-orr-006-012",
                order: 12,
                text: "Learnings shared across teams to prevent systemic recurrence",
              },
              {
                id: "cli-orr-006-013",
                order: 13,
                text: "Recurring incident patterns trigger fixes for systematic (e.g. platform-level) issues",
              },
              {
                id: "cli-orr-006-014",
                order: 14,
                text: "Post-incident reviews produce tracked reliability improvements and recurring incident patterns are reviewed at least quarterly",
              },
              {
                id: "cli-orr-006-015",
                order: 15,
                text: "Proactive risk reviews embedded in all significant planning cycles",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Pre-mortem Guidance",
                url: "https://coda.io/@shreyas/pre-mortems-how-a-stripe-product-manager-predicts-prevents-probl",
              },
              {
                title: "Pre-mortem Figma Template",
                url: "https://www.figma.com/file/WHfQLXee6u5no9QWBr1FzZ/Peak-Season-Pre-Mortem-Template",
              },
              {
                title: "Incident Management Process",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-management",
              },
              {
                title: "Post-incident Process",
                url: "https://hub.is.adyen.com/engineering/oncall/incident-management/after-resolution#description",
              },
              {
                title: "Reliability & Incident Insights Looker",
                url: "https://looker.is.adyen.com/dashboards/28951",
              },
              {
                title: "Incident.io Dashboard (Teams)",
                url: "https://app.incident.io/adyen/teams",
              },
              {
                title: "Example: Pre Mortem for Performance Insights",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/unified-platform/core-accounting-and-configuration/finance-observability/peak-season",
              },
              {
                title: "Example: Global Reliability Weekly Review & Learnings",
                url: "https://docs.google.com/presentation/d/1GUhfQ_LtI4ElDiZ5rdvHm9EAZR7YxsrcCQ--S2YnoM0/edit",
              },
            ],
          },
        ],
      },
      {
        id: `${ORR_REVISION_ID}:change-release-safety`,
        templateRevisionId: ORR_REVISION_ID,
        slug: "change-release-safety",
        name: "Change & Release Safety",
        order: 3,
        questions: [
          {
            id: "q-inf-001",
            order: 1,
            type: "checklist",
            text: "How mature is your deployment verification and quality?",
            riskLevel: "medium",
            importance:
              "Deployment quality is measurable. Change failure rate tells you how often you break production. Test coverage tells you how well you catch issues before you do. Deployment frequency may tell you whether fear of deployment is slowing your team down. These three metrics form a coherent picture of whether your team can change safely and confidently.",
            checklistItems: [
              {
                id: "cli-orr-007-001",
                order: 1,
                text: "Some tests exist but are not consistently tied to the deployment pipeline",
              },
              {
                id: "cli-orr-007-002",
                order: 2,
                text: "Change failure rate (CFR) is tracked informally or not at all",
              },
              {
                id: "cli-orr-007-003",
                order: 3,
                text: "Deployments are infrequent or only driven by external forcing functions rather than team cadence",
              },
              {
                id: "cli-orr-007-004",
                order: 4,
                text: "Critical path components have a minimum of 80% unit test coverage, targeting business logic and error-handling branches",
              },
              {
                id: "cli-orr-007-005",
                order: 5,
                text: "Critical component integrations are validated in CI",
              },
              {
                id: "cli-orr-007-006",
                order: 6,
                text: "Test failures block deployment and are treated as blocking regressions",
              },
              {
                id: "cli-orr-007-007",
                order: 7,
                text: "Change failure rate tracked",
              },
              {
                id: "cli-orr-007-008",
                order: 8,
                text: "Deployment frequency tracked",
              },
              {
                id: "cli-orr-007-009",
                order: 9,
                text: "Test coverage trends monitored per release cycle; bi-weekly reviews ensure new feature development does not outpace test suite expansion",
              },
              {
                id: "cli-orr-007-010",
                order: 10,
                text: "Coverage gates enforced in CI; coverage regressions block merge",
              },
              {
                id: "cli-orr-007-011",
                order: 11,
                text: "Tests with non-deterministic results are automatically identified and “quarantined” (moved out of the blocking path); quarantined tests must be stabilized or deleted within 5 days",
              },
              {
                id: "cli-orr-007-012",
                order: 12,
                text: "Smoke tests run automatically post-deployment",
              },
              {
                id: "cli-orr-007-013",
                order: 13,
                text: "Root cause documented for all failed changes",
              },
              {
                id: "cli-orr-007-014",
                order: 14,
                text: "CFR meets a defined team target, reviewed quarterly",
              },
              {
                id: "cli-orr-007-015",
                order: 15,
                text: "End-to-end tests cover all critical user journeys",
              },
              {
                id: "cli-orr-007-016",
                order: 16,
                text: "Near-zero flakiness sustained; test suite reliability is actively managed",
              },
              {
                id: "cli-orr-007-017",
                order: 17,
                text: "Deployments are routine and unremarkable, i.e. a non-event",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Change failure rate in DX",
                url: "https://app.getdx.com/report/cfr-sr",
              },
              {
                title: "SonarQube",
                url: "https://sonarqube.app01.k8s.adyen.com/projects",
              },
              {
                title: "Testing Guide",
                url: "https://hub.is.adyen.com/engineering/fundamentals/guides/testing",
              },
              {
                title: "Smoke Tests",
                url: "https://hub.is.adyen.com/engineering/fundamentals/guides/testing/smoketests",
              },
              {
                title: "Team Metrics: Quality Maturity Dashboard",
                url: "https://launchpad.is.adyen.com/code-health/team-metrics",
              },
              {
                title: "Container Deployment Dashboard",
                url: "https://grafana.is.adyen.com/d/c763558d-5dd6-41c8-9639-759e9aa7ad67/container-deployment",
              },
              {
                title: "Code Coverage Documentation",
                url: "https://hub.is.adyen.com/engineering/fundamentals/guides/testing/code-coverage",
              },
              {
                title: "How to Eliminate Flaky Tests",
                url: "https://hub.is.adyen.com/engineering/fundamentals/guides/testing/quality-insights/how-to-eliminate-flaky-tests",
              },
              {
                title: "Release Autonomy Quality Gate Reporting",
                url: "https://hub.is.adyen.com/engineering/fundamentals/guides/testing/quality-insights/release-autonomy-issue-reporting",
              },
            ],
          },
          {
            id: "q-inf-002",
            order: 2,
            type: "checklist",
            text: "How mature is your deployment safety and rollback capability?",
            riskLevel: "medium",
            importance:
              "Even well-tested changes fail in production. The ability to limit blast radius (gradual deployment), instantly deactivate features without redeployment, and quickly undo changes (fast rollback) determines how much a bad deployment costs you. These are your last line of defence, and they must be tested.",
            checklistItems: [
              {
                id: "cli-orr-008-001",
                order: 1,
                text: "Rollback is possible but manual and untested under realistic conditions",
              },
              {
                id: "cli-orr-008-002",
                order: 2,
                text: "Staged deployment is done occasionally but without automation or consistent process",
              },
              {
                id: "cli-orr-008-003",
                order: 3,
                text: "Feature flags are used ad-hoc without a defined lifecycle or cleanup process",
              },
              {
                id: "cli-orr-008-004",
                order: 4,
                text: "Rollback procedure documented and tested; rollback time measured",
              },
              {
                id: "cli-orr-008-005",
                order: 5,
                text: "Database migrations are backward-compatible (enabling safe rollback)",
              },
              {
                id: "cli-orr-008-006",
                order: 6,
                text: "Canary or staged deployment used before full rollout",
              },
              {
                id: "cli-orr-008-007",
                order: 7,
                text: "Health checks gate progression between deployment stages",
              },
              {
                id: "cli-orr-008-008",
                order: 8,
                text: "High-risk features deployed behind flags, toggleable without redeployment",
              },
              {
                id: "cli-orr-008-009",
                order: 9,
                text: "Rollback time tracked and consistently meets a defined team target",
              },
              {
                id: "cli-orr-008-010",
                order: 10,
                text: "Deployment health signals (error rate, latency) are automatically monitored post-deployment and can trigger rollback when appropriate",
              },
              {
                id: "cli-orr-008-011",
                order: 11,
                text: "A defined bake period is observed between deployment stages; health signals are reviewed before progression to full rollout",
              },
              {
                id: "cli-orr-008-012",
                order: 12,
                text: "Feature flag state monitored; flag cleanup cadence defined; flag debt tracked",
              },
              {
                id: "cli-orr-008-013",
                order: 13,
                text: "Rollback tested after every change to deployment mechanism",
              },
              {
                id: "cli-orr-008-014",
                order: 14,
                text: "Zero data loss validated during rollback tests",
              },
              {
                id: "cli-orr-008-015",
                order: 15,
                text: "Gradual deployment with ML-based or adaptive anomaly detection for rollback triggers",
              },
              {
                id: "cli-orr-008-016",
                order: 16,
                text: "Feature flag lifecycle is automated: stale flags are detected and removed without manual intervention",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Canary Deployments (for adyen-main)",
                url: "https://hub.is.adyen.com/engineering/releasing/release-tools/containers/canary-deployments",
              },
              {
                title: "Deployment Quality Gates",
                url: "https://hub.is.adyen.com/engineering/releasing/release-tools/quality-gates#description",
              },
              {
                title: "Features and Kill Switches",
                url: "https://hub.is.adyen.com/engineering/fundamentals/adyen-development-frameworks/enabling_features",
              },
              {
                title: "Rollout Plans",
                url: "https://hub.is.adyen.com/engineering/fundamentals/adyen-development-frameworks/enabling_features/rollout-plans",
              },
              {
                title: "Feature Flag Cleaner Plugin",
                url: "https://hub.is.adyen.com/engineering/fundamentals/tools/feature-flag-cleaner-intellij-plugin",
              },
              {
                title: "K8s Lifecycle Management",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/adyen-cloud-services/containers/lifecycle/k8s_lifecycle_management",
              },
              {
                title: "Internal Error Monitoring Dashboard",
                url: "https://grafana.is.adyen.com/d/jgbPrh8iz/error-monitoring?var-interval=$__auto&orgId=1&from=now-1h&to=now&timezone=browser&var-env=live&var-Filters=event.severityLevel%7C%21%3D%7CINFO&var-elasticmon=000000092&var-elasticmon_unfiltered=000000092&refresh=1m",
              },
              {
                title: "Container Deployment Dashboard",
                url: "https://grafana.is.adyen.com/d/c763558d-5dd6-41c8-9639-759e9aa7ad67/container-deployment",
              },
              {
                title: "Rolling Back Containers Documentation",
                url: "https://hub.is.adyen.com/engineering/releasing/release_process/common-steps#rolling-back-containers",
              },
              {
                title: "Release Rollback Data Platform",
                url: "https://hub.is.adyen.com/engineering/fundamentals/runbooks/services/data_platform/release-process/procedures/release-issues#release-rollback-data-platform",
              },
            ],
          },
        ],
      },
      {
        id: `${ORR_REVISION_ID}:operational-ownership`,
        templateRevisionId: ORR_REVISION_ID,
        slug: "operational-ownership",
        name: "Operational Ownership",
        order: 4,
        questions: [
          {
            id: "q-ops-001",
            order: 1,
            type: "checklist",
            text: "How mature is your operational knowledge and system understanding?",
            riskLevel: "medium",
            importance:
              "During incidents, the questions “who owns this?” and “how does this system work?” need an immediate answer. Ownership records that are out of date, architecture diagrams that are stale, undocumented dependencies, and knowledge concentrated in a single person all directly can extend MTTR (Mean Time To Repair).",
            checklistItems: [
              {
                id: "cli-orr-009-001",
                order: 1,
                text: "Service is in the catalog but ownership or contact information is outdated",
              },
              {
                id: "cli-orr-009-002",
                order: 2,
                text: "Some documentation exists but is incomplete or stale",
              },
              {
                id: "cli-orr-009-003",
                order: 3,
                text: "Dependencies are partially known but not formally documented or defined in the catalog",
              },
              {
                id: "cli-orr-009-004",
                order: 4,
                text: "Owner team and communication channels defined and current in service catalog",
              },
              {
                id: "cli-orr-009-005",
                order: 5,
                text: "Published architecture diagram that is current (<90 days), showing topology, data flow, and dependencies",
              },
              {
                id: "cli-orr-009-006",
                order: 6,
                text: "All critical dependencies listed with SLAs, escalation contacts, and fallback behaviour",
              },
              {
                id: "cli-orr-009-007",
                order: 7,
                text: "Any runtime or infrastructure dependency within 12 months of end-of-life tracked with a documented migration plan",
              },
              {
                id: "cli-orr-009-008",
                order: 8,
                text: "Production credentials and secrets rotated on a defined schedule",
              },
              {
                id: "cli-orr-009-009",
                order: 9,
                text: "SPOF inventory exists for both technical components and knowledge concentration (e.g. tickets tagged as #SPOF in YouTrack)",
              },
              {
                id: "cli-orr-009-010",
                order: 10,
                text: "Threat model documented and reviewed within the last 12 months",
              },
              {
                id: "cli-orr-009-011",
                order: 11,
                text: "Ownership changes trigger ORR re-review",
              },
              {
                id: "cli-orr-009-012",
                order: 12,
                text: "Failure domains and blast radius documented in architecture",
              },
              {
                id: "cli-orr-009-013",
                order: 13,
                text: "Dependency health monitored continuously",
              },
              {
                id: "cli-orr-009-014",
                order: 14,
                text: "PenTest conducted annually or after major changes (ideally after threat modeling and before going live with new features)",
              },
              {
                id: "cli-orr-009-015",
                order: 15,
                text: "Critical vulnerabilities remediated within a defined SLA",
              },
              {
                id: "cli-orr-009-016",
                order: 16,
                text: "Privileged production access reviewed quarterly",
              },
              {
                id: "cli-orr-009-017",
                order: 17,
                text: "Knowledge SPOFs actively mitigated through cross-training and documentation",
              },
              {
                id: "cli-orr-009-018",
                order: 18,
                text: "All critical operations for this service can be performed by at least 2 engineers; fluency with another service in the team's portfolio does not satisfy this requirement",
              },
              {
                id: "cli-orr-009-019",
                order: 19,
                text: "No single person required for any critical operation; knowledge transfer validated through rotation",
              },
              {
                id: "cli-orr-009-020",
                order: 20,
                text: "Architecture diagrams accessible during outages (not dependent on affected systems)",
              },
              {
                id: "cli-orr-009-021",
                order: 21,
                text: "SPOF analysis reviewed annually",
              },
              {
                id: "cli-orr-009-022",
                order: 22,
                text: "Dependency SLA breaches tracked and escalated automatically *(platform capability not yet available)*",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "Launchpad Catalog",
                url: "https://launchpad.is.adyen.com/catalog",
              },
              {
                title: "Launchpad Catalog Documentation",
                url: "https://hub.is.adyen.com/our-company/organization/product--engineering/solutions/platform-engineering/idp-internal-developer-platform/developer-portal-experience/launchpad/adyen-catalog",
              },
              {
                title: "Example: Launchpad Catalog Setup",
                url: "https://docs.google.com/document/d/122-IQtIkdFUzklx-ouO4NazjONNtEw-kajY3u5xsZgg/edit?tab=t.pln2r59i7q3j",
              },
              {
                title: "SPOFs in YouTrack",
                url: "https://youtrack.is.adyen.com/issues?q=tag:%7BSPOF%7D%20sort%20by:created",
              },
              {
                title: "Risk Response Objectives Dashboard",
                url: "https://grafana.is.adyen.com/d/LYn8v1SIz/risk-response-objectives-insights-rro",
              },
              {
                title: "Example: Diagrams for Logistics API",
                url: "https://hub.is.adyen.com/engineering/platform/payments/in-person-payments/backend/supply-chain/logisticsapi/architecture-diagrams",
              },
              {
                title: "Architect Service Graphs",
                url: "https://architect.is.adyen.com/",
              },
              {
                title: "Security (Pen) Testing",
                url: "https://hub.is.adyen.com/our-company/organization/functions/security/security-services/offensive-security/security-testing-your-product",
              },
              {
                title: "Threat Modeling at Adyen",
                url: "https://hub.is.adyen.com/our-company/organization/functions/security/security-services/security-partners/threat-modelling",
              },
              {
                title: "Secrets Handling Guidelines",
                url: "https://hub.is.adyen.com/our-company/organization/functions/security/security-services/security-partners/managing-secrets",
              },
            ],
          },
          {
            id: "q-ops-002",
            order: 2,
            type: "checklist",
            text: "How mature is your operational sustainability?",
            riskLevel: "medium",
            importance:
              "Services that cannot scale to demand, whose teams are buried in manual operational work, or that accumulate unaddressed reliability-impacting debt, fail at predictable points. Operational sustainability is the measure of whether your team can actually maintain and improve the service over time, and whether that capacity is increasing or being silently eroded.",
            checklistItems: [
              {
                id: "cli-orr-010-001",
                order: 1,
                text: "Scaling is reactive only, with no forward-looking capacity planning",
              },
              {
                id: "cli-orr-010-002",
                order: 2,
                text: "Toil is recognised informally but not tracked or systematically reduced",
              },
              {
                id: "cli-orr-010-003",
                order: 3,
                text: "Technical debt is discussed but not tied to reliability risk or incorporated into planning",
              },
              {
                id: "cli-orr-010-004",
                order: 4,
                text: "Capacity forecast updated quarterly based on historical growth",
              },
              {
                id: "cli-orr-010-005",
                order: 5,
                text: "Scaling constraints (database connections, external limits, compute/storage costs) identified",
              },
              {
                id: "cli-orr-010-006",
                order: 6,
                text: "Top toil sources identified and occasionally included in planning",
              },
              {
                id: "cli-orr-010-007",
                order: 7,
                text: "Reliability-impacting technical debt tracked in team backlog",
              },
              {
                id: "cli-orr-010-008",
                order: 8,
                text: "Capacity alerts configured to trigger before limits are reached",
              },
              {
                id: "cli-orr-010-009",
                order: 9,
                text: "Toil tracked as a team metric (time or percentage of engineering capacity)",
              },
              {
                id: "cli-orr-010-010",
                order: 10,
                text: "Toil reduction reviewed quarterly with visible progress",
              },
              {
                id: "cli-orr-010-011",
                order: 11,
                text: "Technical debt trend tracked quarter-over-quarter and improving",
              },
              {
                id: "cli-orr-010-012",
                order: 12,
                text: "Auto-scaling configured and validated under load *(platform capability not yet available)*",
              },
              {
                id: "cli-orr-010-013",
                order: 13,
                text: "Toil percentage decreasing trend sustained across multiple quarters",
              },
              {
                id: "cli-orr-010-014",
                order: 14,
                text: "New technical debt evaluated before acceptance (ratchet principle)",
              },
              {
                id: "cli-orr-010-015",
                order: 15,
                text: "Critical reliability debt prioritised over feature work when risk threshold is exceeded",
              },
            ],
            leadingPractices: [],
            helpfulLinks: [
              {
                title: "DX (KTLO)",
                url: "https://app.getdx.com/snapshots/NDk5MQ/allocation?aggregation=team",
              },
              {
                title: "Tech Debt Guidelines",
                url: "https://hub.is.adyen.com/engineering/fundamentals/guides/technical-debt-guidelines",
              },
              {
                title: "Scaling Postgres Connection Pools",
                url: "https://hub.is.adyen.com/engineering/oncall/oncall-procedures/postgresql/scaling-postgresql-connection-pools",
              },
              {
                title: "S3 Storage Usage Dashboard",
                url: "https://grafana.is.adyen.com/d/C9kEZc04k/ceph-s3-users",
              },
              {
                title: "Example: Tech Debt Weeks",
                url: "https://hub.is.adyen.com/engineering/platform/payments/checkout/web/tech-debt-weeks",
              },
              {
                title: "Example: Alert Spark History Quota",
                url: "https://hub.is.adyen.com/engineering/fundamentals/runbooks/services/data_platform/data/storage/alerts/spark-history-quota-exceeded",
              },
              {
                title: "Example: Toil Reduction Plan for Big Data",
                url: "https://youtrack.is.adyen.com/issue/BDA-24/Toil-reduction",
              },
            ],
          },
        ],
      },
    ],
  },
};
