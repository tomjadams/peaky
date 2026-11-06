# Product & Architecture Roadmap

A single page that tracks what we are shipping toward Beta, GA, and beyond — and what each phase unblocks. Below: the live picture for the four phase sections (Now, Beta, GA, Post-GA), a Triage bucket for items we cannot yet classify, and a Deferred Decisions list for things we explicitly parked.

That should be enough — keep reading if you want to dive into a specific epic.

## Epic naming convention

All group-level epics in `containers/rtf` follow the format `<Product>: <Epic title>` — for example: `Peaky: Sync Engine`. Phase is **never** part of the title; it is captured as a GitLab label on the Epic (e.g., `docker-phase:now`) when the author has enough context to classify one.

Phases are a **structuring aid** for this page, not a hard concept, and the phases themselves stop being meaningful once Peaky reaches GA.

!!! tip "Don't know the phase?"
    File the item under `## Triage` below (this page's unclassified bucket) and skip the phase label entirely. The Epic title stays `<Product>: <Epic title>` either way.

This page is the source of truth for "what we said we would do". The `/roadmap` slash command keeps it in sync with the GitLab Epics and child Issues so the link goes both ways. The default epic template in `.gitlab/issue_templates/Epic.md` mirrors the same `<Product>: <Epic title>` shape.

## Now

> Priority-0. Nothing else scales until this is stable — adding people, upgrading models, or opening Beta all depend on it.

### Team Workflows & Developer Experience

> [Epic #25 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/25)

Peaky moved from solo development to a team. The immediate problem is not velocity — it is consistency. Without a codified workflow, changes land without running adversarial reviewers, model upgrades silently drift openspec decisions, and there is no verification loop catching behavioral regressions beyond good intentions.

**Custom Factory Droid slash commands**

We need to build our own slash commands that codify the adversarial reviewer suite as a single, non-skippable step. A `/merge-check` command runs the reviewer roster in one shot and writes an attestation that CI can enforce. The OpenSpec cycle is covered by `/opsx:*`; FizzBee (our formal-verification spec language) stays separate until its OpenSpec contract is codified. These commands make the right workflow the path of least resistance rather than a discipline tax.

**Spec-vs-code drift detection**

The longer-term gap is detecting when code changes touch areas governed by openspec decisions without a corresponding spec update. Without this, model upgrades and parallel feature work compound drift silently. We need a mechanism — whether a CI check, a droid skill, or a diff-based prompt — that flags divergence between what the spec says and what the code does, so the team catches it at review time rather than weeks later.

**FizzBee CI**

FizzBee — our formal-verification spec language for distributed-system invariants — already covers the sync engine and the conflict-resolution state machine. The blocker is that the FizzBee container image must be imported into Adyen's internal container registry (Harbour) before CI can run verification on every MR. This requires a platform-team request.

> **Action:** Open a ticket with platform/infra to import the FizzBee container image (`ghcr.io/fizzbee-io/fizzbee`) into Harbour. Once available, wire it into the GitLab CI pipeline so verification runs on every push.

**CI quality gates**

GitLab CI is now running for the team, but not all quality gates are active yet. The full gate — lint, typecheck, audit, unit tests, integration tests, E2E — needs to be running on every MR before anything else in the roadmap is reliable.

### AWS POC Environment

> [Epic #26 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/26)

Before requesting a multi-environment Beta setup, we need to prove Peaky can actually run on AWS. This is a single-environment proof-of-concept — not a Beta, not production-ready, but a real deployment we can push code to and break things against.

The POC validates three things at once: the deploy pipeline works end-to-end from a GitLab MR merge, the versioning and build metadata flow surfaces correctly in the running app, and the architecture has no obvious security blockers before we invite real users.

**Deploy pipeline**

GitLab CI deploys to ECS Fargate (sync engine) + RDS PostgreSQL + S3 on every merge to `main`. No manual steps. The deployed version is visible in the app so anyone testing can report which build they are on.

**Initial security assessment**

Once the POC is deployed, run a first-pass security review with Davi T. or Bart H. The goal is not a full pentest — it is to identify and address the structural risks (IAM posture, network segmentation between ECS and RDS, public cloud first-mover exposure) before we open Beta to real users. Findings from this assessment feed directly into the formal Beta Security Review.

> This POC is the prerequisite for requesting additional environments for Beta. No POC, no Beta Environment request.

## Beta

<div><svg viewBox="0 0 700 360" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:700px;display:block;margin:0 auto;"><defs><marker id="a" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="10" markerHeight="7" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#64748b"/></marker></defs><style>.node { rx: 6; font-family: system-ui,-apple-system,sans-serif; font-size: 12px; } .txt { fill: currentColor; text-anchor: middle; dominant-baseline: middle; }</style><rect x="30" y="10" width="10" height="10" rx="2" fill="none" stroke="#22c55e" stroke-width="2"/><text x="56" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Shipped</text><rect x="140" y="10" width="10" height="10" rx="2" fill="none" stroke="#0ea5e9" stroke-width="2"/><text x="166" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Active</text><rect x="240" y="10" width="10" height="10" rx="2" fill="none" stroke="#f59e0b" stroke-width="2"/><text x="266" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">In Progress</text><rect x="370" y="10" width="10" height="10" rx="2" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="396" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Upcoming</text><rect x="30" y="40" width="140" height="34" class="node" fill="none" stroke="#22c55e" stroke-width="2"/><text x="100" y="60" class="txt">Okta Auth</text><rect x="30" y="150" width="140" height="34" class="node" fill="none" stroke="#22c55e" stroke-width="2"/><text x="100" y="170" class="txt">Sync Engine P1</text><rect x="30" y="260" width="140" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="100" y="280" class="txt">Bug Bash</text><rect x="230" y="40" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="310" y="60" class="txt">Beta Environment</text><rect x="230" y="130" width="160" height="34" class="node" fill="none" stroke="#f59e0b" stroke-width="2"/><text x="310" y="150" class="txt">Sync Templates</text><rect x="230" y="190" width="160" height="34" class="node" fill="none" stroke="#f59e0b" stroke-width="2"/><text x="310" y="210" class="txt">Sync Products</text><rect x="230" y="290" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="310" y="310" class="txt">Maturity Score</text><rect x="450" y="40" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="530" y="60" class="txt">Security Review</text><rect x="450" y="130" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="530" y="150" class="txt">CloudEvents</text><rect x="450" y="190" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="530" y="210" class="txt">Nitro Deprecation</text><rect x="450" y="260" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="530" y="280" class="txt">CI Test Automation</text><rect x="450" y="290" width="160" height="34" class="node" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="530" y="310" class="txt">Import Peak Season</text><line x1="170" y1="168" x2="230" y2="148" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/><line x1="170" y1="172" x2="230" y2="208" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/><line x1="390" y1="148" x2="450" y2="148" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/><line x1="390" y1="160" x2="450" y2="208" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/><line x1="390" y1="208" x2="450" y2="208" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/><line x1="390" y1="308" x2="450" y2="308" stroke="#64748b" stroke-width="1.5" marker-end="url(#a)"/></svg></div>

> **Active:** (none — Okta Authentication shipped in the OIDC rollout). **Blocked:** CloudEvents and Nitro Deprecation wait on Sync Templates and Sync Products.

### Okta authentication

> [Okta request](https://youtrack.is.adyen.com/issue/EAM-211/Peaky-Implementation) · [Epic #1 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/1)

Today Peaky only requires a shared password. We don't know who each reviewer is or who they act on behalf of.

Okta integration lets anyone at Adyen sign in with SSO and turns anonymous reviewers into identified ones. With identity, Peaky can attribute actions (who left this note, who closed this review, who signed off on this template) and lay the groundwork for fine-grained access control later.

??? example "For the PE / operator team — Okta setup checklist"

    1. Pull the OIDC app's `clientId` and `domain` from PE.
    2. Generate a private RSA key pair locally (`openssl genrsa -out private.pem 2048`) and hand the **public** half to PE so it is registered against the Okta app.
    3. Set `NUXT_OIDC_OKTA_DOMAIN`, `NUXT_OIDC_OKTA_CLIENT_ID`, `NUXT_OIDC_OKTA_PRIVATE_KEY`, and `NUXT_OIDC_SESSION_SECRET` in the deployment dashboard — OIDC turns on automatically.
    4. Smoke-test sign-in → access a protected page → sign-out on the preview deployment before promoting.
    5. Once green, retire the shared-password gate: the old `@plutotcool/nuxt-password-protect` module is no longer the source of truth. (See the OIDC rollout merge for the exact cutover commit.)

### Maturity score

> [Epic #2 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/2) · [MR !345 ↗](https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/345)

MR !345 ships the last user-facing capability planned for Beta. Peaky calculates one explainable maturity result per pinned Template Revision, shows how each pillar and question contributes, and turns unmet practices into a recoverable Handoff without changing Assessment evidence.

Template Authors can define and test five maturity stages. Assessors see live movement without point arithmetic. Review participants get separate Progress, Answered, and Maturity measures, plus exact evidence details and auditable Advisor overrides. Follow-ups adds a severity queue, exact what-if movement, ordered Markdown handoff, existing-ticket association, local close history, unresolved release, and reopen.

The remaining Beta work is operational. Environment rollout, security review, sync completion, and bug-bash hardening still gate opening Beta to real users.

### Sync Engine

> [Epic #3 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/3)

**Generic Sync Hardening**

Review synchronization currently transports only the Review header fields `subjectId`, `name`, and `status`. Exact ordered `templateRevisionIds` are stored locally but are absent from the outbox and have no selection-aware Go validation, inbound `review_template_selections` replay, or PostgreSQL Review domain projection. A fresh client therefore cannot reconstruct a complete Review from sync.

Generic Sync Hardening owns atomic Review creation transport, selection-aware validation and replay, PostgreSQL `reviews` and `review_template_selections` projection, stale-client cutover, and two-client coverage.

**Sync Templates**

Today the sync engine handles transported Review header fields, answers, and field-level changes, but not complete Review aggregates or their Revision selections. Templates still flow through the old Nitro XHR path.

Templates must sync through the engine just like reviews do — push/pull with HLC (hybrid logical clock, where the clock breaks ties when two writes happen at the same moment) conflict resolution, offline support, and live updates streamed to every open browser tab. This is a prerequisite for CloudEvents ingestion because templates define the shapes of the events we'll be ingesting, and it unblocks the Machine API's template endpoints.

!!! info "We anticipate templates to an area of live collaboration"
    We also need to think how to show recent changes to templates. The Recent Changes UI/UX is great, but we need to think how to retrofit for the templates part.

**Sync Products**

Product metadata like creation, name changes, and team assignments still lives in Nitro XHR. Teams and workspaces consume Reviews, but sync currently carries only their registered header and answer fields; product CRUD and metadata changes do not flow through it.

Similar to templates, Products should gain syncing capability, and concurrent writes resolution via HLC (hybrid logical clock). That said, it's worth verifying whether the product reviews are in fact being synced today.

??? note "Product catalog & metadata can change"
    Product information like roadmap, docs, etc. were experiments and can be dropped.

    At the time of writing, it is unclear who will create the product catalog so we need **(a)** boundary; **(b)** product alliance.

    This will likely be a commonly requested area to evolve once PMs know about it.

**CloudEvents Ingestion & Events UI**

Today Peaky's activity feed reads from local SQLite only. There is no server-side audit trail — if a client clears local data, their event history is gone. Team leads and advisors have no way to see cross-actor activity, and compliance teams have no durable evidence trail.

The Events UI however need to be smart with authorization to not pull all events back to every device for security and storage reasons. Right now, `draft()` events are intentionally excluded, along with any event that has `local: true` flag.

We need to decide whether the existing Peaky backend (which today serves the web client over its `peaky-api` namespace) grows to handle events, or we spin up a separate service for them. The former is more likely. There are real trade-offs, especially because Events need a serious data lifecycle & governance policy because of the amount of data *(e.g., it's a ledger)*.

??? note "Prerequisites before events can leave the device"

    - Replace free-text `errorMessage` on `*Failed.v1` events with a structured `{ code, kind }` allow-list — the current regex denylist leaks PII if events leave the device
    - Decide admin pull-events API shape (custom API vs Looker)

**Machine API: Nitro Deprecation**

Today the Peaky frontend depends on Nitro server routes (`server/`) to fetch and hydrate data — templates, products, teams, and workspace metadata. The sync engine handles registered Review fields but cannot reconstruct complete Reviews or their Revision selections, and the app still reaches back to Nitro for other data. Every XHR call to `server/` is a feature that won't work offline and won't survive when Nitro is removed.

We need a deep sweep of every endpoint the frontend calls — replacing each one with a sync-engine equivalent until the app is 100% backed by the Go API. Workspace bootstrapping is already done. The next candidates are templates (blocked until Sync Templates lands), products (blocked until Sync Products lands), and complete Review aggregate transport owned by Generic Sync Hardening.

### Import Peak Season 2026

> [Completed review sample](https://docs.google.com/document/d/1TsRb9dCayxWU8syA8NFUjNwiioMBNPWoCa6vJ7OAcC4/edit?tab=t.1oals5m7p5wv) · [Epic #4 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/4)

The current Peak Season process runs entirely in Google Docs — 10 questions and 142 checks across manual assessment. Teams doing Peak Season today have no way to evaluate Peaky against their real workflow because the template doesn't exist in the tool. Also, Google Docs format groups checks by maturity level which Peaky doesn't yet express.

We need to bring this workflow into Peaky in stages, each delivering value independently.

**Import the Peak Season template**

Import the current Peak Season Google Doc as a Peaky template (10 questions, 142 checks).

This requires temporarily lifting template size limits and depends on Maturity Score shipping first — the Google Doc groups checks by maturity level, and without maturity scoring the imported template loses structural parity with what teams use today.

**Field research**

Once the template is in Peaky, run structured feedback sessions with Beta testers, specially select Staff+ engineers & TLs.

The goal is to understand where Peaky's assessment UX diverges from the Google Docs workflow they know — which checks don't apply, what context is missing, how the Yes/No/N/A model maps to their current decision process.

**Import completed reviews**

After the template and experience are validated, we should import completed Peak Season Google Docs as historical reviews in Peaky.

This gives Beta testers a side-by-side view of their previous manual work inside the tool, making gaps and optimization opportunities visible.

**Trim Peak Season template**

Take the feedback from field research and imported reviews, then restructure the Peak Season template to fit Peaky's strengths — likely splitting it into multiple smaller templates with clearer boundaries, rebalancing questions vs checklists, and aligning the maturity model with Peaky's scoring system.

Here we need even closer collaboration with our stakeholders, beta testers, and leadership.

It's highly likely this will lead to a discussion to split Peak Season template into separate ones, e.g., On-call, Peak Season, etc.

### Beta Environment

> [AWS account request](https://youtrack.is.adyen.com/issue/OSCM-529/Public-Cloud-Request-Peaky) · [Epic #5 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/5)

Today only people with a Vercel preview link can access Peaky. Beta means a full-stack deployment with a custom domain and authentication, available to everyone internally — not just the team building it.

This is more than flipping a DNS record. The invisible plumbing is the bulk of the work.

**Custom domain & auth**

Peaky needs an Adyen DNS domain, TLS certificates, and Okta-wired authentication so anyone in tech can sign in without a shared password. The deployment spans S3 (attachments), ECS Fargate (sync engine), and RDS PostgreSQL (durable persistence), all reachable from the internal network for Launchpad integration.

**CI/CD & versioning**

Automated deployments from GitLab with proper staging → production promotion. Expose the deployed version to users so they know what build they're on and can report issues with a version reference. Multi-stage deployment (staging, canary, production) is more GA-scoped, but the CI/CD foundation must exist in Beta or every deploy is a manual operation.

**Shut down Vercel**

Once beta environment is deployed and functional, we should shut down Vercel to stop charges *(personal credit card right now)*.

### Security Review

> [Epic #6 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/6)

Peaky handles assessment data that feeds compliance and audit workflows — a breach or data leak would have regulatory consequences. We need both automated assurance and human expert validation before opening to Beta users.

**Automated threat modeling**

Generate a STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege) threat model that runs as a CI workflow on every push — enumerating trust boundaries, data flows, and potential threats across the local-first architecture (in-browser SQLite → sync engine → PostgreSQL). This catches regressions in the threat surface as the codebase evolves, without waiting for a manual review cycle.

**Formal security review**

The automated model is not enough. We need a formal review with our Security team (Davi T. or Bart H.) who can assess risks that static analysis misses — deployment topology, IAM posture, network segmentation between ECS and RDS, and the implications of being one of the first production workloads on public cloud. The learnings from this review lower the barrier for other teams following the same path.

### Bug Bash

> [Epic #7 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/7)

We keep finding bugs reactively — in sync edge cases, UI state drift, migration mismatches, and assessment flows. Without an intentional focused session, these bugs slip through to Beta users and compound into delivery delays.

A Beta Bug Bash brings together the core team and external participants *(Staff+ engineers, beta testers, other product teams)* for a structured session of exploratory testing. The goal is not just to find bugs, but to classify them by severity, fix the critical ones before opening Beta, and extract patterns — "this class of bug keeps happening because we don't have X" — that feed into preventive measures for GA.

### CI Test Automation

> [Epic #8 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/8)

Recent regressions in sync flows, assessment state transitions, and migration handling slipped through because integration and E2E tests only run locally. By the time a bug surfaces in a deployed preview, the author has already moved on and the context is cold.

We need integration tests and end-to-end tests running in GitLab CI on every MR — not as a post-merge afterthought. This does not require an AWS environment; the existing CI runners plus our Docker Compose stack and headless browser automation are sufficient. The goal is to catch the classes of bugs that unit tests cannot: race conditions in sync, edge cases when two writes tie on the hybrid logical clock, and full assessment-flow regressions.

> Running these in CI before Bug Bash means the Bug Bash focuses on *new* bugs, not known broken flows.

## GA

<div><svg viewBox="0 0 660 310" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:660px;display:block;margin:0 auto;"><style>.g { rx: 6; fill: none; font-family: system-ui,-apple-system,sans-serif; font-size: 12px; } .t { fill: currentColor; text-anchor: middle; dominant-baseline: middle; }</style><rect x="20" y="10" width="16" height="10" rx="2" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="48" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Depends on Beta</text><rect x="210" y="10" width="16" height="10" rx="2" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="238" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Standalone</text><rect x="20" y="50" width="190" height="44" class="g" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="115" y="72" class="t">Advisors UX</text><text x="115" y="88" class="t" font-size="9" fill="#94a3b8">↳ Maturity Score, CloudEvents</text><rect x="235" y="50" width="190" height="44" class="g" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="330" y="72" class="t">Authorization Engine</text><text x="330" y="88" class="t" font-size="9" fill="#94a3b8">↳ Sync Engine Phase 1</text><rect x="450" y="50" width="190" height="40" class="g" stroke="#64748b" stroke-width="1.5"/><text x="545" y="72" class="t">Design Consistency</text><rect x="20" y="150" width="190" height="44" class="g" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="115" y="172" class="t">Data Lifecycle</text><text x="115" y="188" class="t" font-size="9" fill="#94a3b8">↳ CloudEvents</text><rect x="235" y="150" width="190" height="44" class="g" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="330" y="172" class="t">Machine API: Headless</text><text x="330" y="188" class="t" font-size="9" fill="#94a3b8">↳ Nitro Deprecation</text><rect x="450" y="150" width="190" height="40" class="g" stroke="#64748b" stroke-width="1.5"/><text x="545" y="172" class="t">Client Data Integrity</text><rect x="235" y="220" width="190" height="40" class="g" stroke="#64748b" stroke-width="1.5"/><text x="330" y="242" class="t">Bug Bash</text></svg></div>

> **Dashed border** = depends on a Beta deliverable. All GA items are blocked until their Beta dependency ships.

### Data Lifecycle

> [Epic #9 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/9)

Today Peaky has no server-side data retention policy. Events, field versions, attachments, and audit logs accumulate indefinitely in the durable database (PostgreSQL) and the object store (S3). Without a lifecycle plan, storage cost grows unbounded and compliance teams have no guarantee that stale data is handled according to policy.

We need a tiered retention model that matches business value to storage cost and compliance requirements:

- **Hot** (0-90 days) — frequent access, full query support, available in the local-first client cache
- **Warm** (90 days-2 years) — infrequent access, query via admin APIs only, reduced indexing, still in primary storage
- **Cold/Archive** (2+ years) — compliance retention only, compressed and moved to cheaper storage, accessible only through explicit export requests

This applies to `events`, `field_versions`, `attachments`, and any audit trail data. The policy must be configurable per workspace and enforced by the storage layer itself (row-level partitioning plus scheduled cleanup) — not by application logic that a developer might forget to apply.

### Advisors UX

> [Epic #10 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/10)

Peaky today serves Assessors and Template Authors. The next persona is ^^Advisors^^ — Staff+ engineers who provide a second pair of eyes when a team or review owner requests their involvement.

We need to speak with Staff+ engineers to understand what they need, but the outlines are clear:

1. **Review queue** — view and act on reviews where their input was requested
2. **Advisor dashboard** — reviews they're involved in, gap summaries, per-question annotations
3. **Decision support** — preserve advisor rationale and evidence without assuming the unfinished Maturity Score design

### Authorization Engine

> [Epic #11 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/11)

Peaky will use Cedar — an open-source policy language from AWS — to express who can do what. Cedar combines relationship-based ("this person is on team X"), attribute-based ("the resource has tag Y"), and role-based ("they hold the admin role") access patterns over our entities, so a single policy can mix them.

Cedar runs on the backend (the sync engine) alongside a storage layer for the policies. The design must cover a policy authoring UI — a guided interface so customers define policies like "people outside team X can contribute to reviews for org Y" without writing raw Cedar.

Authorization results compile into cached access rules that sync down to the client's local database, so Peaky stays usable offline and never has to phone home for every protected operation.

### Release Pipeline

> [Epic #12 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/12)

Today releases are manual and quality gates are uneven — some run in pre-commit hooks, some only locally, and there's no unified path from an MR merge to a tagged deploy. A bad merge can reach preview environments before anyone notices.

We need a single release pipeline that runs lint, typecheck, audit, unit tests, integration tests, and E2E tests on every push to main, then tags the build and promotes it through staging to production. The pipeline is the only way to ship — no manual deploys, no skipping gates.

### Wide Events & Observability

> [Epic #13 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/13)

When something breaks in production today, we grep through logs and hope the relevant trace exists. Metrics tell us *that* something is slow but not *why*. The cognitive load of jumping between three disconnected signal types wastes incident response time.

Wide events are the primary telemetry model — one structured record per meaningful operation (a sync pull, an accepted push, a migration applied) that carries the full actor, resource, and outcome context. Traces, logs, and metrics can coexist where they add value, but they do not duplicate what wide events already capture. This is the difference between "CPU is high" and "user X's sync pull for review Y took 4s because the entitlement scan was unindexed".

### Formal Verification

> [Epic #14 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/14)

The sync engine and the local-first client handle concurrent writes, HLC conflicts (hybrid logical clocks: time-stamps that break ties even when two writes happen at the same moment), and cursor resets — distributed behaviors that are difficult to test exhaustively. A race condition that only surfaces after 10,000 operations is unlikely to be caught by unit or end-to-end tests.

We use FizzBee — our state-machine model checker — to express the critical protocols (sync handshake, engine bootstrap, conflict resolution) as formal specs and verify their invariants at compile time. The specs live next to the code in CI; the build fails when the implementation drifts from the spec. Expanded specs cover new failure domains as the engine evolves.

> **Prerequisite:** the FizzBee container image must be imported into Adyen's internal registry (Harbour) so CI can run verification without talking to public registries.

### Safe Schema Evolution

> [Epic #15 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/15)

PostgreSQL migrations today are reviewed by hand. A schema change that rewrites a 10-million-row table locks it for minutes, an unindexed foreign-key check degrades sync-pull latency, and a missing `IF NOT EXISTS` crashes the migration runner on retry. These mistakes reach production because the review process is human and fallible.

[Squawk](https://squawkhq.com/) — a deterministic linter for database migrations — runs in pre-commit and CI: it flags unsafe schema changes, missing indexes, and lock-heavy operations before they leave the branch. Squawk applies to both the server-side PostgreSQL migrations and the in-browser SQLite schema changes that ship with each Peaky release.

### Client Data Integrity

> [Epic #16 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/16)

SQLite, the local database Peaky stores inside the browser, lives in a private folder the browser sandboxes per origin (the "Origin Private File System"). If two tabs write to that folder at the same time, the database can silently corrupt — failures only surface as inexplicable sync errors days later, and there is no automatic recovery.

The multi-tab write race is a known failure domain we have already modelled in FizzBee; the formal verification test passes. What remains is implementing the actual guard: a small background coordinator shared across browser tabs (a SharedWorker) that all Peaky tabs route their writes through, so every write is serialised and the database never sees a concurrent second writer.

### Design Consistency

> [Epic #18 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/18)

Peaky has grown organically — components built feature by feature without a shared design pass. By the time GA ships, inconsistencies in spacing, color usage, and interaction patterns will be visible across pages built months apart.

This is a dedicated pass to audit every screen against the Peaky design system: semantic color tokens (no raw slate or gray values), NuxtUI v4 component conventions, the Public Sans type scale, and the three-depth surface model. The output is not a redesign — it is consistency, so the product looks intentional rather than assembled.

### Machine Integration

> more details to come · [Epic #17 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/17)

Launchpad API keys, APIs for pre-fill answers and reading review data so Launchpad can feed its Scorecard.

### Bug Bash

> [Epic #19 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/19)

By the time we reach GA, the codebase will have grown through months of parallel feature work — Cedar policies, data lifecycle jobs, headless APIs, and design system components. Experience from the Beta Bug Bash tells us that the bugs that hurt most are not the ones we find in unit tests, but the ones that surface when unfamiliar hands touch the product.

A GA Bug Bash is a wider-net session — cross-team, cross-discipline, with participants who have never used Peaky before. The focus shifts from finding individual bugs to validating that the product is *coherent*: do the onboarding flows make sense, do error states recover gracefully, do the permissions models behave as advertised.

> The output is a GA readiness scorecard: critical bugs fixed, known issues documented, and a set of "never again" checks that become part of the release checklist.

## Post-GA

<div><svg viewBox="0 0 660 230" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:660px;display:block;margin:0 auto;"><style>.p { rx: 6; fill: none; font-family: system-ui,-apple-system,sans-serif; font-size: 12px; } .t { fill: currentColor; text-anchor: middle; dominant-baseline: middle; }</style><rect x="20" y="10" width="16" height="10" rx="2" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="48" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Depends on GA</text><rect x="210" y="10" width="16" height="10" rx="2" fill="none" stroke="#64748b" stroke-width="1.5"/><text x="238" y="15" style="text-anchor:start;font-size:11px" dominant-baseline="middle" fill="currentColor">Standalone</text><rect x="20" y="50" width="190" height="40" class="p" stroke="#64748b" stroke-width="1.5"/><text x="115" y="72" class="t">Presence</text><rect x="235" y="50" width="190" height="40" class="p" stroke="#64748b" stroke-width="1.5"/><text x="330" y="72" class="t">Analytics</text><rect x="450" y="50" width="190" height="40" class="p" stroke="#64748b" stroke-width="1.5"/><text x="545" y="72" class="t">Learn</text><rect x="20" y="140" width="190" height="44" class="p" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3"/><text x="115" y="162" class="t">Machine Integration</text><text x="115" y="178" class="t" font-size="9" fill="#94a3b8">↳ Machine API: Headless</text><rect x="235" y="140" width="190" height="40" class="p" stroke="#64748b" stroke-width="1.5"/><text x="330" y="162" class="t">adyen-main Integration</text><rect x="450" y="140" width="190" height="40" class="p" stroke="#64748b" stroke-width="1.5"/><text x="545" y="162" class="t">Jira, Confluence &amp; Docs</text></svg></div>

> **Dashed border** = depends on a GA deliverable.

### Presence

> [Epic #20 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/20)

When multiple people are in the same review simultaneously, there is no awareness of it — no cursors, no active-section indicators, no "someone is editing this" signal. Collaborators overwrite each other's work without knowing it.

Presence surfaces real-time collaborator state inside a review: who is active, which section they are on, and live cursor positions where applicable. Depends on the sync engine being stable and the authorization model being in place so presence events are scoped correctly.

### Analytics

> [Epic #21 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/21)

Org-level readiness dashboards, readiness trending across assessment cycles, compliance report exports.

### Learn

> [Epic #22 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/22)

Customers can't see what questions and practices a template contains without creating a review and starting an assessment — too much friction just to browse.

We need a read-only discovery surface — browse questions and practices across templates, filter by template or practice area, discover leading practices, identify duplication across templates. No assessment required. Feeds into Improvement Plans by making practices discoverable before a review starts.

### adyen-main Integration

> [Epic #23 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/23)

Developer-facing tooling for working with Peaky from the terminal and from inside an LLM agent: a Peaky CLI for scripts and CI, plus the Peaky Agent Skills / MCP server (an LLM-friendly tool/API surface so an agent can drive Peaky as if it were a teammate).

### Jira / Confluence / Google Docs Integration

> [Epic #24 ↗](https://gitlab.is.adyen.com/groups/containers/rtf/-/epics/24)

Close the loop between reviews, improvement plans, and execution by integrating with the tools teams already live in.

- **Jira** — create and load tickets directly from improvement plans so review gaps flow into sprint backlogs and eventually surface in the Launchpad scorecard. This closes the full cycle: review → improvement plan → ticket → execution → scorecard.
- **Confluence** — upload and load team docs (runbooks, architecture pages, onboarding guides) so assessors can reference or attach relevant context without leaving Peaky.
- **Google Docs** — today we support markdown import/export; a native Google Docs integration would make this seamless, letting teams author practices and improvement notes in Docs and sync them back into Peaky without a manual export step.

## Triage

> Items here have no confident phase yet — file them under the bare `Product: Epic title` shape and revisit when a phase becomes obvious.

*(no items yet — the roadmap slash command lands here when it cannot confidently classify a row)*

## Deferred decisions

??? note "Backend and persistence"

    | ID     | Item                                         | Status                                                                                                                                           |
    | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
    | TD-010 | Pillar notes database schema                 | Tables designed but not fully created in the durable path                                                                                        |
    | TD-011 | Attachment storage                           | S3/MinIO path still needs real wiring                                                                                                            |
    | TD-027 | Attachment background upload and sync status | Keep metadata local-first, show `not synced` badge until remote upload finishes, hand off binary upload to background worker with presigned URLs |
    | TD-012 | Swagger / Redoc view for API                 | API documentation should be generated and exposed in the server                                                                                  |

??? note "Testing and quality"

    | ID      | Item                                | Status                                                                                                                                                                                                                                                                                                                                                                                                                       |
    | ------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | TD-024A | Checklist E2E selector refresh      | Broader checklist suite needs UI-selector updates to be fully re-enabled                                                                                                                                                                                                                                                                                                                                                     |
    | TD-012  | Pillar notes tests                  | Unit, component, and E2E coverage for notes/attachments still incomplete                                                                                                                                                                                                                                                                                                                                                     |
    | TD-034  | SQLite WASM migration test coverage | No test runs migrations through SQLocal in a real WASM environment. Detecting `SQLITE_SCHEMA` issues requires a browser environment or a Node.js WASM test runner. Until this exists, the `rtf-sqlite-reviewer` droid is the primary guard. Options: Vitest browser mode with `@sqlite.org/sqlite-wasm`, a Playwright fixture that bootstraps SQLocal in a headless tab, or a dedicated CI job using a WASM-capable Node runner. |

??? note "Architecture and code health"

    | ID     | Item                                             | Status                                                                                                                                                                                                                                                                                                           |
    | ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | TD-025 | Shared lifecycle-command registration composable | `watch`-inside-`onMounted` pattern works but should be replaced consistently across pages                                                                                                                                                                                                                        |
    | TD-035 | Command palette entity coverage parity           | Externally-sourced entities (Teams, Applications) have global `CommandSource` providers for cross-page discovery; Peaky-owned entities (Templates, Products) do not — they are invisible from other pages. Navigation gap tracked in issue #3; source parity deferred until the sync engine unifies data access. |

??? note "Template studio and review workflow"

    | ID     | Item                                   | Status                                                                                          |
    | ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
    | TD-016 | Checklist nudge system                 | Template authors get no guidance when too many yes/no questions should become checklists        |
    | TD-029 | Template and rules limits              | Max 3 templates, max 15 questions (soft 10), max 10 rules — no enforcement today                |
    | TD-033 | Control ID field on template questions | Compliance templates need to map questions to control IDs (e.g., CC6.1). Currently a workaround |

??? note "UX and experience backlog"

    | ID     | Item                                   | Why it matters                                                                |
    | ------ | -------------------------------------- | ----------------------------------------------------------------------------- |
    | TD-017 | Distraction-free survey mode           | Better focus and completion for long assessments                              |
    | TD-018 | Motion system with Motion.dev          | More coherent interaction feedback                                            |
    | TD-019 | Optimistic checklist toggles           | Faster-feeling assessment interactions                                        |
    | TD-020 | Survey keyboard shortcuts              | Better power-user flow                                                        |
    | TD-021 | Progress milestones and encouragement  | Better motivation on long-running assessments                                 |
    | TD-022 | Smart focus management                 | Better keyboard flow and modal ergonomics                                     |
    | TD-023 | Undo for destructive actions           | Reduces anxiety without more confirmation friction                            |
    | TD-028 | Richer pillar delta in session history | Session card should show per-pillar change context, not just overall progress |

## Undecided on

- [Tech] Pagination strategy
- [Tech] Decide whether to use external Jira then migrate to have a proper roadmap
- [Product] Google Gemini integration — summarize improvement plans, review gaps, and maturity scores into natural-language digests for advisors and team leads
