# Roster discovery — droids declare their own routing

> This file uses `MC="uv run --project .factory/skills/merge-check"` (defined in `SKILL.md`); commands below invoke it as `$MC ...`.

`/merge-check` does **not** hold a hardcoded list of reviewers. It discovers them by
reading a `merge_check:` block from each droid's frontmatter in the droids directory
(`.factory/droids`, override with `--droids-dir`). Routing knowledge lives in the
droids, so the skill carries no project-specific paths and ports to any repo
unchanged.

`merge_check.roster` (run via `merge-check-roster`) is the engine. It reads the changed + untracked
files on stdin and prints the roster (one droid name per line, sorted-unique).
It is a **floor**, not a ceiling: the orchestrator reads the diff and adds any
reviewer the globs missed (it may only add, never remove).

## The `merge_check:` contract

Add this block to a reviewer droid's frontmatter. All fields are optional.

```yaml
---
name: rtf-go-reviewer
description: Reviews Go modules for correctness and memory efficiency.
model: kimi-k2.7-code
tools: ["Read", "Grep", "Glob"]
merge_check:
  triggers: ["**/*.go"]   # globs; the droid joins if any changed file matches
  always: false           # true → joins every run (e.g. a security reviewer)
---
```

### Outcome-role reviewers (use the `-verifier` filename suffix)

The *outcome reviewer's* role is **not** set by a `merge_check:` field — it is set
by the droid's filename. A droid whose filename stem ends with ``-verifier``
(e.g. ``.factory/droids/rtf-outcome-verifier.md``) is an outcome-role reviewer. It
may or may not declare a `merge_check:` block — the role is carried by the
filename, so an engineer adding a new outcome reviewer names the file
`*-verifier.md` and the droid will be picked up by `--with-outcome`.

| Field | Meaning |
|---|---|
| `triggers` | Glob list. The droid joins the roster when **any** changed/untracked file matches **any** glob. Supports `**` (any depth), `*` (within a path segment), `?`. |
| `always` | The droid joins every run, regardless of the diff, and cannot be skipped. Use for a security reviewer or any non-bypassable floor. |

A droid with no `merge_check:` block never auto-routes; it is still reachable by name
in an explicit comma-list.

## Modes

| Invocation | Roster |
|---|---|
| (default, files on stdin) | path-routed: every droid whose `triggers` match the diff, plus all `always` droids |
| `--all` | every discovered droid **except** `-verifier` droids, plus all `always` droids |
| `--only a,b,c` | exactly those names, plus all `always` droids (the floor is never bypassed) |
| `--audit` | report how every droid is wired (and flag any with no `merge_check:` block), then exit |

`always` droids are appended in **every** mode — that is how the security floor
stays non-bypassable. `-verifier` droids are added with `--with-outcome`, which the
skill passes by default whenever it resolved criteria for the change (from the
branch issue, an openspec change, or explicit `--change`/`--issue`).

## Usage

```bash
# path-routed (default)
printf '%s\n%s\n' "$CHANGED" "$UNTRACKED" | $MC merge-check-roster

# every reviewer
$MC merge-check-roster --all </dev/null

# explicit list
$MC merge-check-roster --only rtf-go-reviewer,rtf-vue-reviewer </dev/null

# include the outcome reviewer (intent context supplied)
printf '%s\n' "$CHANGED" | $MC merge-check-roster --with-outcome

# audit: how is every droid wired?
$MC merge-check-roster --audit
```

## Keeping the floor honest

Globs are coarse, so the orchestrator reads the diff and adds any reviewer the
triggers missed (it may only add, never remove). `--audit` backs this up: it
prints every droid's wiring and flags any with no `merge_check:` block — those never
auto-route, which is easy to forget when adding a new reviewer.

## Zero-roster fails loud

If discovery resolves to zero droids (no `always` droid, no `triggers` match,
no explicit names) the engine exits `2` with a message pointing at this contract,
`--all`, or an explicit `--only` list. An empty roster is an operator error,
never a silent pass.

## Outcome reviewer: no criteria vs thin criteria

Criteria are discovered before dispatch (branch issue → openspec change → explicit
`--change`/`--issue`). Two distinct gates follow:

**No criteria at all** — a traceability gap, handled by the skill (SKILL.md Step
1.5), not silently skipped: link an existing issue, create one, or proceed
adversarial-only with an explicit `outcome_skipped` note in the attestation.

**Thin criteria** (≤1 criterion, or a majority of short ones) — the reviewer
surfaces a `CRITERIA_GAP` and the operator chooses:

- `1` — proceed; the reviewer runs and emits VAGUE mappings.
- `2` — pause; re-run after expanding the criteria.
- `3` — skip the outcome reviewer; adversarial-only (omit `--with-outcome`).

`MERGE_CHECK_CRITERIA_CHOICE=1|2|3` selects non-interactively for CI.
