## 1. Setup

- [x] 1.1 Create GitLab issue for documentation consolidation (`glab issue create`)

## 2. Restructure site/docs/

- [x] 2.1 Rename `site/docs/maintainers/` to `site/docs/development/`
- [x] 2.2 Move `site/docs/maintainers/development/*` up one level to `site/docs/development/`
- [x] 2.3 Update `site/zensical.toml` nav from "Maintainers > Development" to flat "Development"
- [x] 2.4 Update internal links in moved markdown files

## 3. Merge docs/ content

- [x] 3.1 Compare `docs/development/frontend/composables.md` with `site/docs/development/frontend.md` - merge any unique content
- [x] 3.2 Compare `docs/development/database.md` with `site/docs/development/backend.md` - ensure database content preserved
- [x] 3.3 Verify `docs/domain.md` matches `site/docs/development/domain.md` (already identical)
- [x] 3.4 Delete `docs/` directory

## 4. Update AGENTS.md

- [x] 4.1 Replace `AGENTS.md` content with one-liner redirect to `site/docs/development/`

## 5. Update openspec/config.yaml

- [x] 5.1 Rewrite `context` section with pointer-style references
- [x] 5.2 Update task rules to reference `site/docs/development/decisions.md` (was `site/docs/maintainers/decisions.md`)

## 6. Document the Approach

- [x] 6.1 Create `site/docs/development/llm-context.md` explaining:
  - Why we use `AGENTS.md` as a redirect (standard entry point for LLM tools)
  - Why pointer-style references in `openspec/config.yaml` (small prompts, single source of truth)
  - Why pointers save tokens and cost (LLMs fetch docs on-demand vs bloated system prompts)
  - How docs serve both humans and LLMs (no separate maintenance)
  - How domain specs (`openspec/specs/`) differ from dev guides (requirements vs patterns)
  - Why decisions.md matters (context for past choices, tech debt tracking)
- [x] 6.2 Add "LLM Context" to `site/zensical.toml` nav under Development section

## 7. Finalize

- [x] 7.1 Update `site/docs/development/decisions.md` with this change entry
- [x] 7.2 Mark TD-014 as resolved in decisions.md
- [x] 7.3 Run `make docs` to verify Zensical builds correctly
- [x] 7.4 Create GitLab MR with conventional commit title
