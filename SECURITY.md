# Security Policy

## Reporting a Vulnerability

Peaky handles assessment data that feeds compliance and audit workflows. If you discover a security vulnerability, please do not open a public GitLab issue.

**Report privately:**

1. Open a [confidential GitLab issue](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/new?issue[confidential]=true) using the **Security** issue template
2. Or contact the maintainers directly: [@heitorl](https://gitlab.is.adyen.com/heitorl), [@raffaeleb](https://gitlab.is.adyen.com/raffaeleb)

Include in your report:

- A description of the vulnerability and affected component
- Steps to reproduce or a proof of concept
- Your assessment of severity and potential impact
- Any remediation ideas you have

## Response

We aim to acknowledge reports within 2 business days and resolve critical findings before opening Beta to users. Reporters will be credited in the release notes unless they prefer to remain anonymous.

## Scope

In scope: the sync engine, authentication flow, API endpoints, local SQLite data handling, and deployment configuration.

Out of scope: the Zensical documentation site, Vercel preview deployments, and third-party services (Okta, AWS managed services).

## Prior Security Work

- STRIDE threat model (canonical posture): `site/docs/development/threat-model.md`
- Local-first security walkthrough (the narrative): `site/docs/development/walkthroughs/local-first/security.md`
- Interactive STRIDE explainer: `explainers/stride-threat-model-explainer.html`
- Threat-model drift guard: `tests/guards/threat-model-drift.test.ts` — CI-enforced link between the threat model's checkable facts (paths, entity types, caps) and the code that owns them
- Formal verification: `formal_verification/` — FizzBee specs covering the pull entitlement scoping, SSE content-free frames, and push idempotency invariants (`make verify`; not yet in CI, see issue #29)
- Automated threat modeling: tracked in [Epic #6](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/6) (Beta: Security Review)
