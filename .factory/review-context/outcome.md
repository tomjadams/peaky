# Outcome Review Context

## Scope

Use this context when Peaky's merge check verifies that a diff delivers its
stated outcome. This file identifies Peaky's intent sources, path conventions,
and acceptance artefacts. Shared outcome-review guidance owns the general
criterion-quality and evidence rules.

## Project invariants

- Acceptance intent comes from one of two project sources:
  1. OpenSpec checkbox tasks under
     `openspec/changes/<change-name>/tasks.md`, selected explicitly with
     `--change <change-name>` or discovered from branch context.
  2. The linked GitLab issue's `## Acceptance Criteria` section, selected
     explicitly with `--issue <iid>` or auto-discovered from the branch/MR.
- OpenSpec design and spec artefacts provide context, but the merge-check
  outcome list is the task checkbox list. Existing changes may contain only
  `design.md` and `tasks.md`; a `proposal.md` is schema-dependent, not required
  by repository layout.
- Criteria stay in source order. Existing `REQ-NNN` or `AC-NNN` identifiers are
  retained; otherwise Peaky records deterministic `C01`, `C02`, and later
  anchors.
- The implementation diff includes the merge-base-to-HEAD change plus working
  tree and untracked files supplied to the run. Evidence points to actual
  implementation or tests, not roadmap notes or unchecked future tasks.
- Material changed lines that cannot be traced to the selected intent remain
  visible as drift.

## Project conventions

- `/merge-check` is the project acceptance gate. Use `--force-full` once for the
  final approval stamp; incremental cached reviews are iteration aids only.
- The committed acceptance record is
  `attestations/mr-<iid>.md`, configured by
  `.factory/merge-check.yml`. It records the reviewed commit, reviewed
  merge-base, final verdict, reviewers, criterion anchors and locations,
  discrimination result, and timing.
- An attestation is normally committed as an attestation-only follow-up. Any
  later non-attestation code change makes it stale. Squash merge intentionally
  ends the feature-branch attestation lifecycle.
- A final approval requires `force_full: true` and a reviewed base that covers
  the complete MR diff. The writer derives the commit SHA, base, and verdict
  from Git and merge-check state rather than caller-provided values.
- Run artefacts live under
  `.factory/merge-check-runs/<branch-slug>/`, with `/tmp` fallback only for a
  read-only repository. Reviewer-specific diffs may live under
  `.factory/scoped-diffs/`.
- The discrimination sensor uses the extension commands in
  `.factory/merge-check.yml`: related Vitest for TypeScript/Vue, all Go tests
  for Go, and both merge-check and CI-gate pytest suites for Python.
- MRs confined to the configured generated developer changelog path may be
  exempt when all path and branch/title guards in `gate.attestation_exempt`
  match. Mixing any other changed path removes the exemption.

## Deterministic coverage

- Resolve exactly one acceptance source and record whether it came from
  OpenSpec or a GitLab issue.
- Preserve each source criterion verbatim and in order while assigning stable
  anchors.
- Map the complete diff, including relevant tests and generated contract
  changes, against the selected source and identify untraceable material drift.
- Confirm final attestation metadata covers the current reviewed code commit and
  MR merge-base.
- Confirm changed extensions use the configured one-shot discrimination command;
  an unconfigured extension is recorded as skipped rather than guessed.
- Treat missing or intentionally skipped acceptance intent as explicit
  attestation metadata, never as silent approval.

## References

- `.factory/merge-check.yml`
- `.factory/skills/merge-check/SKILL.md`
- `.factory/skills/merge-check/references/outcome-verifier-format.md`
- `.factory/skills/merge-check/references/attestation-predicate.md`
- `openspec/changes/`
- `attestations/`
- `.factory/merge-check-runs/`
- `.factory/scoped-diffs/`
