---
name: fizzbee-spec
description: Writes a new FizzBee formal verification spec for a Peaky failure domain and places it under formal_verification/
---

# FizzBee Spec Writer (Peaky conventions)

## When to Use This Skill

Use when you need to:

- Model a new Peaky failure domain (state machine, protocol, or invariant)
- Extend an existing `.fizz` spec with new actions or properties
- Verify that a proposed code change preserves an existing safety or liveness property
- Investigate a failure domain referenced in `site/docs/development/walkthroughs/local-first/failure-domains.md`

## Language and Tooling Reference (do not duplicate here)

This skill covers **only Peaky's conventions**. For the language itself, defer to
the upstream skills and docs, which are versioned with the CLI:

| Need | Source |
|---|---|
| Syntax, assertions, roles, fault injection, symmetry | `fizz-spec` skill |
| Running the checker, flags, simulation, guided traces | `fizz-check` skill |
| A spec that fails, is slow, or explodes | `fizz-debug` skill |
| Starlark-vs-Python traps, role identity pitfalls | `~/.factory/skills/fizzbee-docs/GOTCHAS.md` |
| Full language reference | `~/.factory/skills/fizzbee-docs/LANGUAGE_REFERENCE.md` |

Refresh them with `fizz install-skills` after `brew upgrade fizzbee` (the installer
writes to `~/.claude/skills/`; copy into `~/.factory/skills/`, add a `name:` key to
each frontmatter, and rewrite the `~/.claude/skills/` doc paths).

Never invent syntax from memory — check the reference above.

## Work Procedure

### 0. Decide Whether a Spec Is Warranted

Most code does not need one. The test: **must the property hold over every
interleaving, retry, or crash point?** Concurrent actors, terminating retry
loops, idempotent replay, cursor ordering, and state machines where an illegal
transition matters — those warrant a spec. Anything a table-driven unit test can
pin does not; write the test instead and say so.

The paths where this question is usually "yes": `app/services/sync/**`,
`app/local-db/migrations.ts`, `shared/db/schema/sync.ts`,
`services/internal/syncengine/**`. Changing one of those without touching
`formal_verification/**` is worth one sentence in the MR explaining why not.

### 1. Identify the Failure Domain

Read `site/docs/development/walkthroughs/local-first/failure-domains.md` and find the
domain you want to model. If it is a new domain not listed there, describe it in the
header comment of the `.fizz` file.

### 2. Read the Source Code

Read the TypeScript or Go that implements the domain — never model from memory or
from prose specs. Common locations:

- `app/services/sync/SyncEngine.ts` — outbox status, ConcurrencyController, retry
- `app/services/local-mutation.ts` — LocalMutation.commit() three-write pattern
- `app/local-db/migrations.ts` — migration runner paths
- `shared/db/schema/sync.ts` — outbox status enum and table shape
- `services/internal/syncengine/` — Go push/pull, entitlement scoping

### 3. Place and Name the File

```text
formal_verification/sync/<descriptive_name>.fizz        # outbox / mutation / pull protocol
formal_verification/storage/<descriptive_name>.fizz     # local SQLite layer
formal_verification/resilience/<descriptive_name>.fizz  # error recovery, concurrency
```

Name the file after the failure domain, not the component:

- `outbox_item_lifecycle.fizz` ✓
- `SyncEngine.fizz` ✗ (too generic)

### 4. Write the Required Header Comment

Every spec must open with:

```text
# WHY THIS SPEC EXISTS
# (one paragraph: what failure mode this guards against, why it matters to
#  Peaky's local-first guarantees)
#
# WHAT WE MODEL
# (which file / class / function, and the specific behaviour modelled)
#
# WHAT WE PROVE
#   PropertyName — one-line explanation
```

Add these subsections when they apply:

