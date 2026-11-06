## Why

Documentation is scattered across 4 locations (`AGENTS.md`, `docs/`, `site/docs/`, `openspec/specs/`), causing duplication and drift. TD-014 already identified this: "Duplicate frontend docs in `docs/development/frontend/` and `site/docs/maintainers/development/`". LLM agents and human developers see different versions of the same content.

## What Changes

- **Delete `docs/` directory** - content merged into `site/docs/development/`
- **Slim down `AGENTS.md`** - becomes a one-liner redirect pointing to `site/docs/development/`
- **Flatten `site/docs/` structure** - rename `maintainers/` to `development/`, removing nested hierarchy
- **Update `site/zensical.toml`** - nav changes from `Maintainers > Development` to just `Development`
- **Update `openspec/config.yaml`** - pointer-style context referencing docs instead of inline content

## Capabilities

### New Capabilities

None - this is a reorganization, not new functionality.

### Modified Capabilities

- `documentation`: Update spec to reflect new single-source structure in `site/docs/`

## Impact

- `docs/` - deleted entirely
- `AGENTS.md` - reduced to redirect
- `site/docs/maintainers/` - renamed to `site/docs/development/`
- `site/zensical.toml` - nav restructure
- `openspec/config.yaml` - context rewritten with pointers
- `openspec/specs/documentation/spec.md` - updated requirements
- Resolves TD-014 (duplicate frontend docs)
