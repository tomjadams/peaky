# Step 2.7 — incremental reviewer reuse

The planner decides which reviewers still need to run and which cached APPROVEs can be reused. This reference covers the cache policy, run discipline, focus hints, the Hollow-APPROVE guard, per-reviewer diff slicing, and the `record` invocation.

## Cache policy

- **Zero-delta re-runs are no-ops.** The plan's `zero_delta` field is `true` when every cached entry was recorded at the current HEAD and nothing is in the RUN bucket. When you see `zero_delta: true`, **do not dispatch any reviewers** — the re-run costs seconds, not minutes. Use this to short-circuit re-runs from frustration or redundant `/merge-check` invocations.
- Reuse only cached `APPROVE` results with the exact same reviewer fingerprint.
- A fingerprint includes the reviewer droid file, routing config, criteria text, and the changed files relevant to that reviewer. Attestation-only changes are ignored.
- BLOCK/WARN/NEEDS_FIX results are never reusable; after fixing them, rerun that reviewer.
- During auto-fix loops, dispatch only `PLAN_JSON.run` plus any reviewer whose domain you knowingly touched.
- Attestation-only changes use the fast path: validate the attestation schema/SHA and skip reviewer dispatch unless `--force-full` is set. **Never** pass `--force-full` on an attestation-only commit — let the fast path skip dispatch.
- Docs-only changes route to docs/outcome reviewers by fingerprint. During iteration, the security floor is scoped by its triggers and runs only when docs affect security, CI gate semantics, attestation semantics, or security policy files.
- **`always` droids (the security floor) are scoped by their own `triggers` during iteration** (`force_full=False`), so a fix outside their triggers no longer changes their fingerprint and they reuse their cached APPROVE. At the `--force-full` stamp the floor re-expands to the full non-attestation diff — the anti-forgery guarantee that no file escapes the floor at the stamp is preserved.
- If the outcome runner is currently misbehaving (e.g. returning a tool-state artifact), pass `--skip-outcome-runner <name>` so the planner emits `outcome_skipped` metadata and the runner is never dispatched. The audit trail stays explicit, the wall clock stays low.

## Run discipline

The single biggest wall-clock waste is re-running reviewers in full after every small fix. We follow this discipline:

1. **Run incremental** (no `--force-full`) during the fix loop. The planner reuses cached APPROVEs whose fingerprints haven't changed; only reviewers whose inputs actually changed are dispatched.
2. **Batch findings.** Gather all reviewers' findings from one run, fix them together, then run once — do not fix one reviewer's finding and immediately re-run. Each `/merge-check` invocation dispatches the full `PLAN_JSON.run` set, so N single-finding rounds cost N× the dispatch wall clock.
3. **Use `--force-full` exactly once**, for the final pre-merge stamp. This is the verified-final pass that re-expands the `always` floor to the full diff and refuses APPROVE unless every reviewer has a matching cached APPROVE at that HEAD.
4. **Never** pass `--force-full` on an attestation-only commit (let the fast path skip dispatch).
5. **Bank WARN/INFO as follow-ups** rather than looping to eliminate every one. Converge on zero BLOCK; WARN and INFO are advisory, not blocking.

## Focus hints at the stamp

The plan JSON carries a `focus_hints` map for each RUN-bucket reviewer: `focus` (files changed since the reviewer's last cached APPROVE) and `unchanged` (the rest of its relevant set). No prior APPROVE → `focus` = all relevant files. Inject this into the droid prompt as advisory context:

> Focus hint: `<N>` of `<M>` relevant files changed since your last APPROVE. Focus on the changed files; the unchanged files are byte-identical to what you already approved. Your verdict still covers all `<M>` files — this is attention guidance, not a scope reduction. If in doubt, review everything.

The hint is **never** part of the fingerprint — the stamp fingerprint covers the full relevant set regardless. Worst case (a droid ignores it) equals today: the reviewer sees everything. The hint only saves wall-clock by directing attention to the delta.

## Hollow-APPROVE guard

When recording a reviewer's verdict, pass `--tool-use-count <N>` to `merge-check-plan record`. An APPROVE with zero tool uses (no file reads, no commands) is rejected as REVIEWER_FAILURE — a degraded droid that rubber-stamps without inspecting the diff cannot enter the cache. **At the `--force-full` stamp**, `--tool-use-count` is **mandatory**: omitting it fails closed (a missing count at the stamp is itself a REVIEWER_FAILURE). During iteration, `None` is tolerated for backward compatibility. The count MUST be the reviewer's real, observed tool-call total from its execution result, not a guessed value; a fabricated count defeats the guard. Re-dispatch any reviewer with 0 tool uses before recording its verdict.

## Per-reviewer diff slicing

The single biggest per-reviewer cost is the subagent re-reading a multi-thousand-line diff that mostly does not concern it. Before dispatching reviewer `X`, ask the planner for that reviewer's relevant files and pass **only** the scoped diff:

```bash
SCOPED_FILES="$(git diff --name-only "$BASE"...HEAD | $MC merge-check-plan slice \
  --droids-dir "$($MC merge-check-config --get droids_dir)" \
  --reviewer "$X")"
if [ -n "$SCOPED_FILES" ]; then
  SCOPED_DIFF="$(printf '%s\n' "$SCOPED_FILES" | xargs git diff "$BASE"...HEAD --)"
else
  SCOPED_DIFF="$(git diff "$BASE"...HEAD)"   # empty slice: full diff (e.g. always floor at force-full)
fi
```

Pass `$SCOPED_DIFF` (and only that) to the reviewer subagent. The fingerprint already uses the same glob rule, so a sliced dispatch stays consistent with the planner's routing — no reviewer scope drift. Halving or quartering the diff input commonly cuts the reviewer's wall clock and token spend in proportion; the planner's `relevant_file_counts` field exposes the size of each slice so the orchestrator can decide which reviewers to slice most aggressively.

## Record verdict

After each reviewer returns `APPROVE`, record it:

```bash
git diff --name-only "$BASE"...HEAD | $MC merge-check-plan record \
  --droids-dir "$($MC merge-check-config --get droids_dir)" \
  --with-outcome \
  --criteria "$CRITERIA" \
  --reviewer "$NAME" \
  --fingerprint "$FINGERPRINT_FROM_PLAN_JSON" \
  --verdict APPROVE \
  --head "$(git rev-parse HEAD)" \
  --summary "$FIRST_LINE" \
  --elapsed-s "$REVIEWER_ELAPSED_S" \
  --dispatch-started-at "$DISPATCH_STARTED_AT" \
  --tool-use-count "$TOOL_USE_COUNT"
```

When `--dispatch-started-at` (the ISO-8601 UTC timestamp when this reviewer was invoked) is provided, the planner computes the real wall-clock from dispatch to record and stores it as the authoritative timing. This replaces orchestrator-supplied `--elapsed-s` estimates with planner-measured values; `--elapsed-s` stays as a fallback when the dispatch timestamp is unavailable.

The plan JSON also carries a `record_invocation` template that includes every required flag, including `--dispatch-started-at`, so the orchestrator can build the actual `record` command without forgetting the G6/G7 field.
