# `rtf-outcome-verifier` — MAPPED / MISSING / PARTIAL / VAGUE

A `minimax-m3` droid that runs **after** the adversarial roster, whenever criteria resolve (auto-discovered from the branch issue / openspec change, or forced with `--change <name>` / `--issue <N>`). Walks each acceptance criterion (from the openspec change's `tasks.md` checkbox list, or the GitLab issue's `## Acceptance Criteria` body) and emits a structured mapping plus a drift section plus a smoke command.

## Criterion anchors (stable, deterministic)

Every criterion carries an **anchor** so the audit map is a lookup, not prose matching:

- If the criterion text already carries a spec id (`REQ-NNN` / `AC-NNN`, e.g. from an openspec spec/tasks line), reuse that id verbatim.
- Otherwise assign a positional anchor `C01`, `C02`, … in the **order the criteria were read** (deterministic because criteria are read verbatim, in order, never reordered or split).

The anchor leads the criterion heading (`### Criterion [C01]: <verbatim text>`) and is what `/merge-check` carries into the attestation's `outcome_verifier.criteria` map. The same change re-verified yields the same anchors.

## Per-criterion mapping tokens

- **MAPPED `<file:line>`** — implementation lives at this location. Cite the code, not a comment / TODO / roadmap note. Paired `**Evidence:**` line carries a verbatim quote (1–5 lines, indentation preserved).
- **MISSING — `<why>`** — no implementation evidence anywhere in the diff. Be specific. Paired `**Evidence:**` carries the exact grep result that confirmed absence.
- **PARTIAL — `<what's missing>`** — implementation exists but does not fully satisfy the criterion. Paired `**Evidence:**` carries the verbatim snippet showing what's present plus a one-line note on what's missing.
- **VAGUE — `<quote>`** — the criterion text itself fails the closure checklist (below), so it cannot be honestly mapped. Paired `**Evidence:**` is the VAGUE quote itself.

A finding without a paired `Evidence:` line is inadmissible — the consolidator parser downgrades it.

## Closure checklist — a vague criterion can never read as satisfied

Before mapping a criterion to code, gate it on closure. A criterion **passes closure** only if all three hold:

1. **Unambiguous** — one reading; no "etc.", no "and/or", no undefined pronoun.
2. **Verifiable verb** — an observable action (returns, rejects, renders, persists), not an attitude (supports, handles, improves).
3. **Measurable outcome** — a concrete state/value a test could assert.

A criterion that fails any check is `VAGUE` — **even if plausible code exists for it**. Mapping a vague criterion to code launders an untestable requirement into a green checkmark; that is the exact failure this droid exists to prevent. Closure is a gate, not a hint:

- **Any** `VAGUE` present → the outcome verdict is at best `NEEDS FIX` (never `APPROVE`).
- `VAGUE` is reported with the closure check it failed, so the author fixes the *criterion*, not the code.

This is the merge-check-time complement to the spec-time closure gate: thin criteria caught here should be pushed back upstream into the issue / openspec spec.

## Drift section

For lines / files that materially changed but aren't traceable to any criterion. Emitted as:

```text
### Drift: <file>
- Issue: <lines not traceable to any criterion/intent>
- Recommendation: <drop or move to openspec>
```

## Smoke command

```text
### Smoke: <command>
- Expected: <run-green signal>
```

A short, executable validation command and its expected exit / observation. Reviewed by humans; not auto-executed by `/merge-check` (commands stay read-only by default).

## CRITERIA_GAP signal

When the supplied criteria list is too thin to map (≤1 criterion, or majority short), every criterion surfaces as VAGUE + a top-level `CRITERIA_GAP` finding is emitted. The `/merge-check` command surfaces this to the operator *before* dispatch so the operator can choose:

- `1` — proceed anyway; verifier runs, emits VAGUE mappings.
- `2` — pause; re-run after expanding the criteria.
- `3` — skip rtf-outcome-verifier; adversarial-only.

`SKIP_OUTCOME_VERIFIER=1` (or `MERGE_CHECK_CRITERIA_CHOICE=1|2|3` for non-interactive CI) propagates into Step 2's roster assembly.

## First-line regex (format-drift gate)

```text
^Summary: OUTCOME (APPROVE|NEEDS FIX|BLOCK) — [0-9]+ criteria reviewed$
^Summary: OUTCOME ERROR — .+$
```

Mismatch → reviewer-failure signal → exit 2.
