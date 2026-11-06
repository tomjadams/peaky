# Discrimination sensor — prove the tests catch regressions

> This file uses `MC="uv run --project .factory/skills/merge-check"` (defined in `SKILL.md`).

The adversarial roster reads code; the outcome verifier maps criteria to code.
Neither answers the question this sensor owns: **if the behaviour regressed,
would the test suite turn red?** A green suite that asserts nothing meaningful
passes every other gate. The sensor injects small, behaviour-level faults and
confirms the tests *kill* them. A fault the suite does not catch — a
**survivor** — is evidence of a weak or missing test, surfaced as a `BLOCK`.

`merge_check.sensor` (run via `merge-check-sensor`) owns the mechanics and the verdict; the
orchestrator owns *which* mutations to inject. Selection needs judgement, so it
stays with the model.

## When it runs (gating)

Run the sensor in Step 4.5 — after aggregation, before the attestation — **only
when** the diff changes non-test source that has test coverage:

- The `CHANGED` set contains at least one source file (not a test, not docs, not
  config), **and**
- a test command can be resolved (below).

Otherwise skip with a recorded reason — never silently:

| Situation | Record in attestation |
|---|---|
| no source files changed (docs/config/test-only) | `discrimination: { ran: false, reason: no-testable-source }` |
| no test command resolvable | `discrimination: { ran: false, reason: no-test-command }` |
| pure deletion / generated files only | `discrimination: { ran: false, reason: no-testable-source }` |

A skip is an explicit, audited line — same philosophy as `outcome_skipped`.

## Resolving the test command

The command is **per the file extension of the mutated files**, not one command for
the whole repo. Take the extension without the dot (`ts`, `vue`, `go`, `py`, `rs`) and
look it up via `merge-check-config --test-cmd <ext> --files <changed>` (which substitutes
`{files}`/`{package}`). An extension with no entry returns `skip:no-command-for-<ext>`
→ skip it, recorded, never a failure. The config is the single source of truth;
`merge-check-config --init` writes the default skeleton, but it does **not** detect
your tooling — fill in `test:` yourself and commit. Resolution is deterministic
because the file is the contract, not because anything is auto-proposed.

**The command MUST be non-watch and self-terminating.** The sensor runs it and
waits for an exit code; a watch-mode runner never exits and hangs the run. A bare
`test` script is frequently watch mode (`vitest`, `jest`). If the resolved command
is watch-mode, convert it to a one-shot run — or skip rather than risk a hang.
Prefer a `Makefile` target or `MERGE_CHECK_TEST_CMD` over a bare package script.
The sensor parses commands with `shlex` and does not invoke a shell. Plain argv
commands are supported, plus the scoped form `cd <dir> && <command>` which is
converted to a subprocess `cwd`.
Linked dependency directories are trusted local tooling, not a sandbox boundary:
the sensor validates the linked top-level path but does not recursively audit every
nested symlink inside large dependency trees such as `node_modules`.

**Scope to the changed files/package** — faster, and more honest: a survivor means
"the tests that should cover this code don't catch the bug," so run the tests *near*
the mutated code, not the whole suite (paid once per mutation). Match the scoping to
the language — the same way pre-commit already does per stack:

| Mutated file | Scoped, non-watch command |
|---|---|
| `*.ts` / `*.vue` | `pnpm exec vitest related --run <files>` (or `vitest run <file>`) |
| `services/**/*.go` | `cd services && go test ./<changed-package>/...` (build cache skips the rest) |
| `*.py` | `pytest <module_or_test_file>` |

When the diff spans languages, **run the sensor once per language group** — each
invocation gets that language's mutations and its own `test_cmd`; merge the JSON
results. The engine is language-agnostic (it just applies text and reads an exit
code); only the command and the mutation operators differ per language.

The tradeoff: if the only catching test lives far away (an integration/e2e test), a
scoped run can miss it — acceptable for a unit-level probe. Reserve the full suite
for changes with no clear local tests, and never wire Playwright/e2e here (needs a
server, far too slow per-mutation).

## Selecting mutations (orchestrator judgement)

Pick **1-3** mutations on the **changed lines** (read `DIFF`). Each must be a
*behaviour-level* fault a correct test must catch — not a cosmetic edit a linter
or type-checker would reject on its own (those prove nothing about tests).

Good mutations flip a real decision:

| Language-agnostic fault | Example `find` → `replace` |
|---|---|
| boundary flip | `a > b` → `a >= b` |
| negate a guard | `if (!valid)` → `if (valid)` |
| swap a branch result | `return true` → `return false` |
| drop a side effect's argument | `clamp(x, 0, max)` → `clamp(x, 0, max * 2)` |
| off-by-one | `i < n` → `i <= n` |
| weaken a filter | `status === 'active'` → `true` |

