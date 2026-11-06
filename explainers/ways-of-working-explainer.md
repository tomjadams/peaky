# Built once, reuse anywhere — Peaky Ways of Working

> Peaky's ways of working — the product loop, the dev loop, CI governance, and the information architecture behind them — are largely portable: most of it is a copy away, the rest a rename or a port.

*Interactive explainer: `site/docs/explainers/ways-of-working-explainer.html` — single self-contained HTML (open in a browser; press `P` to present).*

## Slides

1. **Hero · Built once, reuse anywhere** — how Peaky plans, builds, reviews, and learns — and which parts other RTF products can reuse as-is
2. **01 · Product & ways of working · Product & ways of working** — one source of truth for direction, a fixed shape for every issue, and labels that organize themselves by machine
3. **01 · Product & ways of working · The product loop** — three stages — /discovery to /roadmap to /new-work — human + agent throughout, /new-work feeds the dev loop
4. **01 · Product & ways of working · Issue templates — context in** — eight templates cover every work type, like large open-source projects — steering agents to gather context upfront
5. **01 · Product & ways of working · Label taxonomy — five axes** — green axes are reusable today (MR automation, signal), cyan need a rename (domain, epic), red is Peaky-specific (project); domain labels are auto-applied by path-glob rules so the set never drifts
6. **02 · Dev workflow · Dev workflow** — one architecture for humans and agents, a loop from idea to retro, adversarial reviewers, and a deterministic floor that rises every cycle
7. **02 · Dev workflow · Agent infrastructure** — AGENTS.md points to other files for lazy loading; .factory/ is the rtf harness, managed by agent-marketplace — rules, skills, commands, and 14 adversarial droids
8. **02 · Dev workflow · Contracts & docs** — openspec/ captures every change as a contract; site/docs/ is the explanation layer — decisions.md, patterns, and the design system, same source for humans and agents
9. **02 · Dev workflow · The dev loop** — seven stages from /opsx:explore to /retro — /opsx:explore is human + agent, stages alternate between both/agent/human through plan/apply/refinement/merge-check, review & merge and /retro are human-only, merge-check as the gate
10. **02 · Dev workflow · Trust but verify** — balancing the speed of agents with software correctness — trust the loop to produce, verify with 14 adversarial reviewers plus an outcome verifier that checks acceptance criteria
11. **02 · Dev workflow · What is a droid?** — a droid is a plain markdown file you can run manually — no /merge-check needed to start; it's read-only (Read, Grep, Glob), reports findings graded by severity and ROI (BLOCK/MAJOR/WARN/INFO), and the main agent fixes only what you tell it to — preventing review fatigue
12. **02 · Dev workflow · Adversarial Reviewers** — 14 domain reviewers plus a 15th, rtf-outcome-verifier, that checks whether the diff actually delivered the linked issue's acceptance criteria
13. **02 · Dev workflow · Enrich project specific patterns** — each droid loads .factory/review-context/ before reviewing — shared invariants (local-first, HLC, untrusted client) then domain conventions (feature-first packages, non-blocking SSE, entitlements in SQL) — so the seven pillars are applied through project-specific knowledge, not in a vacuum
14. **02 · Dev workflow · The seven review pillars** — all 14 adversarial droids share one lens: correctness, data integrity, security, resilience, performance, idiomatic design, and maintainability — inspired by CodeRabbit
15. **02 · Dev workflow · Enforcing conventions, deterministically** — one governance comment per MR — a rendered table of checks (title, epic, size, labels) with pass/fail status and detail, updated in-place — when a check fails, the merge is blocked; also reported as JUnit results in the pipeline UI
16. **02 · Dev workflow · The deterministic floor** — two local gates — pre-commit (lint + format) and pre-push (tests + typecheck) — catch issues before they leave your machine
17. **02 · Dev workflow · The quality floor — linters** — eight static concerns, one rule-set per language — correctness, security, performance, and architecture guards among them
18. **02 · Dev workflow · The quality floor — tests prove** — 117 unit test files run in CI down to 2 fuzz/property files that still run only locally — a base that narrows as it climbs
19. **03 · Onboarding · Demo onboarding** — an interactive experience for everyone — new to the project, diving into new areas, or validating gaps with a quiz; gaps turn into issues; /explainer powers it as a tailored, hyper-personalized onboarding
20. **Appendix · Portable playbook · The portable playbook** — the direct answer to what other RTF products can reuse — each asset on one readiness spectrum, then how
21. **Appendix · Portable playbook · Reuse-readiness** — commands, adversarial reviewers, product loop, IA, changelog, and UI scaling sit at 88–100% ready; OpenSpec workflow is Peaky-specific; CI governance is the least portable at 60%
22. **Appendix · Portable playbook · How to reuse each one (1/2)** — commands, adversarial reviewers, product loop, IA, changelog automation, and UI scaling are all reusable today
23. **Appendix · Portable playbook · How to reuse each one (2/2)** — OpenSpec workflow is custom, advanced, and doesn't support monorepos — study it for ideas; the CI toolkit is being productized as a shared GitLab component
24. **Appendix · Label taxonomy · The labels** — 35 labels across 5 axes — MR automation (7, machine), signal (6, manual), domain (13, auto by path) — the reusable and adaptable axes
25. **Appendix · Label taxonomy · Adapt & specific** — epic (4 horizons, adapt to your roadmap) and project (5 labels, Peaky product names) — the axes that need personalization or are Peaky-specific

## Key facts

- roadmap.md is the single source of truth; the product loop runs /discovery → /roadmap → /new-work, keeping the backlog traceable without a perfect roadmap session
- eight GitLab issue templates (Feature, Bug, Epic, DX, Documentation, Infrastructure, Security, BugBash) steer agents to gather context upfront; the MR template forces agents to attach evidence for every quality gate — no box checked without command output or links
- CI Governance runs five blocking checks (mr_title, mr_append_issue_refs, mr_requires_epic, mr_auto_label, size) and reports as JUnit results in GitLab
- the dev loop has 7 stages: /opsx:explore, /opsx:plan, /opsx:apply, refinement, merge-check, review & merge, /retro
- 14 domain-specific adversarial reviewer droids plus a 15th, rtf-outcome-verifier, that checks acceptance criteria rather than code
- make mr runs 9 local checks (lint, lint-docs, typecheck, audit, test, go fmt+vet, golangci-lint, test:go, test:integration) before every MR; all but audit also run in CI
- the quality floor is 8 static-analysis concerns per language plus a 5-tier test pyramid: 117 unit test files and 11 integration files run in CI; 26 E2E/A11y specs are next; 2 fuzz/property files still run only locally; FizzBee formal verification sits at the apex, injected as invariants at /opsx:plan
- reuse-readiness assessed 14 Jul 2026: commands, adversarial reviewers, product loop, IA, changelog automation, and UI scaling are ready today (88–100%); OpenSpec workflow is Peaky-specific (40%); CI governance is the least portable (60%)

## Links

- [Label taxonomy discussion #42](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/42)

---

<!-- assembled by .factory/skills/explainer v1.5.1 · recipe=explainer · style=editorial · theme=dark · components=[ledger,filetree,dotplot,loop,chips,tiles,duo,pyramid,stepper] · source=explainers/_sources/ways-of-working.html · motion=motion-12.23.26.min.js -->
