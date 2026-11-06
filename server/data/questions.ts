import type { Question } from "../../app/models";

export const questions: Question[] = [
  // Security Pillar
  {
    id: "sec-1",
    pillar: "security",
    text: "Do you have a documented security incident response plan?",
    type: "yes-no",
    riskLevel: "high",
    answer: "yes",
    importance:
      "Having a documented security incident response plan ensures your team can respond quickly and effectively to security incidents, minimizing potential damage and recovery time.",
    leadingPractices: [
      "Document clear roles and responsibilities",
      "Establish communication protocols",
      "Define escalation procedures",
      "Conduct regular drills and simulations",
    ],
    helpfulLinks: [
      {
        title: "NIST Incident Response Guide",
        url: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.8-61r2.pdf",
      },
      {
        title: "AWS Security Incident Response",
        url: "https://aws.amazon.com/security/incident-response/",
      },
    ],
  },
  {
    id: "sec-2",
    pillar: "security",
    text: "Are all production systems protected by multi-factor authentication?",
    type: "yes-no",
    riskLevel: "critical",
    answer: null,
    importance:
      "Multi-factor authentication significantly reduces the risk of unauthorized access by requiring multiple forms of verification.",
    leadingPractices: [
      "Enforce MFA for all privileged accounts",
      "Use hardware tokens for critical systems",
      "Implement conditional access policies",
      "Regularly review MFA coverage",
    ],
    helpfulLinks: [
      {
        title: "OWASP MFA Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html",
      },
    ],
  },
  {
    id: "sec-3",
    pillar: "security",
    text: "Which security monitoring practices are currently implemented?",
    type: "checklist",
    riskLevel: "high",
    checklistItems: [
      {
        id: "cli-sec-1",
        order: 1,
        text: "SIEM solution with real-time alerting",
      },
      {
        id: "cli-sec-2",
        order: 2,
        text: "Automated threat detection for anomalous traffic",
      },
      {
        id: "cli-sec-3",
        order: 3,
        text: "Regular vulnerability scanning schedule",
      },
      {
        id: "cli-sec-4",
        order: 4,
        text: "Incident response playbook tested quarterly",
      },
    ],
    answer: null,
    importance:
      "Security monitoring is critical for detecting and responding to threats during peak season. These practices help identify suspicious activity before it becomes a security incident.",
    leadingPractices: [],
    helpfulLinks: [
      {
        title: "Security Monitoring Best Practices",
        url: "https://docs.example.com/security-monitoring",
      },
    ],
  },
  {
    id: "sec-4",
    pillar: "security",
    text: "Which data protection measures are in place?",
    type: "checklist",
    riskLevel: "high",
    checklistItems: [
      {
        id: "cli-sec-5",
        order: 1,
        text: "Encryption at rest for all sensitive data",
      },
      {
        id: "cli-sec-6",
        order: 2,
        text: "TLS/SSL for data in transit",
      },
      {
        id: "cli-sec-7",
        order: 3,
        text: "Key management service with rotation policy",
      },
      {
        id: "cli-sec-8",
        order: 4,
        text: "Data classification and access controls",
      },
      {
        id: "cli-sec-9",
        order: 5,
        text: "Regular data backup with encryption",
      },
    ],
    answer: null,
    importance:
      "Data protection is essential for maintaining customer trust and regulatory compliance. These measures ensure sensitive information remains secure throughout its lifecycle.",
    leadingPractices: [],
    helpfulLinks: [
      {
        title: "AWS Data Protection Best Practices",
        url: "https://docs.aws.amazon.com/whitepapers/latest/introduction-aws-security/data-protection.html",
      },
      {
        title: "OWASP Data Protection Cheat Sheet",
        url: "https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html",
      },
    ],
  },

  // Infrastructure Pillar
  {
    id: "infra-1",
    pillar: "infrastructure",
    text: "Is your infrastructure defined as code?",
    type: "yes-no",
    riskLevel: "medium",
    answer: "yes",
    importance:
      "Infrastructure as Code enables version control, repeatability, and automated deployments, reducing configuration drift and human error.",
    leadingPractices: [
      "Use declarative configuration tools (Terraform, CloudFormation)",
      "Store IaC in version control",
      "Implement automated testing for infrastructure changes",
      "Use modules for reusability",
    ],
    helpfulLinks: [
      {
        title: "Terraform Best Practices",
        url: "https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html",
      },
      {
        title: "AWS CloudFormation Best Practices",
        url: "https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html",
      },
    ],
  },
  {
    id: "infra-2",
    pillar: "infrastructure",
    text: "Do you have automated backup and recovery procedures?",
    type: "yes-no",
    riskLevel: "high",
    answer: "yes",
    importance:
      "Automated backups ensure data can be recovered quickly in case of failures, minimizing downtime and data loss.",
    leadingPractices: [
      "Automate backup schedules",
      "Test recovery procedures regularly",
      "Store backups in multiple locations",
      "Document recovery time objectives (RTO)",
    ],
    helpfulLinks: [
      {
        title: "AWS Backup Best Practices",
        url: "https://docs.aws.amazon.com/aws-backup/latest/devguide/best-practices.html",
      },
    ],
  },
  {
    id: "infra-3",
    pillar: "infrastructure",
    text: "Are your systems configured for high availability?",
    type: "yes-no",
    riskLevel: "high",
    answer: "yes",
    importance:
      "High availability configurations ensure your services remain accessible even during component failures.",
    leadingPractices: [
      "Deploy across multiple availability zones",
      "Implement load balancing",
      "Use auto-scaling groups",
      "Design for failure scenarios",
    ],
    helpfulLinks: [
      {
        title: "AWS High Availability",
        url: "https://aws.amazon.com/architecture/high-availability/",
      },
    ],
  },

  // Reliability Pillar
  {
    id: "rel-1",
    pillar: "reliability",
    text: "Do you have comprehensive monitoring and alerting in place?",
    type: "yes-no",
    riskLevel: "high",
    answer: "yes",
    importance:
      "Comprehensive monitoring enables early detection of issues and faster response times, improving overall system reliability.",
    leadingPractices: [
      "Monitor key performance indicators (KPIs)",
      "Set up alerts for critical thresholds",
      "Use distributed tracing",
      "Implement log aggregation",
    ],
    helpfulLinks: [
      {
        title: "Google SRE Monitoring",
        url: "https://sre.google/sre-book/monitoring-distributed-systems/",
      },
      {
        title: "AWS CloudWatch Best Practices",
        url: "https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Best_Practice_Recommended_Alarms_AWS_Services.html",
      },
    ],
  },
  {
    id: "rel-2",
    pillar: "reliability",
    text: "Have you defined and tested disaster recovery procedures?",
    type: "yes-no",
    riskLevel: "critical",
    answer: "yes",
    importance:
      "Tested disaster recovery procedures ensure business continuity in the event of major failures or disasters.",
    leadingPractices: [
      "Document recovery procedures",
      "Conduct regular DR drills",
      "Define Recovery Point Objectives (RPO)",
      "Automate recovery processes where possible",
    ],
    helpfulLinks: [
      {
        title: "AWS Disaster Recovery",
        url: "https://aws.amazon.com/disaster-recovery/",
      },
    ],
  },
  {
    id: "rel-3",
    pillar: "reliability",
    text: "Do you perform regular chaos engineering exercises?",
    type: "yes-no",
    riskLevel: "medium",
    answer: null,
    importance:
      "Chaos engineering helps identify weaknesses in your system before they cause real outages.",
    leadingPractices: [
      "Start with non-production environments",
      "Define blast radius for experiments",
      "Automate chaos experiments",
      "Document findings and improvements",
    ],
    helpfulLinks: [
      {
        title: "Principles of Chaos Engineering",
        url: "https://principlesofchaos.org/",
      },
    ],
  },

  // Operations Pillar
  {
    id: "ops-1",
    pillar: "operations",
    text: "Do you have a documented runbook for common operational tasks?",
    type: "yes-no",
    riskLevel: "medium",
    answer: null,
    importance:
      "Runbooks ensure consistent execution of operational tasks and reduce the time to resolve issues.",
    leadingPractices: [
      "Document step-by-step procedures",
      "Include troubleshooting guides",
      "Keep runbooks up to date",
      "Make runbooks easily accessible",
    ],
    helpfulLinks: [
      {
        title: "Google SRE Runbooks",
        url: "https://sre.google/sre-book/practical-alerting/",
      },
    ],
  },
  {
    id: "ops-2",
    pillar: "operations",
    text: "Is your deployment process fully automated?",
    type: "yes-no",
    riskLevel: "high",
    answer: null,
    importance:
      "Automated deployments reduce human error, increase deployment frequency, and improve reliability.",
    leadingPractices: [
      "Implement CI/CD pipelines",
      "Use blue-green or canary deployments",
      "Automate rollback procedures",
      "Include automated testing in pipeline",
    ],
    helpfulLinks: [
      {
        title: "AWS CI/CD Best Practices",
        url: "https://aws.amazon.com/devops/continuous-delivery/",
      },
    ],
  },
  {
    id: "ops-3",
    pillar: "operations",
    text: "Do you conduct regular post-incident reviews?",
    type: "yes-no",
    riskLevel: "medium",
    answer: null,
    importance:
      "Post-incident reviews help teams learn from failures and prevent similar issues in the future.",
    leadingPractices: [
      "Conduct blameless postmortems",
      "Document root causes and action items",
      "Share learnings across teams",
      "Track action item completion",
    ],
    helpfulLinks: [
      {
        title: "Google SRE Postmortem Culture",
        url: "https://sre.google/sre-book/postmortem-culture/",
      },
    ],
  },
];
