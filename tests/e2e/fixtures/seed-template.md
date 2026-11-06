# Template: [E2E] Operational Readiness Review

> A lightweight readiness review template used by E2E tests. Covers reliability and security pillars with a mix of yes/no and checklist questions.

**Version:** v1
**Status:** draft

---

## Pillar: Reliability

### Question 1 [Critical]

Have you performed a full failover test in the last 30 days?

**Type:** yes-no

**Why it's important:**

Failover testing validates disaster recovery procedures.

**Leading Practices:**

- Run failover drills quarterly in a staging environment
- Document recovery time and compare against SLA targets

---

### Question 2 [High]

Is your service capable of handling 2x normal peak traffic?

**Type:** yes-no

**Why it's important:**

Capacity planning prevents outages during peak load.

---

## Pillar: Security

### Question 3 [Critical]

Which security review practices are in place?

**Type:** checklist

**Why it's important:**

Security reviews catch vulnerabilities before production.

**Checklist Items:**

- Code review for security-sensitive changes
- Dependency vulnerability scanning
- Penetration testing schedule

**Helpful Links:**

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

### Question 4 [High]

Which monitoring practices are currently active?

**Type:** checklist

**Why it's important:**

Monitoring ensures rapid detection of incidents.

**Checklist Items:**

- Real-time alerting on error rates
- Dashboard for key business metrics
- Paging routes to the responsible on-call engineer

---