Avoid: whitespace, comments, renames, type-only edits, or anything that fails to
**compile/type-check** rather than fails a **test** (a compile error is caught by
the build, not by the assertion you are probing).

`find` must match **exactly once** in the file — quote enough surrounding context
to be unique. The script reverts each mutation before the next, and only ever
mutates a throwaway worktree (`git worktree add --detach` at HEAD); your working
tree is never touched.

## Running it

```bash
MC="uv run --project .factory/skills/merge-check"
SENSOR_OUT="$($MC merge-check-sensor <<'JSON'
{
  "test_cmd": "pnpm exec vitest related --run app/services/sync/clamp.ts",
  "link": ["node_modules"],
  "mutations": [
    {"file": "app/services/sync/clamp.ts", "find": "Math.min(n, max)",
     "replace": "Math.min(n, max + 1)", "rationale": "upper-bound off-by-one must be caught"}
  ]
}
JSON
)"
SENSOR_RC=$?
# Go example: "test_cmd": "cd services && go test ./peaky-sse/...", "link": []  (no node_modules needed)
```

The sensor runs the test command **once per injected fault, plus one baseline run**,
so it is the slowest step — re-running your suite is the cost. It logs each fault's
start, kill/survive verdict, and elapsed seconds to
**stderr** as it goes, and reports a total `elapsed_s` in the JSON, so a long run
never looks stuck and the time breakdown is visible. Announce the run before
dispatching it (see SKILL.md "Progress").

`link` symlinks heavy uncommitted dependency dirs (e.g. `node_modules`, `.venv`)
into the worktree so the suite can start. The unmutated suite is **always** run
first and must be green: a survivor is only meaningful against a green base, and a
red base would make every mutant look killed (false confidence). /merge-check normally
follows red/green/refactor, so the base is expected green; if it is not, the sensor
fails closed (operational error, exit 2) rather than scoring against a broken suite.

## Mapping results to findings + verdict

The script's exit code and JSON drive the outcome:

| Sensor exit | Meaning | /merge-check action |
|---|---|---|
| `0` | every mutation killed | INFO line: `discrimination: N injected, N killed`; verdict unaffected |
| `1` | >=1 survived | one **BLOCK** finding *per survivor* (weak/missing test); verdict → `BLOCK` |
| `2` | operational error (or timeout) | **REVIEWER_FAILURE**; exit 2 — fix the command/mutation and re-run |

Each survivor becomes a finding in the consolidated body:

```text
**Severity:** BLOCK
**File:** app/services/sync/clamp.ts
**Evidence:** mutation `Math.min(n, max)` → `Math.min(n, max + 1)` survived — suite stayed green (exit 0)
**Issue:** no test discriminates the upper-bound behaviour; a real off-by-one would ship undetected
**Fix:** add/strengthen a test asserting the clamped value at the boundary
```

Record the run in the attestation frontmatter (`schema_version: 4`):

```yaml
  discrimination:
    ran: true
    injected: 3
    killed: 2
    survived: 1
```

## Limitations (state them, don't hide them)

- **It proves test *sensitivity*, not correctness** — a killed mutant means the
  suite reacts to that fault, not that the code is right. Pair with the
  reviewers and the outcome verifier, never as a substitute.
- **Sampling, not exhaustive** — 1-3 mutations are a spot check, not full
  mutation testing. The point is a fast signal that the new tests bite.
- **Worktree cost** — each run is a fresh suite run; keep mutations few and the
  command scoped.

!!! warning "A green baseline proves the command exited 0, not that it ran tests"
    If the test command silently collects zero tests, every mutant survives and the
    sensor reads as "uniformly weak suite" when the truth is "the suite never ran."
    Two real causes: (1) missing test dependencies — e.g. a `uv run` invocation that
    omits the extra holding `pytest`/`hypothesis`, so a fresh worktree collects
    nothing; provision the test deps in the command (`--extra dev`). (2) A runner
    erroring on a **symlinked dependency dir** — `link` symlinks `node_modules` into
    the worktree, and some runners (notably vitest/esbuild resolving through symlinks)
    fail or skip rather than run. As a guard, the sensor sets a `warning` field on the
    summary whenever **every** injected mutant survives — treat an all-survived result
    on a suite you believe is strong as "the command isn't really running tests," and
    verify it runs green with real assertions *outside* the sensor before trusting the
    verdict.
