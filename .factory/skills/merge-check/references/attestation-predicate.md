# Attestation frontmatter schema

`/merge-check` writes a single file per MR at `attestations/mr-<iid>.md` on the MR's source branch. The file is the **attestation** that the MR's diff was reviewed end-to-end. Squash-merge discards the branch and the attestation dies with it — that's the lifecycle.

## Frontmatter (YAML)

The frontmatter is the contract that `mr_require_quality_gates` validates. Required fields are **minimal** — only what the gate reads. Optional fields are available for reviewer convenience but the gate ignores them.

`schema_version` is the format version of this report — a plain integer, bumped when the frontmatter shape changes so a future gate can tell `v1` from `v2`. (A SLSA/in-toto provenance attestation, if we add one later, is a *separate* artefact in its own directory — not this file — so this report carries no in-toto `predicateType`.) It is **always emitted** by `merge_check.attestation` (the `merge-check-attest` writer) so historical attestations are never missing the field. From `schema_version: 3` onwards the gate reads `force_full` (an `APPROVE` is stale unless `force_full: true` was set at write time); from `schema_version: 4` it also reads **`reviewed_base`** — the merge-base the reviewers diffed against. The gate recomputes the merge-base of the MR target and HEAD and refuses the stamp unless `reviewed_base` equals it or is an ancestor of it; a *newer* `reviewed_base` means the review was run against a narrowed `--base` that skipped part of the diff. This is the **server-side** anti-forgery check — the writer's `--base` is agent-controlled and cannot be trusted to enforce coverage on its own. The writer derives `commit_sha`/`reviewed_base` from git and `verdict` from the planner cache — it does NOT accept these from the caller, so an agent cannot fabricate a stamp by supplying a hand-picked SHA, base, or verdict.

```yaml
---
attestation:
  schema_version: 4                       # REQUIRED — report format version (>= 4)
  commit_sha: <full-sha>                  # REQUIRED — reviewed code commit SHA
  reviewed_base: <full-sha>               # REQUIRED — merge-base the reviewers diffed against (gate checks coverage)
  verdict: APPROVE                        # REQUIRED — see enum below
  force_full: true                        # REQUIRED when verdict=APPROVE — pre-merge final-pass stamp
  generated_at: <ISO8601>                 # OPTIONAL — clock at /merge-check completion
  runners_ran: [rtf-security-reviewer, ...]   # OPTIONAL — list of droids that fired
  adversarial_counts:                     # OPTIONAL
    block: 0
    warn: 0
    info: 0
  outcome_verifier:                       # OPTIONAL — present when criteria resolved (auto or explicit)
    ran: true
    verdict: APPROVE
    criteria_count: <N>
    mapped: <N>
    missing: <N>
    partial: <N>
    vague: <N>
    criteria:                             # OPTIONAL — the deterministic per-criterion audit map
      C01:                                #   anchor: positional (read order) or spec REQ-NNN/AC-NNN when present
        status: MAPPED                    #   MAPPED | MISSING | PARTIAL | VAGUE
        location: app/x.ts:42             #   file:line for MAPPED/PARTIAL; omitted/"" otherwise
  discrimination:                         # OPTIONAL — present when the sensor ran or was deliberately skipped
    ran: true                             #   false + reason when gated out (no-testable-source | no-test-command)
    injected: <N>
    killed: <N>
    survived: <N>                         #   >0 → a BLOCK finding per survivor
  timing:                                 # OPTIONAL — phase timings in seconds
    discovery_s: 0
    reviewer_dispatch_s: 0
    sensor_s: 0
    attestation_write_s: 0
  outcome_skipped: no-traceable-issue     # OPTIONAL — present iff outcome was skipped for lack of criteria
---
```

The frontmatter beyond the REQUIRED keys is emitted by `merge_check.attestation` (the `merge-check-attest` writer)
from the optional `META_JSON` argument — the gate ignores these, but they make the
attestation a machine-readable audit record (which criteria mapped where, whether
the tests actually bite) rather than prose. `schema_version` is `4` from this report
on: `reviewed_base` (added in v4) closes the narrowed-`--base` forgery; `force_full`
was added in v3 so an `APPROVE` verdict requires a final-pass stamp
(`--force-full`); the `outcome_verifier.criteria` map and `discrimination` block
were added in `schema_version: 2`. The gate reads `schema_version`, `commit_sha`,
`verdict`, `force_full` (from v3 onwards), and `reviewed_base` (from v4 onwards).

