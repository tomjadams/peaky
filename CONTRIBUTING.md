# Contributing

## Getting started

```bash
pnpm install
make watch          # boots local dev environment on http://localhost:3000
```

Run `make help` for all available commands. Run `make mr` before opening a merge request — it runs the full quality gate locally.

## Workflow

All non-trivial changes go through the OpenSpec change cycle:

```text
/opsx-explore   → clarify requirements and trade-offs
/opsx-propose   → draft a change with design, specs, and tasks
/opsx-update    → reconcile existing planning artifacts when decisions change
/opsx-apply     → implement the tasks
/opsx-verify    → verify implementation matches the spec
pnpm exec openspec archive <change> → sync specs and close the change
```

For bug fixes and small improvements, a GitLab issue + MR without OpenSpec is fine. Factory slash commands are the canonical interface; their matching skills are generated equivalents for agents. The CLI is pinned as a project dependency, so use `pnpm exec openspec` rather than a global install. See `site/docs/development/ai.md` for the workflow and upgrade runbook.

## Opening a merge request

1. Create a GitLab issue first (use `/new-work` slash command, or pick a template from the new issue page)
2. Branch from `main`, name it `feat/<short-description>` or `fix/<short-description>`
3. MR title must follow conventional commits: `type(scope): description`
4. Reference the issue with `Closes #N` in the MR description
5. Run `make mr` locally before pushing

## Code review

The `/merge-check` Factory Droid command runs the adversarial reviewer suite. The routed roster is documented in `site/docs/development/ai.md`; the current reviewer families cover:

- `rtf-security-reviewer`: STRIDE-aware security analysis
- `rtf-go-reviewer`: Go correctness and memory efficiency
- `rtf-go-test-reviewer`: Go test quality and TDD discipline
- `rtf-vue-reviewer`: Vue 3 reactivity and component patterns
- `rtf-ui-reviewer`: Peaky design-system and NuxtUI usage
- `rtf-ux-reviewer`: browser-based interaction validation
- `rtf-typescript-reviewer`: TypeScript maintainability
- `rtf-sqlite-reviewer`: SQLite WASM / OPFS-specific issues
- `rtf-postgres-reviewer`: PostgreSQL schema safety
- `rtf-typescript-test-reviewer`: test quality and coverage gaps
- `rtf-python-reviewer`: CI automation Python maintainability
- `rtf-python-test-reviewer`: Python test quality
- `rtf-docs-dev-reviewer`: maintainer documentation quality
- `rtf-docs-product-reviewer`: user-facing documentation quality

`rtf-outcome-verifier` runs alongside the adversarial roster when an issue or OpenSpec change supplies acceptance criteria.

At least one human approval is required before merge.

## Further reading

- Architecture and decisions: `site/docs/development/`
- Maintainers playbook: `site/docs/development/contributing.md` (in progress — see [#40](https://gitlab.is.adyen.com/containers/rtf/peaky/-/issues/40))
- Roadmap: `site/docs/roadmap.md`
