# Peaky

Operational readiness assessment tool. Teams run structured reviews before peak events and major releases to surface risks early and transfer institutional knowledge.

## Quick start

```bash
make dev     # one-time bootstrap: Node, Go tools, docs deps, Playwright
make watch   # full dev stack: PostgreSQL + Go API/SSE (Docker) + Nuxt
```

Opens on `http://localhost:3000` (Docker required for the backend services). `make` is the source of truth for every workflow — run `make help` for the full list.

## What it is

Peaky is a **local-first** web app. Every action saves to browser SQLite immediately; a background outbox syncs changes to the server. Reviews, assessments, and template drafts are all available offline.

Key concepts:

- **Products and Teams** — subjects that get reviewed
- **Templates** — versioned sets of pillars and questions
- **Reviews** — time-boxed assessment containers; one or more templates per review
- **Assessment** — the act of answering questions within a review

## Tech stack

| Layer        | Technology                                  |
| ------------ | ------------------------------------------- |
| Framework    | Nuxt 4, Vue 3, TypeScript                   |
| UI           | NuxtUI v4, Tailwind CSS v4                  |
| Local DB     | SQLite WASM + OPFS via SQLocal, Drizzle ORM |
| App server   | Nitro (Nuxt server routes)                  |
| Sync backend | Go (peaky-api + peaky-sse), PostgreSQL 17   |
| Testing      | Vitest, Playwright, go test, FizzBee        |

## Development

Run `make docs` to get our internal docs up and running for maintainer guidance - conventions, walkthroughs, decision log, etc.

Run `make mr` before opening a pull request.

### Automation

The agent harness under `.factory/` (rules, skills, commands, adversarial droids) is the [RTF Harness](https://containers.pages.is.adyen.internal/rtf/harness/), synced by agent-marketplace — run `direnv allow` once to bootstrap it.

CI runs on the shared [CI Automation](https://containers.pages.is.adyen.internal/ci-automation/) GitLab components (MR governance + scheduled changelog); see `.gitlab-ci.yml` and `.gitlab/ci-automation.yaml`.
