# Developer Changelog

All development changes to Peaky are documented here: implementation detail, bug fixes, docs, etc. For customer-facing, see [Product Changes](../product_changelog.md).

<details>
<summary>How this changelog is generated</summary>

We follow [Conventional Commits](https://www.conventionalcommits.org/) and generate this file with [git-cliff](https://git-cliff.org/). Commits are grouped by type and sorted newest-first.

| Type prefix | Section | Description |
|-------------|---------|-------------|
| `feat` | **Features** | New functionality |
| `fix` | **Bug Fixes** | Corrections to existing behavior |
| `docs` | **Documentation** | Docs, explainer, or walkthrough changes |
| `refactor` | **Code Refactoring** | Structural changes without new features |
| `chore`, `ci`, `build`, `test`, `style`, `polish`, `perf`, `remove`, `enhance` | **Maintenance** | Tooling, dependencies, formatting, tests, polish |

Commits without a scope appear plain; commits with a scope show as `**scope:** message`.

Run `make changelog` locally to preview before pushing.

</details>

---

## [Unreleased]


### Bug Fixes

- **changelog:** skip changelog job commits from generated developer changelog ([#146](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/146))
- **openspec:** automate change-scoped traceability IDs ([#145](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/145))
- **openspec:** follow archived traceability path (#140, [#143](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/143), [#144](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/144))
- **dev:** prepare Nuxt across development lifecycle ([#135](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/135)) ([#136](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/136))
- **sync:** populate outbox fields and honor delete operations ([#91](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/91))
- **teams:** enforce profile-first local review creation ([#132](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/132))
- **dev:** pin pnpm to major 10 in make dev and bump minor version ([#126](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/126))
- **ci:** pin the ci-automation image by digest ([#109](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/109))
- **ci:** keep component before_script for the Vault token fetch ([#109](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/109))
- **frontend:** repair stale-client deployment recovery ([#119](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/119))


### Documentation

- **openspec:** archive Template Revision migration (#140, [#143](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/143))
- **openspec:** archive Template Rules removal ([#139](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/139))
- **openspec:** reorganize capability specifications ([#22](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/22))


### Features

- **template-revisions:** migrate Templates to stable identities and Revisions (#137, [#140](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/140), [#141](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/141), [#142](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/142))
- **template-studio:** remove unused template rules ([#138](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/138))


### Maintenance

- bump ci-automation components to 0.0.4 and drop the image pins ([#109](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/109))
- **ci:** bump ci-automation components to 0.0.3 ([#109](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/109))
- **openspec:** pin project workflow tooling (#19, [#913](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/913))
- **openspec:** archive sync-pull-scoping + sse-family-catalog-channels (#3, [#53](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/53), [#62](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/62), [#83](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/83), [#121](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/121))

## [v0.8.0] - 2026-07-30


### Bug Fixes

- **frontend:** recover stale clients and stabilize local dashboards ([#119](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/119))
- **build:** swap Go builder to golang-base and unblock curated deps ([#120](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/120))
- **docs:** remove unreachable harness link ([#112](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/112))
- **sync:** recover a collapsed sync batch size, and tie FizzBee specs to the code
- **verify:** make FizzBee specs valid and the verify target run them
- **agents:** sync RTF harness to restore AskUser droid  ([#105](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/105))
- **sync:** coalesce re-entrant triggerPush calls + e2e cold-start stability ([#100](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/100))
- **merge-check:** correct changelog exempt path for daily git-cliff MRs ([#81](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/81))
- **auth:** gate OIDC session fetch + restore dev actor picker ([#89](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/89))
- **ci:** do not label site changes as frontend / ui
- **app:** order local-db plugin ahead of DB-opening plugins ([#68](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/68))
- **changelog:** remove --unreleased flag so git-cliff includes tagged versions
- **ci:** allow scheduled pipelines in workflow rules, drop manual changelog trigger
- **ci:** make changelog publishing more resilient to git changes
- **ci:** adhere to git latest security risk enforcement; update UV deprecated TLS CERT flag
- **sse:** make SSE fan-out service operational
- **explainer:** align pre-workflow timeline
- **explainers:** add DESIGN.md and NuxtUI to pre-workflow era contrast
- **explainers:** reframe pre-workflow era around ad-hoc/vanilla OpenSpec 0.x, not a tech stack era
- **explainers:** honest about vanilla OpenSpec usage in early era vs current custom workflows
- **explainers:** correct pre-workflow era description — Applications/Templates era, not HLC/sync engine
- **data:** rename "Security & Compliance" to "Security" in mock seed data
- **local-db:** drop dead rejection handler in write gate fallback, cover failing tx
- **local-db:** single-writer gate for SQLite transactions (Client Data Integrity)
- **explainers:** remove inaccurate marketing claims from pre-commit and make mr copy
- **explainers:** honest framing of formal verification — not consistently in loop yet
- **explainers:** clarify FizzBee coverage is core domains, not full breadth
- **recent-changes:** pagination, trail cap, scroll dismiss, overridden badge
- **ci:** patch @vue/compiler-sfc for Node 24 ESM/CJS interop
- **vercel:** prevent stale HTML caching that caused 500s on redeploy
- **product-plan:** contributors endpoint for unsynced local-first products
- **product-plan:** make contributors endpoint defensive, add integration test
- **explainers:** fix WCAG AA contrast violations in text-faint token and component CSS
- apply CodeRabbit auto-fixes
- **ci:** dependency graph
- **api:** filter T_/TS_ legacy groups from groups endpoint
- **ui:** minor polish — plan heading, semantic article, rollup copy
- **ui:** disable Help and Settings nav icons until implemented


### Code Refactoring

- **explainer:** bring new explainer loops — product loop, dev loop, kit v1.4.3 ([#101](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/101))
- **merge-check:** overhaul Python scripts into a proper package (Closes [#81](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/81))
- **ci:** evolve to event-driven + pure features ahead of webhook/team setup (#60, [#63](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/63))
- **sync:** remove unused remoteCursor from push response [#55](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/55)
- **local-db:** use .catch for write-gate chain instead of two-callback .then
- **api:** establish evolutionary architecture using feature-first services


### Documentation

- publish ways-of-working explainer ([#73](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/73))
- **security:** audit the threat model against the code — 11 closed, not 20 (#115, [#116](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/116), [#117](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/117), [#118](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/118))
- **explainer:** demystify droids, add project-context stepper and rendered governance comment ([#107](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/107))
- **explainer:** highlight decisions.md and add reviewer pillars to ways-of-working ([#107](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/107))
- sync ways-of-working explainer and harness with current state ([#107](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/107))
- **gitlab:** add epic template and /epic command for consistency (#64, [#66](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/66))
- **explainer:** add ways-of-working explainer for team talk
- **factory:** teach glab skill to manage epics and associate issues with epics
- **sync:** formalize SSE family-catalog channel contract ([#62](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/62))
- **changelog:** add sync engine and recent changes features
- **explainer:** fix latest spacing and refinements for intro to sections
- **explainer:** add refinmenets to explainer for low powered models
- **ts-reviewer:** prioritize readability over clever code
- **explainer:** fix latest spacing and refinements for intro to sections
- **explainer:** add refinmenets to explainer for low powered models
- **explainers:** remove marketing hype, use plain educational English across all explainers
- add SECURITY.md and CONTRIBUTING.md
- **roadmap:** add epic links to all sections, add Design Consistency and Presence
- **roadmap:** add Now section — team workflows and AWS POC as priority-0
- **explainers:** add initial local-first arch overview
- **design:** clarify Recent Changes feed terminology and audit trail behavior
- **roadmap:** collapse sub-deliverable headings to reduce TOC depth
- **roadmap:** disambiguate ops excellence
- **roadmap:** remove duplicate Bug Bash heading in Beta section
- **roadmap:** restructure Beta/GA sections with inline SVG diagrams, add Bug Bash and CI Test Automation
- **roadmap:** add SVGs to show dependency and deliverables at high level
- **roadmap:** expand security review
- **roadmap:** expand beta environment
- **roadmap:** expand peak season 2026 current template
- **roadmap:** add explicit note about Nitro removal after sync-engine
- **roadmap:** break down sync engine beta in explicit deliverables
- **roadmap:** expand maturity score to include aggregate calc & rules manager removal
- **roadmap:** clean up intro; collapse Okta note
- **roadmap:** remove duplicates
- sync docs, explainers, and droids with services/internal refactor


### Features

- **docs:** publish ORR 2026 changelog ([#119](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/119))
- **templates:** support checklist markdown and seed ORR 2026 ([#119](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/119))
- **droids:** make adversarial reviewers general purpose, include project specific guidance, update references ([#104](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/104))
- **merge-check:** verifier-side guardrails G0-G8, temporarily disable CI gates ahead of v2 ([#99](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/99))
- **sync:** root-ref pull scoping + product pull root (#53, [#83](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/83))
- **explainer:** loop/pyramid/tags/iceberg showpiece components + filetree upgrades ([#93](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/93))
- **harness:** modularize the /explainer kit; keynote cut for merge-check ([#93](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/93))
- **merge-check:** human-acknowledged override + wall-clock perf fixes (P1-P5) ([#97](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/97))
- **tooling:** add /roadmap slash command and drop phase from the epic template ([#71](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/71)) ([#81](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/81))
- **auth:** cut over to Okta SSO and remove password gate ([#82](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/82)) (#8, [#8](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/8)5, [#8](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/8)6)
- **merge-check:** anti-forgery, incremental reviews, and CI enforcement ([#27](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/27)) ([#79](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/79)) ([#80](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/80))
- **ci:** auto-assign MR author as default assignee ([#72](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/72))
- **agents:** add /verify factory droid slash command (closes [#27](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/27)) ([#75](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/75)) (#8, [#76](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/76), [#77](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/77))
- **tooling:** add unified /new-work slash command and issue templates (#32, [#33](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/33))
- **sync:** family-catalog SSE channels ([#62](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/62)) (#51, [#52](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/52))
- **ci:** add auto-label MRs by changed file paths ([#35](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/35))
- **ci:** add linked-issue MR governance check ([#59](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/59))
- **ci:** add MR conventional-commit title check [#34](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/34)
- **explainers:** add DESIGN.md / NuxtUI / visual design system card, tighten walkthroughs card
- **explainers:** add dedicated make mr section, fix pre-workflow era callout tone, add Adyen retrofit context
- **explainers:** fix CodeRabbit vs security-reviewer accuracy, add interactive test pyramid, update hero copy
- **explainers:** add make mr pipeline visual, re-rank CI and release automation bars
- **explainers:** add walkthroughs card with honest format evolution note
- **explainers:** add backend architecture, test suite, Cedar auth, and Pulumi cards
- **explainers:** add engineering foundation explainer — AI SDLC maturity and what's next
- **tooling:** add GitLab issue templates and issue creation slash commands
- **demo:** seed demo product and team into local-first SQLite on first load
- **explainers:** add local-first architecture explainer ([#52](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/52))
- **explainers:** add STRIDE threat model interactive explainer ([#51](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/51))
- **explainers:** polish Present mode — stable scale, scroll-to-exit, zoom fix
- **explainers:** add Present mode — turn explainers into slide decks
- **system:** add unique Nuxt build ID until we have versioning and release pipeline in place
- **backend:** add sync-engine and SSE for live updates; add Docker infra, fuzzy & property-based testing
- **search:** use fuse.js fuzzy search for catalog queries


### Maintenance

- **deps:** expand Renovate coverage ([#45](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/45))
- cut test feedback with parallel shards ([#61](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/61))
- **dx:** rename services/testdata to services/seed ([#90](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/90))
- **dx:** switch .envrc to repo-scoped harness with file materialization
- restore MR governance by moving to ci-automation 0.0.2 ([#111](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/111))
- adopt CI Automation components, RTF Harness, and direnv bootstrap
- **ci:** stop tracking agent-marketplace commands ([#108](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/108))
- **agent-marketplace:** hand off skills/commands to marketplace registry ([#96](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/96))
- **lint:** fix pre-existing oxlint warnings after oxlint update ([#84](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/84))
- **agents:** remove unused files coming from old deployments ([#87](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/87))
- **codeowners:** enforce human approval from RTF with codeowners ([#41](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/41))
- **ci-automation:** allowlist support so daily housekeeping (changelog) are exempt from epic->issue->mr traceability ([#70](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/70))
- **automation:** add CI automation toolkit for governance checks [#36](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/36)
- **coderabbit:** add MR title and linked issue pre-merge checks [#34](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/34)
- **pipeline:** use golden image and python 3.12
- **changelog:** add changelog template and auto-link issue/MR from commit msg
- **dev:** add make changelog to autogenerate locally
- **coderabbit:** ignore changelog.md to avoid false positives
- add scheduled changelog generation with git-cliff ([#37](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/37))
- enable integration tests, postgres testcontainers, and more quality gates in CI
- vendor Public Sans fonts and disable external font fetches ([#21](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/21))
- remove check-gitlab-api probe that fails all pipelines
- add GitLab API reachability probe (#35 [#36](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/36) [#37](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/37) prerequisite)
- **dev:** fix labels for issue template
- **lint:** ban two-callback .then deterministically; sync ts-reviewer
- **dev:** fix labels for issue template
- add developer-facing CHANGELOG.md, rename labels, drop area: prefix
- **dev:** ignore vercel output folder
- **openspec:** upgrade skills to 1.3.1 and archive sync-engine change
- **dev:** add make clean-all target for full node_modules reset
- **dev:** include design system in explainer to make it reusable outside peaky
- remove FINDINGS.md
- cherry-pick component restoration from feat/backend-sync-engine
- cherry-pick T_ removal from feat/backend-sync-engine
- cherry-pick TS_ removal from feat/backend-sync-engine
- cherry-pick catalog cleanup + team page fixes from feat/backend-sync-engine
- **droids:** add go-reviewer, go-test-reviewer, postgres-reviewer; update vue-reviewer with local-first compliance

## [v0.7.0] - 2026-05-29


### Bug Fixes

- **ui:** add Products and Templates to command palette navigation
- **ci:** enforce vercel to use public npm whereas gitlab uses internal
- **ci:** explicit add .npmrc file for registry
- **ci:** downgrade pnpm to v10
- **ci:** downgrade node image to 2.0.2
- **ci:** use allowed NPM registry; take 2
- **ci:** use allowed NPM registry
- resolve all quality gate failures and upgrade dependencies
- **lint:** resolve all remaining oxlint warnings (0 warnings, 0 errors)
- **lint:** resolve all oxlint/eslint errors, enforce zero-error lint gate
- **lint:** resolve eslint errors blocking quality gate
- **local-db:** move tracking INSERT outside DDL transaction in applyMigration
- **assessment:** add 'View review' action to save success toast
- **teams:** team not shown in dashboard after creating review for catalog team ([#36](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/36))
- **docs:** add trailing-slash redirect for /docs/** paths on Vercel
- **docs:** roadmap file location
- **docs:** mermaid timeline dark mode rendering
- **survey:** restore markdown rendering, button visibility, and toggle routing ([#32](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/32))
- **storage:** use actual OPFS file size instead of navigator.storage.estimate ([#28](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/28))
- **events:** fall back to local events when remote returns 403 ([#24](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/24))


### Code Refactoring

- **auth:** add TSDoc to auth utilities, remove stale definePageMeta
- **droids:** split docs-reviewer into docs-dev-reviewer and docs-product-reviewer
- **openspec:** batch adversarial reviews into a single end-of-change section
- **tests:** reorganize into tests/unit/, update docs, remove outdated e2e ([#18](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/18))


### Documentation

- **openspec:** add sequence diagram, clean open questions
- **openspec:** sync artifacts with final implementation
- **openspec:** update MR link to [!9](https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/9)
- **openspec:** mark prerequisite tasks as complete
- **openspec:** link issue [#4](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/4) and MR [!8](https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/8) in tasks
- **openspec:** add oidc-okta-auth change proposal
- **roadmap:** fix mermaid syntax in sync engine
- **roadmap:** add TD-035 command palette entity coverage parity
- **roadmap:** add agreed must have for beta
- **roadmap:** update decision on sync engine
- **openspec:** fix stale doc references in config.yaml context
- **openspec:** remove proposal.md from custom workflow as its no longer reviewed in SDLC
- **typescript:** add local-first data access pattern and anti-patterns
- **openspec:** tidy up specs — archive, rename, merge, and update testing ([#42](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/42))
- **openspec:** archive improvement plan and low severity risk drop
- **ts-reviewer:** add browser performance anti-patterns section
- **dev:** document context-mode
- **dev:** breakdown UI styling into branding and patterns for agents
- **dev:** update visual-design with latest UI implementation
- add design.md off peaky branding and tokens
- **roadmap:** add atlassian, google, and refine post-ga
- **ai:** document browser automation and expand skills roster
- **changelog:** add applications view screenshot
- **ai:** document AI harness for new maintainers
- **site:** fix landing page links
- **changelog:** tigthen explanations and visuals
- **roadmap:** add more info on launchpad and sync engine wss
- **dev:** revamp development docs — delete stale files, rewrite walkthroughs, add product walkthroughs
- **nav:** make roadmap visible
- **roadmap:** declutter and add key areas before GA, post GA
- **roadmap:** reorganize around key areas, declutter delivered items
- **changelog:** add May 2026 changelog entries for Events and System page ([#21](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/21))


### Features

- **auth:** redesign login page
- **auth:** implement OIDC foundation with Okta via private_key_jwt
- **dev:** draft gitlab bare minimum ci pipeline
- upgrade oxlint rules to error, enforce zero warnings in lint ([#44](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/44))
- **reviews:** introduce improvement plans at review, team and product levels
- **schema:** remove low severity level from template questions ([#39](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/39))
- **dev:** add context-mode to reduce token usage
- **dev:** introduce formal verification with FizzBee ([#30](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/30))
- **hooks:** selective pre-push testing with vitest related ([#29](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/29))
- migrate orr:* localStorage keys to peaky:* prefix W3C convention ([#19](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/19))
- **events:** complete events and system experience ([#14](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/14))


### Maintenance

- **survey:** rollback survey as on main
- **ci:** test push-to-main automation trigger
- **ci:** verify push-to-main sync
- **ci:** test push-to-main automation
- **ci:** Move to CI version of our golden image, since previous repo has been migrated and naming has changed
- **dev:** bump pnpm to v11
- remove context-mode dev dependency, mcp config, and factory hooks
- **skills:** add peaky-screenshots skill for docs screenshots
- **droids:** add sqlite-reviewer + move localStorage/SSR check to ts-reviewer
- **dev:** remove graphify, add context-mode commands, clean up dev bootstrap
- **dev:** remove typecheck from pre-push as `make mr` superseeds it
- **ui:** improve readiness flow visual gaps
- **ai:** migrate browser automation from playwright-cli to agent-browser
- **dev:** upgrade models from adversarial reviewers
- **dev:** allow claude to create PRs in GHA during dev due to token limits
- **openspec:** archive May 2026 completed changes and sync main specs ([#22](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/22))

## [v0.6.0] - 2026-04-30


### Bug Fixes

- **tests:** fix flaky reviews-contract integration test, remove Firefox from Playwright
- **pwa:** auto-detect stale COOP headers and hard-reload on cache clear
- resolve typecheck errors blocking push


### Code Refactoring

- **tests:** enforce unit test principles — remove dead tests, fix I/O leaks, stabilize timers
- **tests:** audit unit tests — remove dead code, fix stale assertions, add missing coverage
- **tests:** decouple integration tests from hardcoded demo data


### Documentation

- update changelog with user guide redesign
- enrich power user subpages — examples, cURL, schemas, contextual commands
- rewrite user guide for newcomers, power users, and template authors ([#11](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/11))
- update decision log, clean up bloat, add customer-facing changelog
- **tests:** codify unit test principles from audit findings


### Features

- **security:** add nuxt-security, Zod validation, local-first security hardening ([#9](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/9))
- **tests:** add sync plane handler tests and fix stale template IDs
- **events:** CloudEvents v1.0.2 alignment + E2E template import/export tests


### Maintenance

- **events:** rename domain_events table to events ([#13](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/13))
- **dev:** ignore swap files
- update AGENTS.md, OpenSpec schema, and templates for security and automation
- add make mr quality gate, fix Husky hooks, resolve pre-existing lint errors ([#7](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/7))

## [v0.5.0] - 2026-03-31


### Bug Fixes

- **events:** remove TeamCreated.v1 — teams are fully externally managed
- **events:** remove TeamUpdated.v1 and TeamDeleted.v1 — teams are externally managed
- **schemas:** action column, larger domain badges, source filter
- **breadcrumbs:** add /schemas prefix and detail page breadcrumb
- **product:** nuxt autoimport so summary cards work again
- **types:** remove spurious second arg from buildReviewSummary call
- **seed:** correct actor IDs and enrich seed review events
- **auth:** remove prerender on / so password gate covers landing page
- **auth:** decouple password gate from build-time env vars
- **breadcrumbs:** show product name instead of UUID in breadcrumb trail
- **templates:** remove templateId from EventCreationOptions (not a known field)
- **templates:** make publish local-first with stable template_ UUIDs
- **templates:** publish newly created draft templates correctly
- **notes:** show 'Notes saved' on every successful save, not just the first
- **sync:** correct relative import path after useSyncClient moved to sync/
- **perf:** lazy loading, intro page, caching, and cold start optimizations
- **local-first:** restore compatibility helpers without reintroducing remote review submission
- local then remote; id generation compatibility with CI
- **local-first:** suppress stale review errors when local data resolves
- creation and updates should happen locally (products, reviews)
- **local-first:** hydrate review progress from browser state
- **pwa:** restore NuxtPwaManifest and remove SW unregister code
- **build:** clear stale HTTP cache missing CORP headers
- **build:** serve self-destructing sw.js to replace stale service worker
- **build:** unregister stale service workers on app startup
- **build:** disable PWA module — incompatible with COEP require-corp
- **build:** disable navigateFallback since HTML is no longer precached
- **build:** stop precaching JS/CSS to fix COEP header stripping
- **build:** resolve OPFS proxy 404 and PWA reload loop
- **build:** stop chrome pwa reload loop
- **build:** try plan B with require-corp and vercel headers
- **build:** one last try with coep
- **build:** allow CI to build a sqlite3 WASM for the env
- **build:** enforce coep globally on all routes
- **build:** prevent worker to pre-cache docs, failing COEP
- **build:** add pwa and service worker under COOP/COEP policies
- **style:** remove nuxt favicon
- **dev:** explicit route headers to fix vercel deployment
- **app:** stabilize hydration and isolate runtime
- **catalog:** bundle mirrored directory snapshot for deploy
- **catalog:** race condition in serverless env
- **deploy:** bundle sqlite migrations for runtime access
- **teams:** use real ldap identities in seeded reviews
- **teams:** o(1) for search, add directory test, remove old alert
- **dev:** remove redundant barrel export and add sqlocal dependency
- **local-db:** address ts-reviewer findings and type issues
- **e2e:** update teams-flow test to expect navigation to assessment page
- **local-db:** serve sqlite-wasm files from public directory
- **local-db:** correct sqlite-wasm API usage and local-first product display
- **local-db:** ensure debug helpers work after DB is open
- **local-db:** fix double id column bug and add debug helpers
- ReviewHeader status prop — use ReviewStatus type to include archived
- close command palette before executing command run()
- pillar tab percentages now update immediately from local question state
- save-with-comment modal working — session tracking and modal flow
- all review sub-endpoints now serve product reviews
- template sidebar blank on product assessments
- populate template data in product reviews, add questions endpoint
- **index:** add template to resolve Vue warning for redirect page
- **assessment:** add error handling to save, remove redundant progress calls and dead code
- **sidebar:** use review templates instead of global store for inactive templates
- **assessment:** wire save button to API, compute progress from actual answers, update pillar stats on save
- **assessment:** remove dead progressStore and add readback assertions to PUT progress tests
- **templates:** sync all overlapping fields in PUT summary update
- **teams:** use UInputMenu for in-place team search
- **wizard:** disambiguate step progression from pagination
- **wizard:** clarify max templates message
- **wizard:** resolve validation error persistence and serverless navigation
- **ui:** replace raw button elements with UButton in assessment/survey
- **ui:** persist team filters across navigation with useState


### Code Refactoring

- **events:** address all adversarial reviewer findings
- **events:** serve schemas at /schemas/ from Nuxt public dir
- **events:** migrate to versioned type strings and new source enum
- **ids:** remove generateId wrapper and public key helpers
- **ids:** drop prefixed IDs, use plain UUIDv7 everywhere
- **composables:** place loose composables in role-encoding subdirs
- **composables:** consolidate under composables/ with role-encoding subdirectories
- **services:** extract entity mutation classes and local-first service layer
- **applications:** pivot dashboard to team-owned read-only view
- **config:** clean up COEP/PWA workaround leftovers
- **teams:** align demo catalog data and advisor terminology
- **admin:** simplify events flow and local-first docs
- **dev:** defensive programming and exhaustive checks ala Rust
- **local-first:** align migrations and domain boundaries
- **local-db:** add helpers and reduce boilerplate in composables
- **local-db:** migrate to Drizzle ORM with shared schemas
- extract review components, simplify sort, fix scroll pattern
- last-pass cleanup from reviewer findings
- **ProductTable:** clean up module-level helpers, fix chip padding, add hover state
- product details page — people in header, resources table, clean cards
- unify review API — remove all baseUrl plumbing
- extract shared components, reduce duplication and component bloat
- **models:** remove unused Review helpers and PillarsResponse
- **ui:** improve table slot type-safety


### Documentation

- **walkthroughs:** update codebase walkthrough to reflect current state
- **roadmap:** record review history decisions
- **architecture:** clarify ambiguous directories in directory tour
- **roadmap:** document intentional remote bridges and PowerSync implementation guide
- **local-first:** add trade-offs and failure domains
- **local-first:** capture deployment workarounds
- **local-first:** explain browser migrations and seeding
- fix remaining ux writing issues, and add what we decided not to go forward
- **walkthrough:** initial writing pass to make it cohesive and digestible
- **local-first:** restore the current architecture mental model
- **spec:** complete architecture and walkthrough tasks
- tighten local-first implementation guidance
- clarify local-first contract naming
- refine local-first collaboration guidance
- clarify local-first foundation artifacts
- **site:** increase markdown table text size
- initial local-first architecture proposal, walkthrough, and design for backend
- add save modal screenshot + update linear-walkthrough skill v2
- move screenshots to assets/images/, add dark mode variants
- add screenshots to products walkthrough, rework pages section
- add products architecture walkthrough + linear-walkthrough skill
- **openspec:** sync design.md to final implementation
- update decisions.md for internal-products — correct implemented entry, add TD-025
- **spec:** initial spec for product
- add in-memory persistence decision with architecture diagram
- add in-memory persistence section to README
- update domain model and decisions for teams-pivot
- **spec:** align teams/reviews specs with implemented UX
- **tasks:** mark teams-pivot implementation checklist complete
- **spec:** normalize to organization/org/orgs
- **tasks:** add test-reviewer subagent that opus missed
- **spec:** add MR number
- **spec:** create and associate issue
- **spec:** initial pivot to introduce teams view
- **spec:** use new adversarial review subagents for all new tasks


### Features

- **admin:** link to event schemas + update demo event type strings
- **schemas:** full event example and CTA back link
- **config:** generic NUXT_PUBLIC_BASE_URL with dev-aware default
- **schemas:** move event schema browser to /schemas with DataTable
- **events:** add CloudEvents schema catalog with JSON Schema generation
- **events:** user event feed, area filter, enriched details, GDPR erasure
- **auth:** add password gate via nuxt-password-protect
- **theme:** default to dark mode
- **home:** make overview the default landing page
- **reviews:** align team review flow parity and info panel naming
- **build:** re-enable PWA with COEP-safe config
- **dev:** upload attachments and notes local-first
- **local-first:** ground scoped reviews in a mirrored catalog directory
- **header:** add persistent local-first banner
- **admin:** surface lifecycle events for operators
- **local-first:** complete Stage 1 foundation with DI repositories
- internal products — full lifecycle with reviews, assessment, and session history
- add UTooltip to PM and EL abbreviations in product header
- Save button as header CTA + improved session note UX
- product review details + save-with-comment modal + session history
- seed products and product-reviews with realistic data
- **products:** complete product creation, details, review wizard, and shared assessment
- **assessment:** add answer and progress persistence endpoints
- **applications:** wire mutable in-memory store for bulk endpoints
- **templates:** wire mutable in-memory store for POST/PUT/publish endpoints
- **teams:** replace team dropdown with searchable select menu
- **wizard:** make max templates warning dismissible
- **reviews:** add inline rename capability
- **api:** add org detail and preferences endpoints
- **ui:** ship teams dashboard and team-first review flows
- **teams:** add org/team data model and review APIs


### Maintenance

- **e2e:** prefix all dynamic resource names with [E2E] for cleanup traceability
- **e2e:** fix heading selector and breadcrumb navigation
- **e2e:** update ID patterns from prefixed IDs to UUIDs
- **product:** increase origin badge size
- **products:** drop legacy remote-only submit methods from useProductCreation
- **products:** add heading for key info, align left for consistency
- **local-first:** cover team review direct-url details load
- add e2e local write test to prevent regression
- **product:** add LDAP hint for consistency
- **openspec:** finalize local-first foundation follow-ups
- remove Clear-Site-Data header after cache flush
- **dev:** comment on why COOP and COEP headers
- **teams:** stop blocking dashboard on local hydration
- **migrations:** generate embedded sqlite content from sql
- **ui:** quick fix on archive button for products
- **shared:** add explicit example on canonical ID and public key
- remove debug logging from E2E test
- **openspec:** require reviewer tasks in task template
- **dev:** oxlint minor fixes
- **dev:** introduce oxlint, keep eslint for vue/nuxt specific gaps
- **dev:** keep essential openspec commands/skills only
- **dev:** remove windsurf openspec integration
- **dev:** setup openspec claude code
- **retro:** tigthen adversarial reviews as many non-blocking findings were ignored
- **retro:** create rules to prevent certain models ignore token, testing, and adversarial review findings
- **openspec:** archive teams-pivot and internal-products changes
- **openspec:** sync spec, design, and tasks to match final implementation
- **openspec:** sync tasks.md — mark 50/52 completed, document drift
- **e2e:** add product flow regression test
- initial implementation, untested and unreviewed
- **validation:** user testing synthesis for bugfixes milestone — 0 assertions (all validated in prior milestones)
- **validation:** scrutiny synthesis for bugfixes milestone — 2/2 features passed
- **validation:** user testing synthesis for misc-fixes milestone — 0 assertions (internal fixes only)
- **validation:** scrutiny synthesis for misc-fixes milestone — all 2 features reviewed (pass)
- **validation:** user testing synthesis for assessment milestone — all 9 assertions passed
- **validation:** scrutiny synthesis for assessment milestone — all validators passed, 1 feature reviewed (pass)
- **validation:** user testing synthesis for core-stores milestone — all 11 assertions passed
- **validation:** scrutiny synthesis for core-stores milestone
- **teams:** add validation edge case tests for wizard
- **api:** add coverage for review rename endpoints
- **api:** add org/team endpoint coverage
- **teams:** add teams flow and wizard coverage
- **dev:** prevent UBadge semantic usage issue
- **dev:** balanced color system with extension colors for ui-review
- **dev:** add tldr in agents as last optimization made it worse
- **dev:** fix subagents output format following factory official docs for reviewers
- **dev:** switch adversarial reviewers to kimi2.5 to reduce cost
- **dev:** new glab skill for consistency

## [v0.4.0] - 2026-02-28


### Bug Fixes

- **ui:** leading practices should appear after why this matters for yes-no questions
- **ui:** empty checklist item should not count towards min 3
- **ui:** overflow auto conflict with flex container preventing scrolling
- **template-studio:** include current ruleSets in markdown export
- **template-studio:** use $fetch instead of useFetch in saveTemplate
- **template-studio:** wrap VueFlow in ClientOnly to prevent hydration mismatch
- **template-studio:** normalize rule name and fix command palette
- **template-studio:** prevent drag icon overlapping question text
- **template-studio:** prevent false dirty state on page load
- **factory:** ux-reviewer droid now loads skill for test scenarios
- **factory:** use glm-5 model for ux-reviewer droid
- **template-studio:** improve sidebar and header UX
- **template-studio:** sync rule sets added from command palette
- **template-studio:** use computed for canvas commands with proper lifecycle
- **template-studio:** organize all nodes including questions
- **template-studio:** use correct NuxtUI tooltip positioning syntax
- **template-studio:** position control tooltips on the left
- **template-studio:** hide multi-rule warning for Critical severity
- **template-studio:** increase threshold for Read more button
- **template-studio:** show more question text without tooltip
- **template-studio:** remove inner textarea focus ring
- **template-studio:** ensure only one focus color shows
- **template-studio:** position character count above textarea
- **template-studio:** clarify team review action label
- **template-studio:** reorganize condition card layout
- **template-studio:** align condition row content at top
- **template-studio:** align risk level at top with question slug
- **template-studio:** align risk level labels in rule set conditions
- **template-studio:** improve RuleSetNode visual hierarchy and UX
- **template-studio:** clarify rule trigger explanation
- **template-studio:** increase default zoom and fix controls alignment
- **template-studio:** remove confusing edge handles, fix markdown display
- **template-studio:** major UX improvements to Rules Editor
- **template-studio:** resolve critical polish issues in Rules Editor
- **template-studio:** resolve critical UX issues in Rules Editor
- **dev:** switch to firefox as chrome keeps crashing; disable memory hog features
- **template-studio:** fix logic dropdown, action dropdown, and add tooltip
- **template-studio:** use Vue Flow updateNode API for drag-drop
- **template-studio:** fix drag-to-ruleset and action dropdown
- **template-studio:** comprehensive UX improvements for rules canvas
- **template-studio:** critical UX improvements for rules canvas
- **factory:** restore openspec-archive-change to original
- **factory:** ux-reviewer droid now loads skill for test scenarios
- **factory:** use glm-5 model for ux-reviewer droid
- **template-studio:** increase timeout for question auto-expand to match animation
- **template-studio:** properly auto-focus and auto-expand for better UX
- **template-studio:** auto-expand newly created questions
- **template-studio:** auto-focus new checklist item input on Enter
- make E2E tests pass by fixing selectors and skipping incomplete tests
- **template-studio:** improve checklist validation UX in guided mode
- **template-studio:** improve checklist question guided mode UX
- **styles:** prevent layout shift when scrollbar appears
- **assessment:** remove expand/collapse transition for instant response
- **assessment:** improve checklist expand/collapse UX
- **assessment:** align buttons and fix toggle in checklist questions
- **assessment:** normalize text size on all questions
- **test:** rewrite failing e2e tests and eliminate v-html XSS risk
- **test:** update FilterBar accessibility tests to match actual tablist/tab roles
- **spec:** re-archive
- **ui:** resolve border visibility and drag interaction issues in dark mode
- **ui:** prevent background bleed-through on borders
- **test:** update command palette E2E test to focus on global escape handler
- **ui:** resolve input focus, command palette, and dark mode regressions
- **dev:** subagent droid format via tasktool
- **ui:** table header contrast; remove leftover home page
- **dev:** remove deprecated husk env lines
- **template-studio:** use navigationsidebar, not custom
- **types:** resolve type errors for pre-push hook compliance
- **ui:** clicking expanded question header now toggles collapse
- **ui:** template studio UX improvements and validation
- **ui:** template studio esc evt propagation
- **ui:** template side selector text wrapping
- make text readable but not "screaming"
- thead contrast so its visible
- revert UTable to bespoke tailwind due to number of styling bugs
- tab content bi-directional data model; table contrast
- improve table text contrast in both light and dark modes
- visible table row hover with bg-accented, add search placeholders
- restore table row hover, add SearchInput default placeholder
- **css:** restore table row hover via global tbody default
- **css:** restore table row dividers and container border for UTable
- **ux:** add cursor-pointer and outline variant to filter buttons
- adopt UTextarea, USelectMenu, UFormField per MR review
- **css:** dark mode priority
- rename UButtonGroup to UFieldGroup (NuxtUI v4 migration)
- UCollapsible #content slot, USlideover close, softer light mode
- **branding:** use destructure defaults instead of withDefaults
- **branding:** fix PeakyLogo props and suppress PWA dev warnings
- **branding:** center chart and add ceiling room in PWA icons
- **branding:** add breathing room to PWA icons
- **branding:** add Peaky text to PWA icons
- wrap relative dates in ClientOnly to prevent hydration mismatch
- **site:** broken link to development after renaming
- a11y hidden input with aria-label
- nuxtUI needs UApp to inject context providers
- **deps:** resolve @vueuse/core version conflict with pnpm override
- **a11y:** fix color contrast violations across home and templates pages
- **a11y:** exclude color-contrast rule consistently across all pages
- **a11y:** fix accessibility violations detected by axe-core
- **tests:** fix flaky command palette visual test selector
- **tests:** resolve pre-existing e2e test failures
- **openspec:** update task rule to not include openspec artifacts in MR description
- **command-palette:** resolve lifecycle command race condition during navigation
- **ui:** remove assessments standalone page as we won't implement it now
- **ui:** use lucide icons only
- **assessment:** update command palette survey mode to navigate to survey page
- use new decision log for the website
- **dev:** remove glab cli leftover from openspec proposal


### Code Refactoring

- **factory:** remove lesson-capture, retro handles capture inline
- **factory:** replace retro with lesson-capture skill
- **templates:** apply efficiency reviewer suggestions
- **templates:** move text processing from utils/ to templates/
- **template-studio:** use UFormField for comment validation
- **template-studio:** rename action types for clarity
- **template-studio:** redesign condition card layout
- **template-studio:** clean up RuleSetNode with computed properties
- **template-studio:** split editors into separate pages with prominent mode toggle
- **factory:** remove lesson-capture, retro handles capture inline
- **factory:** replace retro with lesson-capture skill
- **factory:** integrate lesson capture into archive, remove retro
- remove unimplemented question types (text, multiple-choice)
- use ES2024+ immutable array methods in useTemplateEditor
- **pages:** update all remaining pages with explicit domain imports
- **pages:** use useAssessment() orchestrator in assessment and survey pages
- **applications:** migrate to app/applications/ domain
- **ui:** migrate to semantic color system and fix E2E tests
- **template-studio:** improve button styling and toggle layout
- **template-studio:** polish toggle and add context for practices/resources
- **template-studio:** improve Guided Mode UX
- embed red, green, refactor
- remove actions column since it's better suited in app details
- move UTooltip styling to global app.config defaults
- move UTable styling to global app.config defaults
- extract shared avatar utils to reduce duplication
- migrate DataTable to UTable (NuxtUI) per MR review
- useTemplateRef, data-driven answer toggles per MR review
- replace bespoke Tailwind components with NuxtUI primitives
- **ui:** use utooltip for consistency and a11y now that nuxtui works
- **assessment:** use NuxtUI UFileUpload with Zod validation
- **a11y:** add semantic color tokens for WCAG-compliant text colors
- **navigation:** migrate to named routes and navigateTo for idiomatic Nuxt navigation
- **navigation:** migrate useRouter().push() to navigateTo()
- use Lucide panel icons for sidebar toggle
- **ui:** move toggle button inside template selector sidebar


### Documentation

- **openspec:** sync design and specs with implementation reality
- **decisions:** add template-studio-rules-mode decisions
- **screenshots:** add rules mode dark mode screenshot for MR
- **openspec:** add MR number to tasks
- **spec:** add guardrails before merging after extensive manual testing for bugs and inconsistencies
- **openspec:** add deferred action for Vue component refactoring
- **vue:** add Vue/Nuxt conventions documentation
- **spec:** archive
- add E2E test tech debt and update checklist question docs
- add UX/Experience Deferred section to decision log
- **spec:** archive composables architecture refactor
- create typescript conventions
- **openspec:** mark completed tasks through Phases 2-13
- update architecture documentation for domain-organized composables
- **openspec:** accurately mark completed tasks in Phases 1-4
- **openspec:** mark completed tasks in Phases 0-7
- **openspec:** add TARGETS.md creation and mark Vite config as complete
- **openspec:** restructure tasks with TDD approach and ES2024+ modernization
- **spec:** add initial proposal for architecture change
- **spec:** remove duplicate due to git conflict handling
- **dev:** enrich MR template after our experience
- **dev:** move mr to gitlab template to enrich it
- **spec:** archive and sync delta across the specs
- archive spec for guided mode in template studio
- **spec:** archive ai workflow updates
- **decision:** fact check, correct, small line editing
- **spec:** mr created for ai workflow qa
- **decisions:** add Factory docs reference for warm cache rationale in Token Budget section
- **dev:** improve AI workflow quality with front-loaded artifacts
- **decision:** add skills and subagents reference; markdown fmt
- **spec:** initial proposal for Vergil UX issues and more
- **spec:** document DataTable bespoke Tailwind deviation from UTable
- **spec:** token of appreciation for raising the bar
- **spec:** complete tasks in the first pass
- **spec:** artifacts revised with opus 4.6 now ;)
- **spec:** new refactor to use nuxtui to replace bespoke components
- add component communication diagram and remove mkdocs reference
- fix mermaid styling using MkDocs Material CSS variables
- fix mermaid theme - use violet fill in themeVariables
- make mermaid nodes vibrant with brand violet fill
- modernize mermaid diagrams with clean minimal style
- simplify llm-context diagram for readability
- style mermaid diagrams to match ORR brand
- fix table formatting in decisions.md manual entry section
- add diagrams to development documentation
- consolidate documentation sources of truth
- **spec:** consolidate 4 sources of truth to keep one for both human and agents
- **spec:** bulk archive pillar notes, pillar attachment, and visual regression test removal
- **spec:** sync drift from implementation
- **openspec:** mark all tasks complete
- update frontend testing guide for a11y tests
- **openspec:** mark tasks complete
- update testing documentation for a11y tests
- **spec:** archive pillar notes and attachment proposal
- **openspec:** clean up tasks and reference decision log for deferred items
- **decisions:** add pillar-notes-attachments decisions and deferred items
- **openspec:** update tasks with implementation progress
- **spec:** proposal for adding notes and attachments to pillars in reviews
- **openspec:** add MR description format rules with tables
- update decision log and mark tasks complete
- **openspec:** add design, specs, and tasks artifacts for command palette fix
- **openspec:** mark refactor-router-navigation tasks complete
- **routing:** promote named routes as preferred navigation pattern
- add navigation patterns guidance and tech debt entry
- **spec:** archive documentation website; creates documentation spec
- update decision log with Lucide icon approach
- **openspec:** update artifacts to reflect Lucide icon approach
- **openspec:** sync artifacts with implementation
- **openspec:** improve task rules for GitLab workflow
- **spec:** proposal to improve toggle template selector


### Features

- **factory:** add retro skill with interactive Socratic style
- **factory:** add three efficiency reviewer droids
- **template-studio:** add comprehensive edge case tests
- **template-studio:** add edge case tests for hard-won lessons
- **template-studio:** complete all deferred tasks - validation, E2E tests, refactoring
- **factory:** add vue-flow skill with production-tested patterns
- **factory:** significantly improve ux-reviewer with lessons from template-studio-rules-mode
- **template-studio:** add grouped conditions for rules with multiple trigger logic
- **template-studio:** add delete button to rule set node header
- **template-studio:** add canvas controls to command palette
- **template-studio:** add Organize button to zoom controls
- **template-studio:** custom zoom controls with NuxtUI tooltips
- **template-studio:** warn when question used in multiple rules
- **template-studio:** add Read more/Show less for long question text
- **template-studio:** add validation UI for comment character limit
- **template-studio:** add optional comment for rule actions
- **template-studio:** add severity dot to rule set conditions
- **template-studio:** show risk level on question cards in sidebar
- **template-studio:** use Vue Flow native drag for question-to-ruleset
- **template-studio:** enable drag between rule sets and from canvas
- **ux:** add comprehensive UX review system with cognitive load testing
- **template-studio:** implement rules canvas and CRUD (tasks 5-8)
- **template-studio:** add rules mode foundation (tasks 0-4)
- **factory:** add retro skill with interactive Socratic style
- **factory:** add three efficiency reviewer droids
- **factory:** add vue-flow skill with production-tested patterns
- **factory:** significantly improve ux-reviewer with lessons from template-studio-rules-mode
- **template-studio:** add Enter key support and helper text for checklist items
- **assessment:** add survey mode support for checklist questions
- **assessment:** make question text clickable to expand/collapse
- **assessment:** add collapse/expand accordion for checklist questions
- **assessment:** add per-item N/A functionality and fix checklist alignment
- **assessment:** implement checklist question type
- **openspec:** enhance design and tasks templates based on last retro
- **templates:** create domain modules with ES2024+ features
- **assessment:** create domain modules (Phases 3-7 foundation)
- **ui:** migrate UI utilities to app/ui/ with ES2024+ modernization
- **openspec:** add /retro command for change retrospectives
- **openspec:** add peaky-workflow schema with Peaky-specific guidance
- **template-studio:** add Guided Mode for question editing
- **template-studio:** add Guided Mode for question editing
- **template-studio:** cue for adding new question; create question on focus out
- **deploy:** serve Zensical docs at /docs/* on Vercel
- **branding:** rebrand from ORR to Peaky
- **docs:** modernize mermaid diagrams with Neo look and dark mode support
- **docs:** fix mermaid diagram styling with custom theme
- **assessment:** show one pillar at a time with tab navigation
- **TemplateSelector:** add bidirectional pillar sync
- **PillarSection:** integrate notes section with tooltip and description
- **components:** add pillar notes UI components
- **composables:** add usePillarNotes for notes state management
- **api:** add pillar notes and attachments API endpoints
- **models:** add TypeScript types for pillar notes and attachments
- **survey:** add exit survey mode command palette action


### Maintenance

- sync vue.md from main
- **openspec:** archive template-studio-rules-mode
- **template-studio:** revert sidebar to crisp white
- **template-studio:** tone down sidebar brightness in light mode
- **template-studio:** tone down light mode canvas brightness
- **template-studio:** increase spacing between condition cards
- **template-studio:** add red focus ring when comment over limit
- **template-studio:** add font-mono to character count
- **template-studio:** compact condition card layout
- **template-studio:** red hover on remove button for destructive action
- **template-studio:** increase contrast on section labels
- **template-studio:** uppercase section labels with tracking
- **template-studio:** use teal for rule header
- **template-studio:** refine RuleSetNode visual design
- **template-studio:** add visual hierarchy to RuleSetNode
- **template-studio:** remove drag icon from condition cards
- **template-studio:** use dashed border for risk level badge
- **template-studio:** consistent badge shape across question cards
- **template-studio:** tone down risk level badge colors
- **template-studio:** improve risk level badge visibility
- **template-studio:** make condition items more prominent
- **dev:** stick to .ux-artifacts folder to make it deterministic
- ignore playwright new tree mapping files
- leftover no longer needed
- add resilient E2E tests for checklist questions
- add comprehensive tests for checklist question type
- **template-studio:** improve messaging
- add second checklist question to evaluate UX
- **dev:** migrated targets to typescript conventions
- remove old composables folder and finalize cleanup
- add domain tests for applications and assessment modules (Phases 2-7)
- configure Vite for ES2024+ build target
- fix type checks
- **tooling:** improve ui-review subagent to catch visual polish issues
- **dev:** ignore playwright-cli assets during adversarial reviews
- **ui:** enhance pillar tabs hover feedback and fix border issues
- **ui:** fix command palette footer border radius
- **dev:** get rid of now redundant skill nuxtui-visual-design
- **dev:** enforce markdown fmt
- **dev:** make subagent more flexiblel with natural language
- **dev:** add ui review critique subagent
- archive nuxtui refactor and template studio ux fixes
- **ui:** keep it simple with `done`
- **dev:** ensure we use nuxt-ui skill at design artifact
- **dev:** install nuxt-ui skill to reduce token usage and improve human maintenance
- **dev:** add playwright-cli skill to reduce token burn rate
- **dev:** explicitly ignore /docs from NuxtRouter to allow both to coexist
- **dev:** add vercel preset and try disabling fallback nav to test deep linking
- **dev:** move npmrc to user settings to allow ephemeral deployments during alpha
- **openspec:** archive consolidate-docs change and sync specs
- enable applications API integration test
- add test:integration script and make target
- **vitest:** split unit and integration test configs
- ignore .nuxtrc (auto-generated by test utils)
- fix a11y tests and add tech debt tracking
- update Makefile to use a11y tests instead of visual
- add accessibility testing with axe-core
- remove visual regression tests and update playwright config
- update visual regression baselines for pillar notes UI
- **openspec:** archive decouple-test-paths and sync specs
- update leftover task and openspec testing section
- **testing:** decouple fast and slow test paths
- **openspec:** add decouple-test-paths change and missing visual baselines
- **openspec:** mark all archived tasks as complete
- **openspec:** archive command palette changes and sync specs
- **openspec:** archive refactor-router-navigation change
- **openspec:** add fix-survey-mode-command-palette change artifacts
- **e2e:** add command palette survey mode navigation tests
- **openspec:** archive refactor-template-selector-toggle change
- **visual:** add collapsed state baseline and update tasks
- **visual:** add collapsed state test for assessment page
- **visual:** add assessment page baseline and update tasks
- **visual:** add assessment page regression test
- remove unrelated home page visual baselines
- remove unrelated visual baselines from branch
- update visual baseline for home page dark mode
- remove unused sidebar-panel.svg asset
- **dev:** enforce mrs to use conventional message
- add visual regression baselines and ignore test artifacts

## [v0.3.0] - 2026-01-29


### Bug Fixes

- **dev:** use newer decision log docs
- **website:** centering typewriter and image zooming
- **ui:** make `Assess` static and center the conent
- **dev:** downgrade chokidar to correct file descriptor bug on macos
- **dev:** use python3.12 where uv is installed globally
- enable answer toggle visual tests with correct survey URL
- playwright config for CI and survey mode fixed width
- command palette in-page actions and add comprehensive E2E tests
- Survey Mode now navigates to dedicated survey page
- **template-studio:** Resources section fills space without overflow
- **template-studio:** remove h-full from Resources section
- **template-studio:** merge markdown import/export into single command
- **preview:** progress shouldn't be sticky as we scroll
- **ui:** global dark mode primary color and interactive preview buttons
- **ui:** question metadata areas now look and feel connected with a "electric signal" visual cue
- **ui:** edit icon low contrast in dark mode
- **ui:** improve dark mode contrast for primary blue text
- **ui:** use sortablejs to correct leading practices and resources to be rearranged
- **ui:** cave in and use sortablejs to make drag-n-drop to work
- **dev:** explicitly remove .nuxt folder to avoid too many open files in vite despite the ignores
- **dev:** explicitly remove .nuxt folder to avoid too many open files in vite despite the ignores


### Code Refactoring

- **dev:** migrate to openspec 1.0
- **template-studio:** full fidelity preview with assessment layout
- **assessment:** extract shared components for reuse
- **template-studio:** improve metadata visual cues and preview interaction
- **template-studio:** improve metadata section visual design
- **ui:** decrease pillar editing height for tiptap to use less space
- **ui:** migrate to tiptap editor to handle rich text and address micro interactions bugs


### Documentation

- document deferred tasks for website and docs
- **website:** add step 1 with template studio
- **website:** fix landing page and workflow
- **openspec:** add documentation site proposal
- add centralized decision log with tech debt tracking
- update visual regression spec - desktop only, mark tasks complete
- add testing guide with visual regression instructions
- update E2E tests spec to reflect implementation
- clarify template vs review terminology in E2E tests
- **spec:** archive spec reorg by domain
- **spec:** sync design.md and tasks.md with implementation
- **spec:** add Future Considerations section for versioning
- **spec:** add shared assessment components refactor plan
- **spec:** mark completed UX refinement tasks
- **spec:** update layout spec with UX refinement requirements
- **spec:** update backend spec for HTML storage and validation
- **spec:** update data model and APIs to reflect HTML storage
- **spec:** update design doc with UX refinement decisions
- **spec:** add iteration 2 UX refinements for template studio
- **spec:** add templates and template studio big feature


### Features

- add documentation site with Zensical (MkDocs)
- add documentation site build commands
- add in-page command palette actions for review details page
- **template-studio:** add command palette integration
- **template-studio:** integrate NA reason modal in preview mode
- **template-studio:** add edit functionality for resources
- **template-studio:** add delete pillar button with confirmation
- **template-studio:** improve content positioning and animations
- **template-studio:** add drag-and-drop reordering for resources
- **template-studio:** add list formatting to Why This Matters
- **template-studio:** add character limits with visual warnings
- **template-studio:** add tooltips to metadata sections
- **template-studio:** improve delete icons visibility
- **ui:** initial template studio fixes


### Maintenance

- **openspec:** improve schema to use glab CLI
- **dev:** ignore playwright local test results
- fallback to user uv
- update .gitignore for documentation site
- **openspec:** archive add-e2e-tests and add-composable-tests
- complete component tasks to avoid drift
- **openspec:** archive add-component-tests
- add visual regression testing with Playwright
- add E2E tests with Playwright
- make component tests less brittle
- add unit tests for common UI components
- add unit tests for composables
- **openspec:** reorganize specs by domain
- **openspec:** add proposal to reorganize specs by domain
- **openspec:** archive add-template-studio change
- cleanup leftover; ignore .png onwards
- **ui:** use more precise wording to describe Qs metadata

## [v0.2.0] - 2026-01-16


### Bug Fixes

- **data:** ensure sibling review templates share same advisors
- **ui:** enforce max 2 advisors rule in aggregation
- **ui:** filter out 0% sessions from history
- **ui:** fix tooltip clipping in history section
- **ui:** prevent tooltip clipping on timeline
- **ui:** fix tooltip flickering on timeline hover
- **ui:** improve timeline visualization
- **ui:** command palette dark mode contrast made white text disappear
- **dev:** remove eslint formatting due to prettier conflict
- **template:** template selector was hiding inactive templates
- survey mode toggling and breadcrumbs path construction with middleware
- **lint:** add explicit missing types


### Code Refactoring

- remove 0% progress delta session from mock data
- remove 0% sessions from mock data
- **ui:** redesign expanded session card to highlight changes
- **ui:** show 'Team updated' instead of individual names
- **ui:** make application details page consistent


### Documentation

- **spec:** archive review history lineage
- **spec:** archive review details page
- remove SRE references, clarify max 2 advisors
- **domain:** add max 2 advisors business rule
- **domain:** add UX principle for team over individual attribution
- **spec:** add session creation policy to history-lineage spec
- **spec:** add history/lineage feature proposal
- **spec:** archive app details refactoring
- **spec:** archive pwa
- **spec:** refactor application details for consistent look and feel plus future growth
- **spec:** add review details page specification
- **spec:** add pwa support to enable chrome apps
- **spec:** archive command palette functionality
- **spec:** archive app details functionality
- **spec:** document decision to build as nuxt plugin for exactly once over normal vue component
- **spec:** add initial spec for command palette standalone component
- **spec:** initial idea for application view flow
- **spec:** archive home view change for layout spec


### Features

- **ui:** implement history/lineage visualization
- **ui:** add review details page
- **ui:** make it a progressive web app
- **ui:** add toggle dark mode action
- **ui:** implement command palette to ease navigation and productivity actions
- **applications:** add app details view to connect from home


### Maintenance

- **dev:** install browser skill to use puppetteer for DOM inspection, JS browser debug and screenshot
- leftover from lint and file cache
- **dev:** setup droid workflows for openspec
- remove leftover standalone assessment page

## [v0.1.0] - 2026-01-13


### Bug Fixes

- **ui:** helpful links list using incorrect prop
- **ui:** regression on z-index stacking for tooltips
- **ui:** tooltip had lower z-index than template selector; simplified tooltip with pure CSS
- **ui:** pillar name contrast in dark mode
- **ui:** collapse/expand button missed tooltip and had slate bg leftover
- **ui:** correct color theme config as tailwindcss v4 relies on CSS, not cfg
- **dev:** prettier conflict with windsurf and CLI
- **ui:** remove unnecessary backdrop blury
- **ui:** remove duplicate header
- **ui:** locality of behaviour where sidebar transition should stay in default layout


### Code Refactoring

- prefer explicit models pattern over one-file for interfaces
- enforce BEM as maintainability had a dip as we grew
- **ui:** correct contrast ratio and mimic real-life button pressing for survey mode
- **ui:** fix profile icon to gender neutral
- **ui:** move expand/collapse sidebar at bars intersection for a better UX
- **ui:** improve collapse/expand experience by making it larger, more subtle (away from content)
- **ui:** implement spec except Husky and color leftovers
- **ui:** theming spec to start fixing inconsistencies
- **ui:** extend progress bar margin for visual hierarchy


### Documentation

- re-organize frontend as composables grew faster
- **spec:** enrich home view spec with details on command palette and backend
- **spec:** answer initial open questions before overhauling design
- update rough roadmap
- **spec:** archive n/a ux functionality spec
- **spec:** archive backend exploration with nitro and TS
- **spec:** initial proposal for a not-applicable button UX
- **spec:** archive backend specification implementation changes
- **spec:** initial spec to explore how Nitro works with Nuxt
- **spec:** archive theming specification changes
- **spec:** add layout purpose
- fix leftover mentioning our previous GoTH stack
- **spec:** update theming tasks after out-of-band changes
- **spec:** ensure we use VueUse instead of reinveinting the wheel with event propagation, keystroke trap, etc.
- **spec:** archive more info sidebar change
- **spec:** update asks to take accessibility and UX into account
- include workload and orr template in this month roadmap
- update rough roadmap
- **spec:** archive layout spec
- update preferences to ensure semantic tags, plus aria


### Features

- **ui:** implement home view and incorporate spec deviations & enhancements.
- initial spec for home dashboard view
- **ui:** add not-applicable for questions
- **api:** complete testing setup and initial tasks
- **backend:** create contrived backend in TS to serve mock data; adjust UI and fixes
- **ui:** polish it as a floating element, UX improvements for collapsing, and BEM to ease maintenance
- **ui:** spec to add newly designed template selector
- **ui:** initial more information implementation using NuxtIcon and composable
- **ui:** add more information initial spec
- **ui:** applies spec with initial layout structure + dummy content
- **ui:** create layout structure proposal


### Maintenance

- **ui:** adjust Search and Filter margin to make it more connected with the table (less loose).
- **ui:** improve contrast for N/A reasoning options with border length and color
- **dev:** enforce eslint to run on save
- remove leftover from go templ on web css
- add eslint and apply Vue and Nuxt practices
- verify husky pre-commit hook
- apply new prettier consistent config
- apply prettier on all files
- remove leftover component from Nuxt template
- **dev:** add openspec windsurf integration
- **dev:** add dev target to install pnpm
- refactor goth stack to nuxt


