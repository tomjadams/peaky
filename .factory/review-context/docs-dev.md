# Maintainer Documentation Review Context

## Scope

Apply this context to Peaky maintainer material, primarily
`site/docs/development/**`, plus contributor-facing material in
`CONTRIBUTING.md`, `.gitlab/**/*.md`, `.factory/skills/merge-check/**/*.md`,
and `openspec/**/*.md`.

The reader is an engineer learning, changing, or operating Peaky. Technical
terms such as OPFS, HLC, Zod, Drizzle, CloudEvents, and `satisfies` are expected.

## Project invariants

- Peaky's maintainer voice uses first-person plural, direct imperatives, and
  conversational authority. It explains shared engineering reality without
  marketing language or academic distance.
- One paragraph carries one idea. Sequential concepts use numbered prose such
  as `**1/ Everything starts from a template**.`.
- Readers get permission to stop. A page owns one level of detail and links
  inline to companion walkthroughs rather than duplicating them.
- Structural explanations are visual when a diagram carries the model better:
  end-to-end write/read flow, one source of truth feeding generated artefacts,
  and file-touch order for an "Adding a new X" recipe.
- A claim about multiple compile-time guarantees enumerates them in
  `!!! tip "What the compiler enforces"`.
- Walkthroughs are authoritative when a short convention page and a walkthrough
  disagree.

## Project conventions

- Keep each H2 section scannable on one laptop screen.
- Use `> Optional` immediately before opt-in instructions.
- Put already-configured items in `!!! tip "Already configured"` with a short
  no-action-needed opener and a `*` list of configuration files.
- Use question-shaped admonition titles and the established Zensical/MkDocs
  forms: `!!! tip`, `!!! example`, `!!! warning`, and `!!! info`.
- Use `<div class="grid cards" markdown>` on index pages with three or more
  audience entry points.
- Alternate prose, diagrams, admonitions, and reference tables. Collapse tables
  longer than roughly ten rows behind `??? note "Full catalog"`.
- Mermaid labels escape `<` and `>` as `&lt;` and `&gt;`, use `\n` rather than
  `<br/>`, and quote labels containing punctuation that conflicts with shapes.
- Annotated code uses `// (1)!` and numbered notes only where the explanation is
  not obvious from the code.
- Run `make lint-docs` for documentation changes. Run `make docs-build` when
  navigation, rendering extensions, diagrams, or site configuration changes.

## Deterministic coverage

- `site/docs/development/**`: voice, section size, diagram placement, links,
  code annotations, and maintainer audience.
- Index and overview pages: card-grid entry points and a clear reading path.
- Architecture and data-flow pages: verify the documented flow against the
  local-first stack and relevant code before accepting it.
- Recipes: verify file-touch order and identify compile-time guardrails.
- Configuration guides: distinguish required action, optional action, and
  settings Peaky already provides.
- Long catalogs: preserve scanability through grouping and collapsible detail.

## References

- `README.md`
- `site/docs/development/index.md`
- `site/docs/development/walkthroughs/codebase/`
- `site/docs/development/walkthroughs/local-first/`
- `site/docs/development/decisions.md`
- `site/docs/development/testing.md`
- `Makefile`
