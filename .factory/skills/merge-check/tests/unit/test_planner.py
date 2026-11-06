"""Unit tests for the reviewer planner (run/reuse/skip + fast paths).

The git-backed record/verify tests live in ``tests/integration/test_git_backed.py``;
cache persistence tests live in ``tests/unit/test_persistence.py``.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from merge_check.errors import MergeCheckError
from merge_check.models import MergeCheckSpec
from merge_check.persistence import KEY_FINGERPRINT, KEY_HEAD, KEY_VERDICT
from merge_check.planner import (
    _BUCKET_REUSE,
    REASON_CACHED_APPROVE,
    REASON_DOCS_ONLY,
    REASON_FORCE_FULL,
    REASON_OUTCOME_SKIPPED,
    PlanRequest,
    _strategy_cached_approve,
    build_plan,
    can_skip_on_no_relevant_files,
    is_stamp_pass,
    reviewer_files,
    validate_attestation_fast_path,
)

_FAST_PATH_BODY = "---\nattestation:\n  commit_sha: {sha}\n  verdict: APPROVE\n---\n# body\n"
_VALID_SHA = "abc1234567890abcdef1234567890abcdef12345"


class TestReviewerFiles:
    def test_excludes_attestation_files_for_non_verifier(self) -> None:
        # GIVEN a change touching an attestation and a source file
        # WHEN computing a trigger-routed reviewer's files
        # THEN attestations are excluded and matching source is included
        spec = MergeCheckSpec(triggers=["**/*.py"])
        files = reviewer_files(
            "python-reviewer", spec, ["attestations/mr-1.md", "pkg/x.py"], with_outcome=False
        )
        assert files == ["pkg/x.py"]

    def test_always_droid_sees_full_diff_at_force_full_stamp(self) -> None:
        # GIVEN the security-floor shape: always=True AND explicit triggers
        # WHEN computing its files at the force-full stamp (force_full=True)
        # THEN it sees the WHOLE non-attestation diff — `always` wins over `triggers`,
        #      so the floor is never scoped away (the forge-an-APPROVE hole stays closed)
        spec = MergeCheckSpec(triggers=["**/*.py"], always=True)
        files = reviewer_files(
            "security-reviewer",
            spec,
            ["pkg/x.py", ".factory/merge-check.yml"],
            with_outcome=False,
            force_full=True,
        )
        assert files == ["pkg/x.py", ".factory/merge-check.yml"]

    def test_always_droid_scoped_by_triggers_during_iteration(self) -> None:
        # GIVEN the security-floor shape: always=True AND explicit triggers
        # WHEN computing its files during iteration (force_full=False)
        # THEN it is routed by its triggers exactly like a normal reviewer — a fix
        #      outside its triggers no longer changes its fingerprint, so it reuses
        #      its cached APPROVE instead of re-probing the whole diff
        spec = MergeCheckSpec(triggers=["**/*.py"], always=True)
        files = reviewer_files(
            "security-reviewer",
            spec,
            ["pkg/x.py", ".factory/merge-check.yml"],
            with_outcome=False,
            force_full=False,
        )
        assert files == ["pkg/x.py"]

    def test_always_droid_with_no_triggers_returns_empty_during_iteration(self) -> None:
        # GIVEN an always-floor droid with NO triggers (the conftest fixture shape)
        # WHEN computing its files during iteration (force_full=False)
        # THEN it returns an empty list — no triggers to match, so it reuses its
        #      cached APPROVE via the no-relevant-files fast path
        spec = MergeCheckSpec(always=True)
        files = reviewer_files(
            "security-reviewer",
            spec,
            ["pkg/x.py", ".factory/merge-check.yml"],
            with_outcome=False,
            force_full=False,
        )
        assert files == []

    def test_always_droid_with_no_triggers_sees_full_diff_at_stamp(self) -> None:
        # GIVEN an always-floor droid with NO triggers
        # WHEN computing its files at the force-full stamp (force_full=True)
        # THEN it sees the full non-attestation diff (the floor always wins at stamp)
        spec = MergeCheckSpec(always=True)
        files = reviewer_files(
            "security-reviewer",
            spec,
            ["pkg/x.py", ".factory/merge-check.yml"],
            with_outcome=False,
            force_full=True,
        )
        assert files == ["pkg/x.py", ".factory/merge-check.yml"]

    def test_verifier_with_outcome_sees_all_non_attestation_files(self) -> None:
        # GIVEN a verifier-role reviewer with no triggers and outcome active
        # WHEN computing its files over a mixed change set
        # THEN it sees every non-attestation file (ignoring triggers) but never attestations
        spec = MergeCheckSpec(triggers=[])
        files = reviewer_files(
            "outcome-verifier",
            spec,
            ["attestations/mr-1.md", "pkg/x.py", "docs/readme.md"],
            with_outcome=True,
        )
        assert files == ["pkg/x.py", "docs/readme.md"]


class TestCanSkip:
    def test_non_always_no_triggers_is_skippable(self) -> None:
        # GIVEN a reviewer with no triggers and not on the floor
        # WHEN checking skip eligibility
        # THEN it may be skipped when it has no relevant files
        assert can_skip_on_no_relevant_files("python-reviewer", MergeCheckSpec()) is True

    def test_always_droid_is_never_skippable_at_force_full_stamp(self) -> None:
        # GIVEN the security-floor shape: always=True AND explicit triggers
        # WHEN checking skip eligibility at the force-full stamp (force_full=True)
        # THEN it is never skippable — the floor must run at the stamp
        assert (
            can_skip_on_no_relevant_files(
                "security-reviewer",
                MergeCheckSpec(triggers=["**/*.py"], always=True),
                force_full=True,
            )
            is False
        )

    def test_always_droid_is_skippable_during_iteration(self) -> None:
        # GIVEN the security-floor shape: always=True AND explicit triggers
        # WHEN checking skip eligibility during iteration (force_full=False)
        # THEN it is skippable like any reviewer — if its trigger-routed file set
        #      is empty, it may reuse its cached APPROVE instead of re-probing
        assert (
            can_skip_on_no_relevant_files(
                "security-reviewer",
                MergeCheckSpec(triggers=["**/*.py"], always=True),
                force_full=False,
            )
            is True
        )

    def test_always_droid_with_no_triggers_is_skippable_during_iteration(self) -> None:
        # GIVEN an always-floor droid with NO triggers (the conftest fixture shape)
        # WHEN checking skip eligibility during iteration (force_full=False)
        # THEN it is skippable — no triggers means no relevant files, so it reuses
        assert (
            can_skip_on_no_relevant_files(
                "security-reviewer",
                MergeCheckSpec(always=True),
                force_full=False,
            )
            is True
        )

    def test_verifier_is_never_skippable(self) -> None:
        # GIVEN a verifier-role reviewer
        # WHEN checking skip eligibility
        # THEN it is never skippable
        assert can_skip_on_no_relevant_files("outcome-verifier", MergeCheckSpec()) is False


class TestAttestationFastPath:
    def test_accepts_well_formed_attestation(self, tmp_path: Path) -> None:
        # GIVEN a well-formed attestation under attestations/
        # WHEN validating the fast path
        # THEN it passes without error
        (tmp_path / "attestations").mkdir()
        (tmp_path / "attestations" / "mr-1.md").write_text(_FAST_PATH_BODY.format(sha=_VALID_SHA))
        validate_attestation_fast_path(["attestations/mr-1.md"], root=tmp_path)

    def test_rejects_path_traversal(self, tmp_path: Path) -> None:
        # GIVEN an attestation path that climbs out of the repo
        # WHEN validating
        # THEN it fails closed
        with pytest.raises(MergeCheckError, match="inside the project"):
            validate_attestation_fast_path(["attestations/../../etc/passwd"], root=tmp_path)

    def test_rejects_missing_commit_sha(self, tmp_path: Path) -> None:
        # GIVEN an attestation with a verdict but no commit_sha
        # WHEN validating
        # THEN it fails closed
        (tmp_path / "attestations").mkdir()
        (tmp_path / "attestations" / "mr-1.md").write_text(
            "---\nattestation:\n  verdict: APPROVE\n---\n# body\n"
        )
        with pytest.raises(MergeCheckError, match="commit_sha"):
            validate_attestation_fast_path(["attestations/mr-1.md"], root=tmp_path)

    @pytest.mark.parametrize(
        ("body", "match"),
        [
            ("attestation:\n  commit_sha: not-hex\n  verdict: APPROVE\n", "commit_sha"),
            ("attestation:\n  commit_sha: 123456789\n  verdict: APPROVE\n", "commit_sha"),
            ("attestation:\n  commit_sha: " + "f" * 41 + "\n  verdict: APPROVE\n", "commit_sha"),
        ],
    )
    def test_rejects_malformed_commit_sha(self, tmp_path: Path, body: str, match: str) -> None:
        # GIVEN an attestation whose commit_sha is non-hex, wrong length, or malformed
        # WHEN validating the fast path
        # THEN it fails closed with the same diagnostic as the missing-sha case
        (tmp_path / "attestations").mkdir()
        (tmp_path / "attestations" / "mr-1.md").write_text(f"---\n{body}---\n")
        with pytest.raises(MergeCheckError, match=match):
            validate_attestation_fast_path(["attestations/mr-1.md"], root=tmp_path)

    @pytest.mark.parametrize(
        ("verdict", "match"),
        [
            ("", "verdict"),
            ("approved", "verdict"),  # lowercase miss must still fail
            ("OK", "verdict"),  # not in the enumerated verdict set
            ("REJECTED", "verdict"),
        ],
    )
    def test_rejects_invalid_or_missing_verdict(
        self, tmp_path: Path, verdict: str, match: str
    ) -> None:
        # GIVEN an attestation whose verdict is missing or not in {APPROVE, NEEDS_FIX, BLOCK}
        # WHEN validating the fast path
        # THEN it fails closed (verdict membership matters — cannot silently stamp)
        (tmp_path / "attestations").mkdir()
        verdict_line = f"  verdict: {verdict}\n" if verdict else ""
        body = f"attestation:\n  commit_sha: {_VALID_SHA}\n{verdict_line}---\n"
        (tmp_path / "attestations" / "mr-1.md").write_text(f"---\n{body}")
        with pytest.raises(MergeCheckError, match=match):
            validate_attestation_fast_path(["attestations/mr-1.md"], root=tmp_path)


class TestBuildPlan:
    def _request(self, droids_dir: Path, tmp_path: Path, **kw: object) -> PlanRequest:
        return PlanRequest(droids_dir=droids_dir, cache_path=tmp_path / "cache.json", **kw)  # type: ignore[arg-type]

    def test_force_full_runs_all_and_reuses_none(self, droids_dir: Path, tmp_path: Path) -> None:
        # GIVEN a force-full request
        # WHEN building the plan
        # THEN every reviewer runs and the reuse list is empty
        request = self._request(droids_dir, tmp_path, with_outcome=True, all_=True, force_full=True)
        plan = build_plan(request, ["pkg/x.py"])
        assert plan["reuse"] == []
        assert "python-reviewer" in plan["run"]

    def test_force_full_blocks_cached_reuse(self, droids_dir: Path, tmp_path: Path) -> None:
        # GIVEN a cache with an APPROVE for the security floor
        # WHEN building a force-full plan restricted to it
        # THEN the reviewer reruns rather than reusing the cached approval
        cache_path = tmp_path / "cache.json"
        cache_path.write_text(
            json.dumps(
                {
                    "schema_version": 2, "branch": "main",
                    "entries": {
                        "security-reviewer": {
                            KEY_FINGERPRINT: "stale",
                            KEY_VERDICT: "APPROVE",
                            KEY_HEAD: "1",
                        }
                    },
                }
            )
        )
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            only=["security-reviewer"],
            force_full=True,
        )
        plan = build_plan(request, ["pkg/x.py"])
        assert "security-reviewer" in plan["run"]
        assert plan["reasons"]["security-reviewer"] == REASON_FORCE_FULL

    def test_skip_outcome_runner_excludes_verifier(self, droids_dir: Path, tmp_path: Path) -> None:
        # GIVEN --skip-outcome-runner for the verifier
        # WHEN building the plan
        # THEN the verifier is neither run nor reused, and the skip is audited
        request = self._request(
            droids_dir,
            tmp_path,
            criteria="c",
            with_outcome=True,
            skip_outcome_runner=["outcome-verifier"],
        )
        plan = build_plan(request, ["pkg/x.py"])
        assert "outcome-verifier" not in plan["run"]
        assert plan["reasons"]["outcome-verifier"] == REASON_OUTCOME_SKIPPED
        assert plan["outcome_skip"]["outcome_skipped"] is True
        assert "outcome-verifier" in plan["outcome_skip"]["skipped_runners"]

    def test_docs_only_diff_reuses_the_verifier(self, droids_dir: Path, tmp_path: Path) -> None:
        # GIVEN a docs-only diff (every non-attestation file is .md) with outcome active
        # WHEN building the plan
        # THEN the verifier is reused on the docs-only fast path rather than re-run
        request = self._request(droids_dir, tmp_path, criteria="c", with_outcome=True)
        plan = build_plan(request, ["docs/guide.md"])
        assert "outcome-verifier" in plan["reuse"]
        assert plan["reasons"]["outcome-verifier"] == REASON_DOCS_ONLY

    def test_one_non_md_file_defeats_the_docs_only_fast_path(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN a diff that mixes a .md file with a .py file
        # WHEN building the plan with outcome active
        # THEN the docs-only fast path does not fire — the verifier is not reused for it
        request = self._request(droids_dir, tmp_path, criteria="c", with_outcome=True)
        plan = build_plan(request, ["docs/guide.md", "pkg/x.py"])
        assert plan["reasons"]["outcome-verifier"] != REASON_DOCS_ONLY
        assert "outcome-verifier" in plan["run"]

    def test_skip_outcome_runner_rejects_non_verifier(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN --skip-outcome-runner naming a non-verifier reviewer
        # WHEN building the plan
        # THEN it fails closed
        request = self._request(
            droids_dir, tmp_path, with_outcome=True, skip_outcome_runner=["python-reviewer"]
        )
        with pytest.raises(MergeCheckError, match="only accepts outcome droids"):
            build_plan(request, ["pkg/x.py"])

    def test_always_floor_reuses_during_iteration_when_triggers_miss(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN a diff confined to a file matching no reviewer's triggers
        # WHEN building an iteration plan (force_full=False)
        # THEN the always-floor is reused (no relevant files), not run
        request = self._request(droids_dir, tmp_path, only=["security-reviewer"])
        plan = build_plan(request, [".factory/merge-check.yml"])
        assert "security-reviewer" in plan["reuse"]
        assert plan["relevant_files"]["security-reviewer"] == []

    def test_always_floor_runs_at_force_full_even_when_triggers_miss(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN the same untriggered diff
        # WHEN building a force-full plan
        # THEN the always-floor runs (force-full forces RUN and the floor sees the full diff)
        request = self._request(droids_dir, tmp_path, only=["security-reviewer"], force_full=True)
        plan = build_plan(request, [".factory/merge-check.yml"])
        assert "security-reviewer" in plan["run"]
        assert plan["relevant_files"]["security-reviewer"] == [".factory/merge-check.yml"]

    def test_force_full_with_skip_outcome_runner_rejected(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN --force-full combined with --skip-outcome-runner
        # WHEN building the plan
        # THEN the planner rejects it (matching the attestation writer's gate)
        request = self._request(
            droids_dir,
            tmp_path,
            criteria="c",
            with_outcome=True,
            force_full=True,
            skip_outcome_runner=["outcome-verifier"],
        )
        with pytest.raises(MergeCheckError, match="non-skippable"):
            build_plan(request, ["pkg/x.py"])

    def test_focus_hints_first_stamp_all_focus(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN a force-full plan with no prior cached APPROVE
        # WHEN building the plan
        # THEN every RUN-bucket reviewer has focus = all relevant, unchanged = []
        request = self._request(
            droids_dir, tmp_path, with_outcome=True, force_full=True
        )
        plan = build_plan(request, ["pkg/x.py"])
        for reviewer in plan["run"]:
            hint = plan["focus_hints"][reviewer]
            assert hint["focus"] == plan["relevant_files"][reviewer]
            assert hint["unchanged"] == []

    def test_focus_hints_excluded_from_fingerprint(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN two plans with DIFFERENT cache states (one empty, one with a stale APPROVE)
        # but the same changed files and force_full setting
        # WHEN comparing fingerprints
        # THEN the fingerprints are identical — focus hints vary but the fingerprint
        #      input (relevant files + routing + criteria) does not
        cache_path = tmp_path / "cache.json"
        request_empty = self._request(
            droids_dir, tmp_path, with_outcome=True, force_full=True
        )
        plan_empty = build_plan(request_empty, ["pkg/x.py"])

        # Write a cache with a stale APPROVE (wrong SHA → different focus hint, same fingerprint)
        cache_path.write_text(
            json.dumps(
                {
                    "schema_version": 2, "branch": "main",
                    "entries": {
                        "python-reviewer": {
                            KEY_FINGERPRINT: "stale",
                            KEY_VERDICT: "APPROVE",
                            KEY_HEAD: "0" * 40,
                        }
                    },
                }
            )
        )
        request_stale = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            with_outcome=True,
            force_full=True,
        )
        plan_stale = build_plan(request_stale, ["pkg/x.py"])
        # Fingerprints must be identical — the cache state doesn't change the fingerprint input
        assert plan_empty["fingerprints"] == plan_stale["fingerprints"]
        # Focus hints differ (empty cache → all focus; stale cache → degrades to all focus
        # because the SHA is unreachable, but the point is the hints are computed AFTER)
        assert "focus_hints" in plan_empty
        assert "focus_hints" in plan_stale

    def test_focus_hints_only_contains_run_bucket_reviewers(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN an iteration plan where some reviewers reuse and others run
        # WHEN building the plan
        # THEN focus_hints only contains reviewers in the run bucket
        request = self._request(droids_dir, tmp_path, with_outcome=True)
        plan = build_plan(request, ["pkg/x.py"])
        assert set(plan["focus_hints"].keys()) == set(plan["run"])

    def test_focus_hints_degrade_when_prior_sha_unreachable(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN a cache with an APPROVE whose HEAD SHA is not a real git commit
        # WHEN building a force-full plan
        # THEN focus_hints degrades to focus = all relevant (worst case == today)
        cache_path = tmp_path / "cache.json"
        cache_path.write_text(
            json.dumps(
                {
                    "schema_version": 2, "branch": "main",
                    "entries": {
                        "python-reviewer": {
                            KEY_FINGERPRINT: "stale",
                            KEY_VERDICT: "APPROVE",
                            KEY_HEAD: "z" * 40,  # not a hex SHA → rejected by length check
                        }
                    },
                }
            )
        )
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            with_outcome=True,
            force_full=True,
        )
        plan = build_plan(request, ["pkg/x.py"])
        if "python-reviewer" in plan["focus_hints"]:
            hint = plan["focus_hints"]["python-reviewer"]
            assert hint["focus"] == plan["relevant_files"]["python-reviewer"]
            assert hint["unchanged"] == []

    def test_focus_hints_non_approve_cache_ignored(
        self, droids_dir: Path, tmp_path: Path
    ) -> None:
        # GIVEN a cache with a NEEDS_FIX verdict (not APPROVE)
        # WHEN building a force-full plan
        # THEN focus_hints treats it as no prior APPROVE (focus = all relevant)
        cache_path = tmp_path / "cache.json"
        cache_path.write_text(
            json.dumps(
                {
                    "schema_version": 2, "branch": "main",
                    "entries": {
                        "python-reviewer": {
                            KEY_FINGERPRINT: "stale",
                            KEY_VERDICT: "NEEDS_FIX",
                            KEY_HEAD: "0" * 40,
                        }
                    },
                }
            )
        )
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            with_outcome=True,
            force_full=True,
        )
        plan = build_plan(request, ["pkg/x.py"])
        if "python-reviewer" in plan["focus_hints"]:
            hint = plan["focus_hints"]["python-reviewer"]
            assert hint["focus"] == plan["relevant_files"]["python-reviewer"]
            assert hint["unchanged"] == []


class TestStampPassPredicate:
    def test_is_stamp_pass_returns_force_full(self) -> None:
        # GIVEN the force_full flag
        # WHEN calling is_stamp_pass
        # THEN it returns the flag value directly (True at stamp, False during iteration)
        assert is_stamp_pass(True) is True
        assert is_stamp_pass(False) is False

    def test_stamp_files_superset_of_iteration_files(self) -> None:
        # PROPERTY: for any reviewer spec, the files at force_full=True
        # are a superset of the files at force_full=False. This is the
        # fingerprint-coverage invariant the writer relies on.
        changed = ["pkg/x.py", ".factory/merge-check.yml", "docs/guide.md"]
        specs = [
            MergeCheckSpec(triggers=["**/*.py"], always=True),
            MergeCheckSpec(always=True),
            MergeCheckSpec(triggers=["**/*.py"]),
            MergeCheckSpec(triggers=["**/*.md"]),
            MergeCheckSpec(),
        ]
        for spec in specs:
            stamp_files = set(
                reviewer_files("x", spec, changed, with_outcome=False, force_full=True)
            )
            iter_files = set(
                reviewer_files("x", spec, changed, with_outcome=False, force_full=False)
            )
            assert iter_files <= stamp_files, (
                f"iteration files {iter_files} not subset of stamp files {stamp_files} "
                f"for spec {spec}"
            )


class TestReviewerStrategyCaching:
    """Behaviour-shaped tests for the per-reviewer reuse-strategy primitives.

    The seven routing strategies live in :mod:`merge_check.planner` and are
    composed by `_classify_reviewer`. Each strategy is a small function that
    either returns ``(bucket, reason)`` or defers; this suite asserts the
    preconditions that a missing/weak test would let a regression sink through
    (e.g. the discrimination sensor's "cache reuse fires on NEEDS_FIX"
    mutation).
    """

    @staticmethod
    def _cache_entry(verdict: str, fingerprint: str) -> dict[str, str]:
        return {KEY_VERDICT: verdict, KEY_FINGERPRINT: fingerprint, KEY_HEAD: ""}

    def test_strategy_cached_approve_fires_only_on_approve_with_matching_fingerprint(
        self, tmp_path: Path
    ) -> None:
        # GIVEN a cache entry that exactly matches (verdict=APPROVE, fp=THIS)
        # WHEN the cached-approve strategy is evaluated
        # THEN it returns ``(_BUCKET_REUSE, REASON_CACHED_APPROVE)``
        this_fp = "abc1234567890abcdef1234567890abcdef12345aa"
        verdict = _strategy_cached_approve(self._cache_entry("APPROVE", this_fp), this_fp)
        assert verdict is not None
        bucket, reason = verdict
        assert (bucket, reason) == (_BUCKET_REUSE, REASON_CACHED_APPROVE)

    def test_strategy_cached_approve_rejects_non_approve_verdict(self, tmp_path: Path) -> None:
        # GIVEN the same cache row but verdict=NEEDS_FIX (or BLOCK) and the
        # SAME fingerprint (so the gates are isolated one at a time)
        # WHEN the cached-approve strategy is evaluated
        # THEN it returns ``None`` — the strategy defers so the planner
        #      falls through to the run-or-fingerprint-changed strategy.
        #      A regression that relaxed the verdict check would flip this
        #      to a reuse and the suite would catch it via the discrimination
        #      sensor's "NEEDS_FIX gate" mutation.
        this_fp = "abc1234567890abcdef1234567890abcdef12345aa"
        for bad_verdict in ("NEEDS_FIX", "BLOCK"):
            assert (
                _strategy_cached_approve(self._cache_entry(bad_verdict, this_fp), this_fp) is None
            )

    def test_strategy_cached_approve_rejects_fingerprint_mismatch(self, tmp_path: Path) -> None:
        # GIVEN a cache row with verdict=APPROVE but a different fingerprint
        # WHEN the cached-approve strategy is evaluated
        # THEN it returns ``None`` — the cached APPROVE was earned against a
        #      different diff and a reuse would falsify the review.
        cached_fp = "abc1234567890abcdef1234567890abcdef12345aa"
        live_fp = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef02"
        assert _strategy_cached_approve(self._cache_entry("APPROVE", cached_fp), live_fp) is None

    def test_strategy_cached_approve_rejects_missing_cached_head(self, tmp_path: Path) -> None:
        # GIVEN a cache row with a real current HEAD but an empty/missing cached head
        # WHEN the cached-approve strategy is evaluated with a real current_head
        # THEN it returns ``None`` — a corrupted/partial entry must not be reused
        #      because it cannot prove lineage (G0).
        this_fp = "abc1234567890abcdef1234567890abcdef12345aa"
        entry = self._cache_entry("APPROVE", this_fp)
        assert _strategy_cached_approve(entry, this_fp, current_head="0" * 40) is None


class TestPlanOutput:
    def test_plan_includes_record_invocation_template_with_dispatch_time(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # GIVEN a plan built for any diff
        # WHEN the orchestrator reads the JSON output
        # THEN it carries a record_invocation template that includes the
        #      G6/G7 --dispatch-started-at flag
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        monkeypatch.setattr(
            "merge_check.core.gitio.current_head", lambda: "0" * 40
        )
        request = PlanRequest(
            droids_dir=tmp_path,
            cache_path=tmp_path / "cache.json",
            repo_root=tmp_path,
        )
        plan = build_plan(request, [])
        assert "--dispatch-started-at" in plan["record_invocation"]

    def test_plan_emits_run_dir_under_factory_runs_with_branch_slug(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # GIVEN a plan built on branch "feat/my-branch"
        # WHEN the orchestrator reads the run_dir field
        # THEN it is under .factory/merge-check-runs/<branch-slug>/, not /tmp
        from merge_check.constants import DEFAULT_RUNS_DIR
        from merge_check.core.gitio import branch_slug

        monkeypatch.setattr(
            "merge_check.planner.current_branch", lambda: "feat/my-branch"
        )
        monkeypatch.setattr(
            "merge_check.core.gitio.current_head", lambda: "0" * 40
        )
        request = PlanRequest(
            droids_dir=tmp_path,
            cache_path=tmp_path / "cache.json",
            repo_root=tmp_path,
        )
        plan = build_plan(request, [])
        expected_slug = branch_slug("feat/my-branch")
        expected_dir = str(tmp_path / DEFAULT_RUNS_DIR / expected_slug)
        assert plan["run_dir"] == expected_dir, (
            f"run_dir must be under .factory/merge-check-runs/<branch-slug>/, "
            f"got {plan['run_dir']}"
        )
        assert "/tmp" not in plan["run_dir"], "run_dir must not use /tmp"