## `verdict` enum

| Value | Meaning | Gate action (`mr_require_quality_gates`) |
|---|---|---|
| `APPROVE` | All adversarial findings ≤ INFO; rtf-outcome-verifier (if dispatched) has zero MISSING/PARTIAL. | Remove `do-not-merge: missing-verify-report` / `stale-verify-report` / `verify-reviewer-block` if present. |
| `NEEDS_FIX` | Adversarial WARN ≥ 1, but no BLOCK. rtf-outcome-verifier MISSING/PARTIAL = 0. | Add `do-not-merge: verify-reviewer-warn` + governance comment listing the WARN findings. |
| `BLOCK` | Adversarial BLOCK ≥ 1, OR rtf-outcome-verifier MISSING/PARTIAL ≥ 1, OR a discrimination-sensor mutant survived (`discrimination.survived ≥ 1`). | Add `do-not-merge: verify-reviewer-block` + governance comment listing the BLOCKs. |
| `REVIEWER_FAILURE` | A reviewer returned ERROR, format-drift gate triggered, reviewer timed out, or the discrimination sensor errored operationally (exit 2). | Add `do-not-merge: verify-review-failure` + governance comment naming the failure mode. |

The gate's `verdict → action` mapping lives in `scripts/ci/mr_require_quality_gates.py`.

## Merge-gate contract

`scripts/ci/mr_require_quality_gates.py` is the **byte-level peer** of this contract. Two peers run side-by-side at the merge boundary; both must pass before the squash button activates:

1. **Peer A — CodeRabbit (LLM):** `.coderabbit.yaml` has
   `reviews.request_changes_workflow: true` (without it, the `'error'` mode
   below is informational, not blocking) plus
   `pre_merge_checks.description.mode: "error"` with the
   `requirements:` rubric *"The merge request description should summarize
   the user-visible change, validation performed, rollout considerations,
   and follow-up work."* — CodeRabbit gates that this rubric is met.
   A second pre-merge check, `pre_merge_checks.issue_assessment.mode:
   "warning"`, runs alongside it but is intentionally non-blocking: it
   surfaces a suggestion, not a refusal, so contributors do not have to
   derail their MR to satisfy it. Author cannot self-bypass:
   `override_requested_reviewers_only: true` makes the "Ignore failed
   checks" checkbox and the `@coderabbitai ignore pre-merge checks`
   command usable only by a *requested reviewer*, not the MR author.
2. **Peer B — shell gate (deterministic):** the gate script reads
   `attestations/mr-<iid>.md` from the MR's source branch and asserts four
   boolean conditions:
   - `force_full: true` is on the frontmatter (strict equality — any other
     value, missing field, or string-coerced syntax fails). This proves the
     writer verified the planner cache was complete at stamp time: every
     reviewer in the plan had a cached APPROVE with a fingerprint matching
     the current diff. The writer derives `commit_sha` from `git rev-parse
     HEAD` and `verdict` from the cache state — it does NOT accept these
     from the caller, so an agent cannot fabricate a stamp by skipping the
     reviewer dispatch.
   - `commit_sha` matches the SHA at MR HEAD on the source branch, **or** the
     only commits between `commit_sha` and HEAD are attestation-only (the
     follow-up commit that writes `attestations/mr-<iid>.md` itself). Any
     reviewer-relevant push after `/merge-check` invalidates the report —
     the gate refuses the stale proof.
   - No reviewer-relevant file drifted between the stamped SHA and HEAD. The
     drift check matches every droid's `merge_check.triggers` glob, so any
     change in a file a reviewer cares about (e.g. `services/**/*.go` for the
     rtf-go-reviewer Droid), even after the stamp, fails the gate. Drift only
     passes when the gate confirms pure attestation-only commits in between.
   - `reviewed_base` (schema v4) covers the MR's full diff. The gate recomputes
     the merge-base of the MR target and HEAD from the merge ref's own parents —
     which the agent cannot author — and rejects the stamp unless the recorded
     `reviewed_base` equals it or is an ancestor of it. A *newer* base means the
     review ran against a narrowed `--base` that skipped part of the change.
     There is no override: the recomputed merge-base is the one input an agent
     cannot forge.

   **Exemption.** An MR with *no* attestation still passes when its whole diff is
   confined to a `gate.attestation_exempt` rule's `paths` allowlist in
   `.factory/merge-check.yml` — for machine-generated changes with no source to
   review (the git-cliff changelog). Server-side policy lives under the `gate:`
   subtree (the client ignores it). The gate reads the policy from the merge
   **target** branch (never the MR under review) and requires *confinement*: every
   changed file must match, so an exempt path bundled with other changes never
   skips. `source_branch`/`title` are optional secondary guards.

   The gate is wired into `.gitlab-ci.yml` as the `mr-require-quality-gates`
   CI job (quality stage). It uses PEP 723 inline metadata to declare its
   PyYAML dependency, so `uv run` installs it in an ephemeral environment
   without the full `scripts/ci` toolkit. In CI, the source branch HEAD is
   derived from the merge commit's second parent (GitLab checks out the
   merge ref, not the source branch directly).