- **FAIRNESS ASSUMPTIONS** — required whenever the spec has a liveness property.
  State what must go right in production for it to hold ("the engine eventually
  picks up a pending item").
- **MODELLING SCOPE** — when you bound the model (two actors, three families),
  justify why that is sufficient rather than leaving it to look like missing
  coverage. See `sync/sse_channel_alignment.fizz`.
- **DEADLOCK DETECTION IS OFF** — when the frontmatter disables it, say why.

### 5. Keep the Model Minimal

- Only state variables that the properties actually need. Every extra variable
  multiplies the state space for zero verification value.
- Read-only config goes in top-level constants (`MAX_RETRIES = 3`), never in `Init`.
- Name actions after the real method or operation (`MarkSynced`, `OnFailure`,
  `ApplyNext`) so a reader can grep the implementation.
- Prefer `atomic action` when the step maps to one DB transaction or one
  synchronous call; use a serial action only when you want the interleaving or the
  crash-truncation it exposes.
- Property names are PascalCase and must match the `# WHAT WE PROVE` list.

### 6. Decide the Terminal-State Policy Deliberately

FizzBee flags a state with no enabled action as a deadlock. Two acceptable
resolutions, in this order:

1. **Model the re-entry that really exists** and keep detection on. A completed
   migration run is followed by another cold start or an OPFS wipe
   (`storage/local_db_migration_idempotency.fizz`); a committed transaction is
   followed by the next mutation (`sync/local_mutation_atomicity.fizz`). This
   usually strengthens the model.
2. **Declare the terminal state intentional** with `deadlock_detection: false` in
   the frontmatter, documented in the header. Correct only when a lifecycle
   genuinely ends, e.g. one outbox row at `synced` / `failed`.

Never add a fake self-loop or drop a guard to silence the report.

Checker options go in the frontmatter of the spec that needs them. **Do not add a
`fizz.yaml`** — `fizz` reads it from the spec's own directory as a *base* config that
frontmatter merges over, so it silently supplies every option a spec does not mention
(a `deadlock_detection: false` there would disable the check for the whole folder,
invisible to a reader of the spec). The `fizz.yaml not found` line on every run is
informational.

### 7. Run It

```bash
make verify/sync/outbox_item_lifecycle    # single spec
make verify                               # all specs, ~70s
```

`fizz` **exits 0 even when an invariant is violated**, which is why the Makefile
gates on a `PASSED` line. Never bypass it with a bare `fizz` call in CI.

Run artefacts (`*.json` AST, `out/`, `.fizzbee-out/`) are generated and gitignored —
never commit them. The AST does not embed its source, so a committed copy would
silently verify a stale model.

### 8. Prove the Assertions Bite

A passing spec can check nothing — a false `require` silently disables an action.
Before calling it done, break the model in a scratch copy (remove a clamp, drop a
`require`, weaken `fair`) and confirm the checker names the property you expected:

```text
FAILED: Model checker failed. Invariant:  BatchSizeInBounds
```

Then revert. Do this outside the committed spec.

### 9. Wire the Drift Guard

Every spec must carry a machine-checked `# MODELS` block listing the files it
models, and at least one of those files must carry a
`Formal model: formal_verification/<path>` comment pointing back. Both directions
are asserted by `tests/guards/spec-drift.test.ts`, which also
compares any constant the spec mirrors (enum values, retry budgets, clamps)
against the module that owns it. If your spec hard-codes a value that exists in
the code, add an assertion there — otherwise the value will drift silently.

If the spec is a candidate for model-based testing (`make verify-mbt`), keep its
state inside a `role`: fizzbee-mbt only compares system state through role
adapters, and `getState()` on a top-level model adapter crashes the server.

### 10. Update the Walkthrough

Add a row to the spec table and the failure-domain mapping in
`site/docs/development/walkthroughs/formal-verification.md`.

## Reference Specs in This Repo

Read the closest existing spec before writing a new one:

| Pattern you need | Spec |
|---|---|
| Simple lifecycle state machine, liveness + fairness, intentional terminal state | `sync/outbox_item_lifecycle.fizz` |
| Integer arithmetic hazard, clamp invariants | `resilience/aimd_concurrency_controller.fizz` |
| N symmetric entities via `oneof`, mutual exclusion | `resilience/sqlite_single_writer_coordination.fizz` |
| Transaction atomicity, staged vs durable writes | `sync/local_mutation_atomicity.fizz` |
| Re-entry actions instead of disabling deadlock detection | `storage/local_db_migration_idempotency.fizz` |
| Authorization / routing contract with bounded actor set | `sync/root_scope_alignment.fizz`, `sync/sse_channel_alignment.fizz` |
| Larger protocol model (~109k states) | `sync/sync_engine_push_pull.fizz` |

## Common Mistakes (Peaky-specific)

- **Modelling implementation instead of protocol** — if you need more than ~6 state
  variables, you are modelling helpers and internals. Strip it down.
- **`require` used as an assertion** — the action is disabled, the spec passes, and
  nothing was checked. Assert with `always assertion`.
- **Liveness without a documented fairness assumption** — if you cannot name what
  must go right in production, the property is probably wrong.
- **Spec drift** — when a protocol's semantics change, update the spec *first*, then
  the code. Never read a passing `make verify` as evidence about the code: the
  checker only proves the *model* satisfies its own properties, and it never reads the
  implementation. An untouched spec that still passes after a semantic code change is
  exactly what stale looks like. The only mechanical link is a model-based test
  (`fizz-mbt` skill); everything else is a human comparing the two.
