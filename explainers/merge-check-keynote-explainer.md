# Iterate fast. Merge honestly. — /merge-check in 5 minutes

> You can prompt your way to a change in minutes; /merge-check makes sure a real review ran on exactly the code you merge — and a fixed rule, not a model, decides.

*Interactive explainer: `merge-check-keynote-explainer.html` — single self-contained HTML (open in a browser; press `P` to present).*

## Slides

1. **Hero · Iterate fast. Merge honestly.** — the hard part of AI-speed iteration is knowing a real review ran on exactly the code you merge
2. **The story in one line · /merge-check at a glance** — incremental reviews while you iterate → one full stamped pass before merge → a deterministic gate at the merge
3. **01 · The problem · Not impossible — just inconsistent** — OpenSpec automates planning and tests; ad-hoc prompting skips the spec entirely — either way, iteration after the first pass and the merge itself stay ad-hoc
4. **01 · The problem · The code races ahead. The review stays frozen.** — ad-hoc fix-loop turns move the code past the last APPROVE; by turn 23 the review still points at turn 7
5. **02 · The solution · Five parts, one pipeline** — roster → planner → fault sensor → attestation → CI gate — the five parts named up front, before the detail
6. **02 · The solution · A floor, a roster, and one honest pass** — security reviewer always runs; 14 reviewers join per files touched; a planted fault must fail the tests; one --force-full pass gets stamped
7. **02 · The solution · Most of this is code. One part is a peer.** — who reviews, whether to reuse a verdict, and pass/block are all fixed rules; the one judgment call is the reviewers themselves (and CodeRabbit)
8. **03 · The record · The CI gate reads a file, not your word** — each run writes attestations/mr-<id>.md; anti-forgery by design — the CI gate re-verifies the record against the real commit, it never just trusts the file
9. **Close · Did a real review run on exactly this code?** — answered from the record, not memory or trust — roster, planner, fault sensor, attestation, CI gate

## Key facts

- OpenSpec automates planning and tests before code, but the fix-loop after apply and the merge itself stay ad-hoc on both sides — with or without a spec, that ad-hoc middle is where drift piles up
- /merge-check runs adversarial reviewers on a merge-request branch and writes an attestation the CI gate reads
- rtf-security-reviewer always runs and cannot be disabled by the author; 14 more reviewers join based on the files touched
- a planner decides per reviewer whether to run, reuse a cached approval, or skip — based on whether the files it cares about changed since its last run
- the discrimination sensor plants a deliberate fault and re-runs the tests; if the suite stays green the run BLOCKs (weak tests)
- the pre-merge CI gate is deterministic and anti-forgery by design: force_full must be true, the stamped commit_sha must equal HEAD, and no reviewer's files may have changed since the stamp — it re-verifies against the real commit rather than trusting the file
- attestations live at attestations/mr-<id>.md; the CI gate reads the frontmatter, not the prose

---

<!-- assembled by .factory/skills/explainer v1.4.1 · style=keynote · theme=dark · components=[flow,ledger,stat,verdict,contrast,comparison] · source=explainers/_sources/merge-check-keynote.html · motion=motion-12.23.26.min.js -->
