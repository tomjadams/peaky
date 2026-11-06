## Context

Documentation currently lives in 4 places:
- `AGENTS.md` - LLM-focused guidance (144 lines)
- `docs/` - Original developer docs (stale, empty decisions/)
- `site/docs/` - Zensical source (most current)
- `openspec/specs/` - Domain requirements

This causes duplication (e.g., testing patterns in 3 places) and drift (e.g., `docs/development/frontend/composables.md` missing router navigation patterns that `site/docs/` has). TD-014 already flagged this.

## Goals / Non-Goals

**Goals:**
- Single source of truth for all documentation in `site/docs/`
- LLM agents and humans read the same content
- Eliminate duplication and maintenance burden
- Pointer-style config so LLMs fetch docs on-demand

**Non-Goals:**
- Changing documentation content itself (just reorganizing)
- Modifying OpenSpec specs structure (they stay as requirements)
- Creating new documentation tooling

## Decisions

### 1. Canonical location: `site/docs/`

**Decision**: All documentation lives in `site/docs/`, not a new `docs/` at root.

**Rationale**: Zensical currently requires `docs_dir` to be a subdirectory of the config file location. Moving `zensical.toml` to root would require restructuring. Keeping docs in `site/docs/` works with Zensical today.

**Alternative considered**: Move `zensical.toml` to root with `docs/` beside it. Rejected because it spreads site config across root (zensical.toml, overrides/) mixing concerns.

### 2. Flatten "maintainers" to "development"

**Decision**: Rename `site/docs/maintainers/` to `site/docs/development/` and flatten the hierarchy.

**Rationale**: 
- "Maintainers" is really just "developers"
- Current path `maintainers/development/testing.md` has redundant nesting
- Flat structure: `development/testing.md` is cleaner

### 3. AGENTS.md becomes a redirect

**Decision**: Keep `AGENTS.md` as a one-liner pointing to `site/docs/development/`.

**Rationale**: Many LLM tools (Cursor, Copilot) look for `AGENTS.md` as a standard entry point. A redirect ensures they find the canonical docs without maintaining duplicate content.

**Alternative considered**: Delete `AGENTS.md` entirely. Rejected because external tools may not know to look in `site/docs/`.

### 4. Pointer-style config.yaml

**Decision**: Replace inline documentation in `openspec/config.yaml` with pointers.

**Example**:
```yaml
context: |
  Tech stack: Nuxt v4, Vue3, Tailwind CSS v4, Zod
  
  For coding conventions: read site/docs/development/frontend.md
  For testing patterns: read site/docs/development/testing.md
  For past decisions: read site/docs/development/decisions.md
  For domain specs: read openspec/specs/{domain}/spec.md
```

**Rationale**: 
- Keeps prompt size small
- LLMs fetch docs when needed
- Single source - no sync issues

## Risks / Trade-offs

**[Risk] LLMs may not follow pointers** → Mitigation: Keep essential quick-reference (make commands, tech stack) inline. Pointers for detailed patterns.

**[Risk] Breaking existing references to `docs/`** → Mitigation: User confirmed backward compatibility not required.

**[Trade-off] Deeper path for docs** → `site/docs/development/testing.md` vs `docs/development/testing.md`. Accepted because Zensical integration is more valuable than shorter paths.