If the gate fails on `force_full`, the contributor re-runs
`/merge-check --force-full`, which rewrites the attestation with
`force_full: true` and a fresh `verdict: APPROVE`. The two-peer shape means
the merge contract is never silently bypassed — the missing flag surfaces as
a visible CI failure, not a squash.

## Schema-version history

The schema-version is the frontmatter field `attestation.schema_version` (the
config file at `.factory/merge-check.yml` carries its own unrelated
`schema_version` field — they are different files, different scopes, do not
conflate).

| Version | Field added / changed | Why (intent) | Gate reads |
|---|---|---|---|
| `1` | first stamp: `commit_sha`, `verdict`, `generated_at` | the gate's irreducible contract — SHA + verdict label is enough to fail a squash | `commit_sha`, `verdict` |
| `2` | `runners_ran`, `adversarial_counts`, `outcome_verifier.criteria`, `discrimination` | machine-readable audit map so post-merge review can answer "which droids fired, which criteria mapped where" without re-running anything | unchanged — gate ignores optional audit fields |
| `3` | `force_full` (boolean) on the writer; `commit_sha` and `verdict` derived from git + cache (no longer agent-supplied) | cache reuse during iteration is fine, but the final stamp must prove the reviewer roster was actually dispatched — the writer verifies the planner cache has APPROVE entries with matching fingerprints for every reviewer before writing | adds `force_full` — `APPROVE` requires `force_full: true`; writer refuses if any reviewer is missing from cache |
| `4` | `reviewed_base` (the merge-base the reviewers diffed against) on the writer, derived from git | closes the narrowed-`--base` forgery the client can't defend alone: the gate recomputes the true merge-base of the MR target and HEAD and rejects a *newer* `reviewed_base` (part of the diff went unreviewed). No override — the one input this guards is the only thing an agent can't forge | adds `reviewed_base` — `APPROVE` rejected unless it equals or is an ancestor of the recomputed merge-base |

## SHA semantics (attestation-only commit proof)

- Frontmatter `commit_sha` is captured from the **reviewed code commit** at `/merge-check` completion, before the attestation file is committed.
- The attestation may then be committed as a separate, attestation-only follow-up commit. The gate must reject any mixed commit that touches both `attestations/` and non-attestation paths.
- To validate freshness, the gate walks from `HEAD` back to `commit_sha` and confirms every intervening commit is attestation-only. Any intervening non-attestation commit makes the report stale.
- If the contributor changes code after `/merge-check` runs, the file's frontmatter SHA becomes stale; the gate applies `do-not-merge: stale-verify-report`.
- Squash-merge: the original branch (and its `attestations/`) vanish; the squash commit on the target branch carries no attestation. This is the intended lifecycle — attestations live only on the feature branch and die when it is squash-merged.

## No `.gitignore`

`attestations/` is **intentionally not** in `.gitignore`. The contributor commits the attestation next to the change. The branch (with its attestation) gets squashed into the target branch on merge — the attestation is part of the audit trail until then. The user explicitly rejected .gitignore reasoning: "if we add onto .gitignore we lose traceability."

## Body schema

The Markdown body following the frontmatter is the consolidated review report: severity-grouped (BLOCK → WARN → INFO → OUTCOME_GAP → Drift → Reviewer status). Each finding carries `**Severity:**`, `**File:**`, `**Evidence:**`, `**Issue:**`, `**Fix:**`. Same shape as today's merge-check report body.
