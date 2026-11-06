"""Integration tests that exercise real git state via the ``git_repo`` fixture.

These are deliberately separated from ``tests/unit`` (which conftest promises is
free of real git/network I/O): they run actual ``git`` to validate the cache
record/verify round-trip, the anti-forgery attestation writer, and the sensor's
worktree isolation against a throwaway repository.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from merge_check.attestation import AttestationRequest, write_attestation
from merge_check.constants import (
    KEY_BRANCH,
    KEY_CLASSIFY_DONE,
    KEY_CLASSIFY_SKIP_REASON,
    KEY_TOOL_USE_COUNT,
)
from merge_check.core.frontmatter import parse_frontmatter
from merge_check.core.gitio import current_branch, current_head, merge_base
from merge_check.env import env_from_mapping
from merge_check.errors import MergeCheckError
from merge_check.models import OverrideRequest, Verdict
from merge_check.persistence import KEY_ENTRIES, KEY_FINGERPRINT, KEY_HEAD, KEY_VERDICT, read_cache
from merge_check.planner import (
    PlanRequest,
    build_plan,
    record_verdict,
)
from merge_check.sensor import (
    ERRORED,
    Mutation,
    SensorSpec,
    _run_one_mutation,
    reset_worktree_state,
    run_sensor,
)


def _commit_change(repo: Path, name: str, content: str) -> None:
    """Add and commit a file inside ``repo``."""
    (repo / name).parent.mkdir(parents=True, exist_ok=True)
    (repo / name).write_text(content, encoding="utf-8")
    subprocess.run(["git", "add", name], cwd=str(repo), check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", name], cwd=str(repo), check=True, capture_output=True
    )


def _approve_floor(
    droids_dir: Path, repo: Path, changed: list[str], *, force_full: bool = True
) -> Path:
    """Record an APPROVE for the always-floor reviewer; return the cache path.

    Parameters
    ----------
    droids_dir : Path
        Directory of reviewer droids.
    repo : Path
        Git repository root.
    changed : list[str]
        Changed files for the plan.
    force_full : bool, optional
        Whether to record with ``force_full`` (the default ``True`` matches the
        stamp path; pass ``False`` for iteration-mode tests).
    """
    cache_path = repo / "cache.json"
    request = PlanRequest(
        droids_dir=droids_dir,
        cache_path=cache_path,
        only=["security-reviewer"],
        force_full=force_full,
    )
    fingerprint = build_plan(request, changed)["fingerprints"]["security-reviewer"]
    record_verdict(
        request,
        changed,
        reviewer="security-reviewer",
        fingerprint=fingerprint,
        verdict=Verdict.APPROVE,
        head=current_head(),
        tool_use_count=5 if force_full else None,
        dispatch_started_at="2026-01-01T00:00:00Z" if force_full else None,
    )
    return cache_path


class TestRecordVerdict:
    def _request(self, droids_dir: Path, repo: Path) -> PlanRequest:
        return PlanRequest(
            droids_dir=droids_dir, cache_path=repo / "cache.json", only=["security-reviewer"]
        )

    def test_approve_is_stored_and_reused(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN a recorded APPROVE for the security floor at HEAD
        # WHEN reading the cache back
        # THEN the reviewer's approval is stored with its fingerprint
        request = self._request(droids_dir, git_repo)
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.APPROVE,
            head=head,
        )
        entry = read_cache(request.cache_path)[KEY_ENTRIES]["security-reviewer"]
        assert entry[KEY_VERDICT] == "APPROVE"
        assert entry[KEY_FINGERPRINT] == fingerprint

    def test_non_approve_pops_any_existing_entry(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN an existing APPROVE that is later re-recorded as BLOCK
        # WHEN recording the BLOCK
        # THEN the reviewer is removed so a later verifier sees the failure
        request = self._request(droids_dir, git_repo)
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.APPROVE,
            head=head,
        )
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.BLOCK,
            head=head,
        )
        assert "security-reviewer" not in read_cache(request.cache_path)[KEY_ENTRIES]

    def test_rejects_stale_head(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN a record call whose --head does not match git HEAD
        # WHEN recording
        # THEN it fails closed
        request = self._request(droids_dir, git_repo)
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        with pytest.raises(MergeCheckError, match="HEAD"):
            record_verdict(
                request,
                ["pkg/x.py"],
                reviewer="security-reviewer",
                fingerprint=fingerprint,
                verdict=Verdict.APPROVE,
                head="0" * 40,
            )

    def test_rejects_mismatched_fingerprint(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN a record call with a fingerprint that does not match the plan
        # WHEN recording
        # THEN it fails closed
        request = self._request(droids_dir, git_repo)
        with pytest.raises(MergeCheckError, match="fingerprint"):
            record_verdict(
                request,
                ["pkg/x.py"],
                reviewer="security-reviewer",
                fingerprint="forged",
                verdict=Verdict.APPROVE,
                head=current_head(),
            )

    def test_accepts_approve_with_tool_uses(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a reviewer returning APPROVE with >0 tool uses
        # WHEN recording the verdict
        # THEN it is stored normally
        request = self._request(droids_dir, git_repo)
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.APPROVE,
            head=head,
            tool_use_count=5,
        )
        entry = read_cache(request.cache_path)[KEY_ENTRIES]["security-reviewer"]
        assert entry[KEY_VERDICT] == "APPROVE"

    def test_tool_use_count_none_skips_hollow_check(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a reviewer returning APPROVE with tool_use_count=None (backward compat)
        # WHEN recording the verdict
        # THEN it is stored normally (the hollow check is skipped)
        request = self._request(droids_dir, git_repo)
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.APPROVE,
            head=head,
        )
        entry = read_cache(request.cache_path)[KEY_ENTRIES]["security-reviewer"]
        assert entry[KEY_VERDICT] == "APPROVE"

    @pytest.mark.parametrize("bad_count", [0, -1, -5])
    def test_hollow_approve_rejected_for_non_positive_tool_uses(
        self, droids_dir: Path, git_repo: Path, bad_count: int
    ) -> None:
        # GIVEN a reviewer returning APPROVE with a non-positive tool_use_count
        # WHEN recording the verdict
        # THEN it is rejected as hollow (zero or negative = no evidence of work)
        request = self._request(droids_dir, git_repo)
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        with pytest.raises(MergeCheckError, match="hollow approval"):
            record_verdict(
                request,
                ["pkg/x.py"],
                reviewer="security-reviewer",
                fingerprint=fingerprint,
                verdict=Verdict.APPROVE,
                head=head,
                tool_use_count=bad_count,
            )

    def test_stamp_rejects_approve_without_tool_use_count(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a force-full stamp recording an APPROVE without --tool-use-count
        # WHEN recording the verdict
        # THEN it is rejected — absence fails closed at the stamp
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=git_repo / "cache.json",
            only=["security-reviewer"],
            force_full=True,
        )
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        with pytest.raises(MergeCheckError, match="stamp"):
            record_verdict(
                request,
                ["pkg/x.py"],
                reviewer="security-reviewer",
                fingerprint=fingerprint,
                verdict=Verdict.APPROVE,
                head=head,
            )
        assert "security-reviewer" not in read_cache(request.cache_path)[KEY_ENTRIES]

    def test_stamp_rejects_approve_with_zero_tool_use_count(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a force-full stamp recording an APPROVE with 0 tool uses
        # WHEN recording the verdict
        # THEN it is rejected as hollow at the stamp
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=git_repo / "cache.json",
            only=["security-reviewer"],
            force_full=True,
        )
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        with pytest.raises(MergeCheckError, match="hollow"):
            record_verdict(
                request,
                ["pkg/x.py"],
                reviewer="security-reviewer",
                fingerprint=fingerprint,
                verdict=Verdict.APPROVE,
                head=head,
                tool_use_count=0,
            )

    def test_stamp_accepts_approve_with_positive_tool_use_count(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a force-full stamp recording an APPROVE with a positive tool count
        # WHEN recording the verdict
        # THEN it is stored normally — the guard passes at the stamp
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=git_repo / "cache.json",
            only=["security-reviewer"],
            force_full=True,
        )
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.APPROVE,
            head=head,
            tool_use_count=5,
        )
        entry = read_cache(request.cache_path)[KEY_ENTRIES]["security-reviewer"]
        assert entry[KEY_VERDICT] == "APPROVE"

    def test_stamp_non_approve_ignores_tool_use_count(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a force-full stamp recording a BLOCK with no tool_use_count
        # WHEN recording the verdict
        # THEN it succeeds — the hollow/mandatory guard only applies to APPROVE
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=git_repo / "cache.json",
            only=["security-reviewer"],
            force_full=True,
        )
        head = current_head()
        fingerprint = build_plan(request, ["pkg/x.py"])["fingerprints"]["security-reviewer"]
        record_verdict(
            request,
            ["pkg/x.py"],
            reviewer="security-reviewer",
            fingerprint=fingerprint,
            verdict=Verdict.BLOCK,
            head=head,
        )
        assert "security-reviewer" not in read_cache(request.cache_path)[KEY_ENTRIES]

    def test_focus_hint_splits_changed_vs_unchanged_at_stamp(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a reviewer with a prior APPROVE at an earlier commit, then more
        #       files are committed before the force-full stamp
        # WHEN building a force-full plan
        # THEN focus_hints splits relevant files into changed (focus) and unchanged
        cache_path = git_repo / "cache.json"
        # Commit 1: initial change (reviewer approves this)
        _commit_change(git_repo, "pkg/a.py", "a = 1\n")
        _commit_change(git_repo, "pkg/b.py", "b = 1\n")
        request_iter = PlanRequest(
            droids_dir=droids_dir, cache_path=cache_path, only=["python-reviewer"]
        )
        plan_iter = build_plan(request_iter, ["pkg/a.py", "pkg/b.py"])
        fp = plan_iter["fingerprints"]["python-reviewer"]
        record_verdict(
            request_iter,
            ["pkg/a.py", "pkg/b.py"],
            reviewer="python-reviewer",
            fingerprint=fp,
            verdict=Verdict.APPROVE,
            head=current_head(),
        )
        # Commit 2: only pkg/a.py changes (pkg/b.py stays the same)
        _commit_change(git_repo, "pkg/a.py", "a = 2\n")

        # Build a force-full plan — python-reviewer should run again
        request_stamp = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            only=["python-reviewer"],
            force_full=True,
        )
        plan = build_plan(request_stamp, ["pkg/a.py", "pkg/b.py"])
        assert "python-reviewer" in plan["run"]
        hint = plan["focus_hints"]["python-reviewer"]
        # pkg/a.py changed since the prior APPROVE; pkg/b.py did not
        assert "pkg/a.py" in hint["focus"]
        assert "pkg/b.py" in hint["unchanged"]
        # The fingerprint still covers both files (hint is advisory, not coverage)
        assert plan["relevant_files"]["python-reviewer"] == ["pkg/a.py", "pkg/b.py"]


class TestWriteAttestation:
    def test_refuses_when_reviewer_not_cached(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN a diff with no cached approval for the floor
        # WHEN writing a force-full attestation
        # THEN the writer REFUSES rather than stamping
        _commit_change(git_repo, "pkg/x.txt", "x\n")
        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
        )
        with pytest.raises(MergeCheckError, match="REFUSED"):
            write_attestation(
                request, "# report", cache_path=git_repo / "cache.json", root=git_repo
            )
        assert not (git_repo / "attestations" / "mr-1.md").exists()

    def test_override_requested_writes_needs_fix_when_reviewers_missing(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a diff with no cached approval AND an override_requested block
        #   AND classify has been run (G3: override requires prior classification)
        # WHEN writing a force-full attestation
        # THEN the writer records the override request with a NEEDS_FIX verdict
        #      instead of raising REFUSED — the gate verifies approval via API
        _commit_change(git_repo, "pkg/x.txt", "x\n")
        cache_path = git_repo / "cache.json"
        # G3: set classify_done so the override stamp is allowed
        from merge_check.persistence import cache_transaction, read_cache, write_cache
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_BRANCH] = current_branch()
            c[KEY_CLASSIFY_DONE] = True
            write_cache(cache_path, c)
        request = AttestationRequest(
            out_path="attestations/mr-override.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
            override_requested=OverrideRequest(
                reason="pre-existing findings in pkg/x.txt are out of scope",
                issue_ref=97,
            ),
        )
        write_attestation(
            request, "# report body", cache_path=cache_path, root=git_repo
        )
        written = parse_frontmatter(
            (git_repo / "attestations" / "mr-override.md").read_text()
        )["attestation"]
        assert written["verdict"] == "NEEDS_FIX"
        assert written["force_full"] is True
        assert written["override_requested"]["reason"] == (
            "pre-existing findings in pkg/x.txt are out of scope"
        )
        assert written["override_requested"]["issue_ref"] == 97

    def test_cve_still_closed_floor_covers_untriggered_file_at_stamp(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # CVE regression guard: a diff confined to a file matching NO reviewer's
        # triggers (e.g. .factory/merge-check.yml) must still be covered by the
        # always-floor at the force-full stamp. During iteration the floor is
        # scoped by its triggers (so it reuses its cached APPROVE for that file),
        # but at the stamp the floor sees the full diff and its fingerprint
        # changes — the writer REFUSES unless the floor was actually re-dispatched
        # at force-full. This proves the CVE (a stamp covering a file no reviewer
        # saw) stays closed at the stamp even though iteration scoping was relaxed.
        droids = tmp_path / "droids"
        droids.mkdir()
        # security-reviewer has always=True AND triggers that exclude .factory/merge-check.yml
        (droids / "security-reviewer.md").write_text(
            "---\nname: security-reviewer\nmerge_check:\n"
            "  triggers: ['**/*.py']\n  always: true\n---\n# security-reviewer\n",
            encoding="utf-8",
        )
        (droids / "python-reviewer.md").write_text(
            "---\nname: python-reviewer\nmerge_check:\n"
            "  triggers: ['**/*.py']\n---\n# python-reviewer\n",
            encoding="utf-8",
        )

        repo = tmp_path / "repo"
        repo.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=str(repo), check=True, capture_output=True)
        subprocess.run(
            ["git", "config", "user.email", "t@example.com"],
            cwd=str(repo),
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "T"], cwd=str(repo), check=True, capture_output=True
        )
        (repo / "seed.txt").write_text("seed\n", encoding="utf-8")
        subprocess.run(["git", "add", "seed.txt"], cwd=str(repo), check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-q", "-m", "seed"], cwd=str(repo), check=True, capture_output=True
        )
        # The only change is .factory/merge-check.yml — matches NO reviewer's triggers
        _commit_change(repo, ".factory/merge-check.yml", "foo: bar\n")
        monkeypatch.chdir(repo)

        # Step 1: during iteration (force_full=False), the floor has no relevant
        # files (.factory/merge-check.yml doesn't match **/*.py), so it reuses.
        iter_request = PlanRequest(
            droids_dir=droids, cache_path=repo / "cache.json", only=["security-reviewer"]
        )
        iter_plan = build_plan(iter_request, [".factory/merge-check.yml"])
        assert iter_plan["relevant_files"]["security-reviewer"] == []
        assert "security-reviewer" in iter_plan["reuse"]

        # Record the iteration APPROVE (fingerprint over empty trigger-matched set)
        iter_fp = iter_plan["fingerprints"]["security-reviewer"]
        record_verdict(
            iter_request,
            [".factory/merge-check.yml"],
            reviewer="security-reviewer",
            fingerprint=iter_fp,
            verdict=Verdict.APPROVE,
            head=current_head(),
        )

        # Step 2: at the force-full stamp, the floor sees the FULL diff including
        # .factory/merge-check.yml. The fingerprint changes, the cached APPROVE
        # no longer matches, and the writer REFUSES.
        stamp_request = AttestationRequest(
            out_path="attestations/mr-cve.md",
            base="HEAD~1",
            droids_dir=str(droids),
            force_full=True,
        )
        # Prove the fingerprint actually changed between iteration and stamp —
        # this is the load-bearing assertion that the CVE stays closed.
        stamp_plan = build_plan(
            PlanRequest(
                droids_dir=droids,
                cache_path=repo / "cache.json",
                only=["security-reviewer"],
                force_full=True,
            ),
            [".factory/merge-check.yml"],
        )
        stamp_fp = stamp_plan["fingerprints"]["security-reviewer"]
        assert stamp_fp != iter_fp, (
            "CVE regression: stamp fingerprint must differ from iteration "
            "fingerprint when the floor re-expands to the full diff"
        )
        assert stamp_plan["relevant_files"]["security-reviewer"] == [".factory/merge-check.yml"]
        with pytest.raises(MergeCheckError, match="REFUSED"):
            write_attestation(
                stamp_request, "# report", cache_path=repo / "cache.json", root=repo
            )
        assert not (repo / "attestations" / "mr-cve.md").exists()

    def test_writes_when_cache_is_complete(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN every plan reviewer has a matching cached APPROVE
        # WHEN writing a force-full attestation
        # THEN the file is written with the derived commit_sha and verdict
        _commit_change(git_repo, "pkg/x.txt", "x\n")
        cache_path = _approve_floor(droids_dir, git_repo, ["pkg/x.txt"])
        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
        )
        write_attestation(
            request,
            "# report",
            cache_path=cache_path,
            root=git_repo,
            generated_at="2026-01-01T00:00:00Z",
        )
        written = parse_frontmatter((git_repo / "attestations" / "mr-1.md").read_text())[
            "attestation"
        ]
        assert written["commit_sha"] == current_head()
        assert written["verdict"] == "APPROVE"
        assert written["force_full"] is True
        # reviewed_base records the merge-base the reviewers diffed against, so the
        # CI gate can verify the stamp covered the MR's full diff.
        assert written["reviewed_base"] == merge_base("HEAD~1", "HEAD")
        assert written["schema_version"] == 6

    def test_approve_requires_force_full(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN a complete cache but no --force-full
        # WHEN writing
        # THEN the writer refuses (the final stamp must be the verified-final pass)
        _commit_change(git_repo, "pkg/x.txt", "x\n")
        cache_path = _approve_floor(droids_dir, git_repo, ["pkg/x.txt"], force_full=False)
        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=False,
        )
        with pytest.raises(MergeCheckError, match="requires --force-full"):
            write_attestation(request, "# report", cache_path=cache_path, root=git_repo)

    def test_refuses_empty_diff_stamp(self, droids_dir: Path, git_repo: Path) -> None:
        # GIVEN a base that yields no reviewable files (e.g. base == HEAD)
        # WHEN writing a force-full attestation
        # THEN the writer refuses — an APPROVE stamp over zero reviewed files is illegitimate,
        #      closing the narrowed-base exploit where the roster collapses to the empty floor
        _commit_change(git_repo, "pkg/x.txt", "x\n")
        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD",
            droids_dir=str(droids_dir),
            force_full=True,
        )
        with pytest.raises(MergeCheckError, match="no reviewable"):
            write_attestation(
                request, "# report", cache_path=git_repo / "cache.json", root=git_repo
            )
        assert not (git_repo / "attestations" / "mr-1.md").exists()

    def test_refuses_when_roster_resolves_to_empty(
        self, droids_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # GIVEN a droid directory whose only droid is omitted (no roster match)
        # WHEN writing a force-full attestation (with criteria + outcome so the
        #      policy-gate short-circuits fire earlier than the cache check)
        # THEN the writer REFUSES on the empty roster rather than dropping every reviewer
        # The test creates a fresh sibling droid directory containing only a
        # non-matching droid, so the path-routed plan has zero reviewers.
        sibling = tmp_path / "other_droids"
        sibling.mkdir()
        (sibling / "go-reviewer.md").write_text(
            "---\nname: go-reviewer\nmerge_check:\n  triggers: ['**/*.go']\n---\n",
            encoding="utf-8",
        )
        repo = tmp_path / "empty_roster_repo"
        repo.mkdir()
        subprocess.run(["git", "init", "-q"], cwd=str(repo), check=True, capture_output=True)
        subprocess.run(
            ["git", "config", "user.email", "t@example.com"],
            cwd=str(repo),
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "T"],
            cwd=str(repo),
            check=True,
            capture_output=True,
        )
        # Make HEAD~1 resolvable: anchor a base commit so the diff has a real surface.
        (repo / "seed.txt").write_text("seed\n", encoding="utf-8")
        subprocess.run(["git", "add", "seed.txt"], cwd=str(repo), check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-q", "-m", "seed"],
            cwd=str(repo),
            check=True,
            capture_output=True,
        )
        # A second commit is the diff surface — but the droid only triggers on *.go,
        # so it has empty routing and the planner returns zero reviewers.
        (repo / "main.py").write_text("x = 1\n", encoding="utf-8")
        subprocess.run(["git", "add", "main.py"], cwd=str(repo), check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-q", "-m", "work"],
            cwd=str(repo),
            check=True,
            capture_output=True,
        )
        # ``verify_cache`` shells out to ``git`` from cwd — point cwd at the repo
        # so ``current_head`` / ``diff_names`` see the cached HEAD and the right
        # merge-base. ``monkeypatch`` restores cwd after the test.
        monkeypatch.chdir(repo)
        request = AttestationRequest(
            out_path="attestations/mr-empty.md",
            base="HEAD~1",
            droids_dir=str(sibling),
            force_full=True,
            with_outcome=True,
            criteria="C01 the droid runs",
        )
        with pytest.raises(MergeCheckError, match="no reviewers"):
            write_attestation(request, "# report", cache_path=repo / "cache.json", root=repo)


def test_reset_worktree_reverts_tracked_side_effects(git_repo: Path) -> None:
    # GIVEN a git worktree with a dirtied tracked file
    # WHEN resetting the worktree state
    # THEN the file is restored to its HEAD content (isolation between mutations)
    worktree = git_repo / "wt"
    subprocess.run(
        ["git", "worktree", "add", "--detach", str(worktree), "HEAD"],
        cwd=str(git_repo),
        check=True,
        capture_output=True,
    )
    try:
        target = worktree / "seed.txt"
        head_content = target.read_text()
        target.write_text("DIRTY\n")
        reset_worktree_state(worktree)
        assert target.read_text() == head_content
    finally:
        subprocess.run(
            ["git", "worktree", "remove", "--force", str(worktree)],
            cwd=str(git_repo),
            capture_output=True,
        )


def test_baseline_that_runs_no_tests_fails_closed(git_repo: Path) -> None:
    # GIVEN a test command that exits 0 but reports it collected no tests
    # WHEN the sensor runs its baseline
    # THEN it fails closed (operational error) rather than scoring mutants against a
    #      suite that never ran — every mutant would otherwise falsely survive
    spec = SensorSpec(
        test_cmd="echo no tests ran",
        mutations=[Mutation(file="seed.txt", find="seed", replace="x", rationale="r")],
    )
    with pytest.raises(MergeCheckError, match="no tests"):
        run_sensor(spec, env=env_from_mapping({}))


def test_mutation_scores_errored_when_command_cannot_launch(git_repo: Path, tmp_path: Path) -> None:
    # GIVEN a worktree and a test command whose binary does not exist
    # WHEN a single mutation runs
    # THEN it is scored ERRORED (not raised), so sibling mutations in the run still score
    worktree = tmp_path / "wt"
    subprocess.run(
        ["git", "worktree", "add", "--detach", str(worktree), "HEAD"],
        cwd=str(git_repo),
        check=True,
        capture_output=True,
    )
    try:
        (worktree / "seed.txt").write_text("find-me\n", encoding="utf-8")
        mutation = Mutation(file="seed.txt", find="find-me", replace="mutated", rationale="r")
        spec = SensorSpec(test_cmd="merge-check-nonexistent-binary-xyzzy", mutations=[mutation])
        result = _run_one_mutation(worktree, mutation, spec, {}, 1, 1, lambda _message: None)
        assert result["verdict"] == ERRORED
    finally:
        subprocess.run(
            ["git", "worktree", "remove", "--force", str(worktree)],
            cwd=str(git_repo),
            capture_output=True,
        )


class TestG0BranchScoping:
    """G0 guardrail: cache entries keyed to a branch; cross-branch reads rejected."""

    def test_cross_branch_cache_entries_are_ignored(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a valid APPROVE cache entry scoped to a different branch
        # WHEN building an iteration plan on the current branch
        # THEN the cached entry is not reused (cross-branch isolation)
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = git_repo / "cache.json"

        # Compute the real fingerprint and head so only the branch mismatch
        # can prevent reuse. Use python-reviewer (triggered by **/*.py) so the
        # changed file is relevant and the no-relevant-files reuse strategy does
        # not mask the branch-scoping check.
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            only=["python-reviewer"],
            force_full=False,
        )
        fp = build_plan(request, ["pkg/x.py"])["fingerprints"]["python-reviewer"]
        head = current_head()

        # Write a cache entry scoped to a different branch
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_BRANCH] = "other-branch"
            c[KEY_ENTRIES]["python-reviewer"] = {
                "fingerprint": fp,
                "verdict": "APPROVE",
                "head": head,
            }
            write_cache(cache_path, c)

        plan = build_plan(request, ["pkg/x.py"])
        # Entry from other-branch is ignored → reviewer goes to RUN bucket
        assert "python-reviewer" in plan["run"], (
            "cross-branch entry must not be reused — G0 isolation"
        )
        assert "python-reviewer" not in plan["reuse"], (
            "cross-branch entry must not be reused — G0 isolation"
        )

    def test_same_branch_cache_entries_are_reused(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a cache entry recorded on the SAME branch
        # WHEN building an iteration plan
        # THEN the entry is eligible for reuse via the cached-approve strategy
        from merge_check.core.gitio import current_branch
        from merge_check.persistence import read_cache
        from merge_check.planner import REASON_CACHED_APPROVE

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = git_repo / "cache.json"

        # Record a real APPROVE at HEAD on the current branch using a reviewer
        # with a relevant trigger so reuse is driven by the cached-approve
        # strategy, not the no-relevant-files fast path.
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            only=["python-reviewer"],
            force_full=False,
        )
        fp = build_plan(request, ["pkg/x.py"])["fingerprints"]["python-reviewer"]
        record_verdict(
            request, ["pkg/x.py"],
            reviewer="python-reviewer",
            fingerprint=fp,
            verdict=Verdict.APPROVE,
            head=current_head(),
        )

        # The branch field should now be set to the current branch
        cache = read_cache(cache_path)
        assert cache.get(KEY_BRANCH) == current_branch()

        plan = build_plan(request, ["pkg/x.py"])
        assert "python-reviewer" in plan["reuse"], (
            "same-branch entry should be reusable during iteration"
        )
        assert plan["reasons"]["python-reviewer"] == REASON_CACHED_APPROVE, (
            "reuse must come from the cached-approve strategy, not a fast path"
        )

    def test_writing_on_different_branch_clears_stale_entries(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a cache that was last written on a different branch with a
        # valid-looking APPROVE entry
        # WHEN a verdict is recorded on the current branch
        # THEN the stale entry is discarded before the branch key is updated,
        #      so an overwrite of the top-level branch cannot relabel foreign
        #      approvals as current-branch (G0 anti-corruption).
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = git_repo / "cache.json"
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            only=["python-reviewer"],
            force_full=False,
        )
        fp = build_plan(request, ["pkg/x.py"])["fingerprints"]["python-reviewer"]
        stale_head = current_head()

        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_BRANCH] = "other-branch"
            c[KEY_ENTRIES]["python-reviewer"] = {
                KEY_FINGERPRINT: fp,
                KEY_VERDICT: "APPROVE",
                KEY_HEAD: stale_head,
            }
            write_cache(cache_path, c)

        record_verdict(
            request, ["pkg/x.py"],
            reviewer="python-reviewer",
            fingerprint=fp,
            verdict=Verdict.APPROVE,
            head=stale_head,
        )

        cache = read_cache(cache_path)
        assert cache.get(KEY_BRANCH) == current_branch()
        # The new entry overwrote the stale one; there is only one entry.
        assert set(cache[KEY_ENTRIES].keys()) == {"python-reviewer"}

    def test_orphaned_head_after_rebase_is_not_reused(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a cached APPROVE at HEAD-1 on the current branch
        # WHEN HEAD is rewritten (rebase/force-push) so the cached head is no
        #      longer an ancestor of the current HEAD
        # THEN the cached entry is treated as a miss (G0 lineage proof) and the
        #      reviewer goes to the RUN bucket instead of being silently reused.
        from merge_check.core.gitio import is_ancestor

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = git_repo / "cache.json"
        request = PlanRequest(
            droids_dir=droids_dir,
            cache_path=cache_path,
            only=["python-reviewer"],
            force_full=False,
        )
        fp = build_plan(request, ["pkg/x.py"])["fingerprints"]["python-reviewer"]
        old_head = current_head()

        # Record a valid APPROVE at old_head
        record_verdict(
            request, ["pkg/x.py"],
            reviewer="python-reviewer",
            fingerprint=fp,
            verdict=Verdict.APPROVE,
            head=old_head,
        )

        # Simulate a rebase: reset to the seed commit and create a divergent
        # commit. We recreate pkg/x.py with the SAME content plus a new
        # divergent.txt file in the SAME commit, so the fingerprint over
        # ["pkg/x.py"] stays identical but the commit tree differs from
        # old_head (which only had pkg/x.py). This ensures the lineage check
        # is the actual reason for rejection, not a fingerprint mismatch.
        subprocess.run(
            ["git", "reset", "--hard", "HEAD~1"],
            cwd=str(git_repo),
            capture_output=True,
            check=True,
        )
        # Create both files and commit them together so the tree differs
        (git_repo / "pkg").mkdir(exist_ok=True)
        (git_repo / "pkg" / "x.py").write_text("x = 1\n", encoding="utf-8")
        (git_repo / "divergent.txt").write_text("divergent\n", encoding="utf-8")
        subprocess.run(
            ["git", "add", "pkg/x.py", "divergent.txt"],
            cwd=str(git_repo), check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "commit", "-q", "-m", "divergent"],
            cwd=str(git_repo), check=True, capture_output=True,
        )
        new_head = current_head()

        # Sanity: old_head is NOT an ancestor of new_head (divergent history)
        assert not is_ancestor(old_head, new_head), (
            "test setup error: old_head should not be an ancestor of new_head"
        )

        # The fingerprint is the same (same reviewer, same criteria, same
        # relevant file pkg/x.py with unchanged content) but the lineage check
        # must reject the orphaned entry.
        new_fp = build_plan(request, ["pkg/x.py"])["fingerprints"]["python-reviewer"]
        assert new_fp == fp, (
            "test setup error: fingerprint must be identical so only lineage "
            "check can cause rejection"
        )
        plan = build_plan(request, ["pkg/x.py"])
        assert "python-reviewer" in plan["run"], (
            "orphaned-head entry must not be reused — G0 lineage proof"
        )
        assert "python-reviewer" not in plan["reuse"], (
            "orphaned-head entry must not be reused — G0 lineage proof"
        )


class TestG1StampEntryGuardrails:
    """G1 guardrail: tool_use_count and force_full in cache entry validated at stamp."""

    def test_always_droid_recorded_without_force_full_rejected_at_stamp(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a security-floor droid recorded at force_full=True but with the
        # force_full flag mutated to False afterwards
        # WHEN the writer tries to produce a --force-full stamp
        # THEN it is rejected by the G1 always-floor guard, not by a missing entry
        from merge_check.constants import KEY_ENTRY_FORCE_FULL
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = _approve_floor(droids_dir, git_repo, ["pkg/x.py"], force_full=True)
        # Mutate the recorded entry to drop the force_full flag (simulating a
        # stale/or corrupted cache entry that reached the stamp path).
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_ENTRIES]["security-reviewer"][KEY_ENTRY_FORCE_FULL] = False
            write_cache(cache_path, c)

        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
        )
        with pytest.raises(MergeCheckError, match="without --force-full"):
            write_attestation(request, "# report", cache_path=cache_path, root=git_repo)

    @pytest.mark.parametrize("bad_count", [None, 0, -1, True])
    def test_g1_non_positive_or_invalid_tool_use_count_at_stamp_is_refused(
        self, droids_dir: Path, git_repo: Path, bad_count: int | None
    ) -> None:
        # GIVEN a force-full cache entry with a missing/zero/negative tool_use_count
        # (forensics incident: the cache schema dropped tool_use_count so the
        # writer could not verify the reviewer actually inspected the diff)
        # WHEN the writer tries to produce a stamp
        # THEN it is rejected: hollow APPROVEs cannot pass the stamp
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = _approve_floor(droids_dir, git_repo, ["pkg/x.py"], force_full=True)
        # Overwrite the cache entry to set a bad tool_use_count
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_ENTRIES]["security-reviewer"][KEY_TOOL_USE_COUNT] = bad_count
            write_cache(cache_path, c)

        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
        )
        with pytest.raises(MergeCheckError, match="tool_use_count"):
            write_attestation(request, "# report", cache_path=cache_path, root=git_repo)

    @pytest.mark.parametrize(
        "bad_timing",
        [
            {},  # missing timing dict entirely
            {"dispatch_started_at": ""},  # empty string
            {"dispatch_started_at": 123},  # non-string value
        ],
    )
    def test_g6g7_missing_or_invalid_dispatch_started_at_at_stamp_is_refused(
        self,
        droids_dir: Path,
        git_repo: Path,
        bad_timing: dict[str, object],
    ) -> None:
        # GIVEN a force-full cache entry with missing/invalid dispatch_started_at
        # (forensics incident: timing.reviewer_dispatch_s was fabricated from
        # an orchestrator estimate rather than derived from a real dispatch time)
        # WHEN the writer tries to produce a stamp
        # THEN it is rejected: fabricated timing cannot pass the stamp
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.py", "x = 1\n")
        cache_path = _approve_floor(droids_dir, git_repo, ["pkg/x.py"], force_full=True)
        # Corrupt the timing block (missing, empty, or wrong type)
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_ENTRIES]["security-reviewer"]["timing"] = bad_timing
            write_cache(cache_path, c)

        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
        )
        with pytest.raises(MergeCheckError, match="dispatch_started_at"):
            write_attestation(request, "# report", cache_path=cache_path, root=git_repo)


class TestG3ClassifyRequiredForOverride:
    """G3 guardrail: classify must run before an --override-requested stamp."""

    def test_override_stamp_without_classify_is_refused(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a diff with an override request but no classification run
        # (forensics incident: classify was never called; the override attempt
        # was based on unverified orchestrator judgment about pre-existing findings)
        # WHEN writing a force-full override stamp
        # THEN it is rejected: classification must precede an override stamp
        _commit_change(git_repo, "pkg/x.txt", "x\n")
        request = AttestationRequest(
            out_path="attestations/mr-override.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
            override_requested=OverrideRequest(
                reason="pre-existing findings out of scope", issue_ref=None
            ),
        )
        with pytest.raises(MergeCheckError, match="classification"):
            write_attestation(
                request, "# report", cache_path=git_repo / "cache.json", root=git_repo
            )

    def test_override_stamp_with_classify_skip_reason_is_allowed(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a diff with an override request AND classify --skip-reason set
        # WHEN writing a force-full override stamp
        # THEN the stamp succeeds with NEEDS_FIX verdict
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.txt", "x\n")
        cache_path = git_repo / "cache.json"
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_BRANCH] = current_branch()
            c[KEY_CLASSIFY_DONE] = True
            c[KEY_CLASSIFY_SKIP_REASON] = "no findings exist"
            write_cache(cache_path, c)

        request = AttestationRequest(
            out_path="attestations/mr-override-skip.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
            override_requested=OverrideRequest(
                reason="pre-existing findings out of scope", issue_ref=None
            ),
        )
        write_attestation(
            request, "# report", cache_path=cache_path, root=git_repo
        )
        written = parse_frontmatter(
            (git_repo / "attestations" / "mr-override-skip.md").read_text()
        )["attestation"]
        assert written["verdict"] == "NEEDS_FIX"
        # The skip reason must land in the frontmatter audit trail
        assert written.get("classify_skip_reason") == "no findings exist", (
            "classify_skip_reason must be surfaced in the attestation frontmatter"
        )

    def test_override_stamp_rejects_stale_classify_from_other_branch(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a classify_done flag from a different branch
        # WHEN writing a force-full override stamp on the current branch
        # THEN it is rejected: classification must belong to the current branch
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.txt", "x\n")
        cache_path = git_repo / "cache.json"
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_BRANCH] = "other-branch"
            c[KEY_CLASSIFY_DONE] = True
            c[KEY_CLASSIFY_SKIP_REASON] = "no findings exist"
            write_cache(cache_path, c)

        request = AttestationRequest(
            out_path="attestations/mr-override-stale.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
            override_requested=OverrideRequest(
                reason="pre-existing findings out of scope", issue_ref=None
            ),
        )
        with pytest.raises(MergeCheckError, match="classification"):
            write_attestation(
                request, "# report", cache_path=cache_path, root=git_repo
            )

    @pytest.mark.parametrize("bad_flag", [False, 1, "true", "yes"])
    def test_override_stamp_rejects_non_true_classify_done(
        self, droids_dir: Path, git_repo: Path, bad_flag: object
    ) -> None:
        # GIVEN a classify_done flag that is not the literal boolean True
        # (False, or a truthy non-bool like 1, "true", "yes")
        # WHEN writing a force-full override stamp on the matching branch
        # THEN it is rejected: only literal True satisfies the G3 guard
        from merge_check.persistence import cache_transaction, read_cache, write_cache

        _commit_change(git_repo, "pkg/x.txt", "x\n")
        cache_path = git_repo / "cache.json"
        with cache_transaction(cache_path):
            c = read_cache(cache_path)
            c[KEY_BRANCH] = current_branch()
            c[KEY_CLASSIFY_DONE] = bad_flag
            write_cache(cache_path, c)

        request = AttestationRequest(
            out_path="attestations/mr-override-bool.md",
            base="HEAD~1",
            droids_dir=str(droids_dir),
            force_full=True,
            override_requested=OverrideRequest(
                reason="pre-existing findings out of scope", issue_ref=None
            ),
        )
        with pytest.raises(MergeCheckError, match="classification"):
            write_attestation(
                request, "# report", cache_path=cache_path, root=git_repo
            )


class TestFloorPinning:
    """Floor-pinning guard: an MR cannot remove an always-droid in the same commit."""

    def test_stamp_refuses_when_always_droid_removed_in_same_mr(
        self, droids_dir: Path, git_repo: Path
    ) -> None:
        # GIVEN a security-reviewer droid marked `always: true` at the merge base
        # WHEN the current droids directory no longer has security-reviewer as `always`
        #      (simulating an MR that drops the floor in the same commit)
        # THEN the writer refuses the --force-full stamp
        # The floor-pinning guard only fires when droids are inside the repo,
        # so we copy the droids into the git repo for this test.
        repo_droids = git_repo / ".factory" / "droids"
        repo_droids.mkdir(parents=True, exist_ok=True)
        for f in droids_dir.glob("*.md"):
            (repo_droids / f.name).write_text(f.read_text(encoding="utf-8"), encoding="utf-8")

        # Commit the droids first so they exist at the merge base
        subprocess.run(
            ["git", "add", ".factory"],
            cwd=str(git_repo), check=True, capture_output=True,
        )
        subprocess.run(
            ["git", "commit", "-q", "-m", "droids"],
            cwd=str(git_repo), check=True, capture_output=True,
        )
        # Then commit a code change on top
        _commit_change(git_repo, "pkg/x.py", "x = 1\n")

        cache_path = git_repo / "cache.json"
        request = PlanRequest(
            droids_dir=repo_droids,
            cache_path=cache_path,
            force_full=True,
        )
        plan = build_plan(request, ["pkg/x.py"])
        head = current_head()
        for reviewer in plan["run"]:
            record_verdict(
                request, ["pkg/x.py"],
                reviewer=reviewer,
                fingerprint=plan["fingerprints"][reviewer],
                verdict=Verdict.APPROVE,
                head=head,
                tool_use_count=5,
                dispatch_started_at="2026-01-01T00:00:00Z",
            )

        # Overwrite security-reviewer to remove `always: true`
        (repo_droids / "security-reviewer.md").write_text(
            "---\nname: security-reviewer\nmerge_check:\n  always: false\n---\n# security\n",
            encoding="utf-8",
        )

        request = AttestationRequest(
            out_path="attestations/mr-floor.md",
            base="HEAD~1",
            droids_dir=str(repo_droids),
            force_full=True,
        )
        with pytest.raises(MergeCheckError, match="always-floor"):
            write_attestation(request, "# report", cache_path=cache_path, root=git_repo)


class TestG0TwoWorktreeConcurrency:
    """C04: two git worktrees on different branches must not cross-read caches."""

    def test_two_worktrees_do_not_cross_read_cache_entries(
        self, droids_dir: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # GIVEN two worktrees on different branches, each with its own cache
        # WHEN each records an APPROVE for the same reviewer
        # THEN each cache only contains its own branch's entry
        base_repo = tmp_path / "base"
        base_repo.mkdir()
        subprocess.run(
            ["git", "init", "-q", str(base_repo)],
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"],
            cwd=str(base_repo),
            check=True,
            capture_output=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Test User"],
            cwd=str(base_repo),
            check=True,
            capture_output=True,
        )
        _commit_change(base_repo, "README.md", "# base\n")

        wt_a = tmp_path / "wt-a"
        wt_b = tmp_path / "wt-b"
        for wt, branch in [(wt_a, "feat/branch-a"), (wt_b, "feat/branch-b")]:
            subprocess.run(
                ["git", "worktree", "add", "-q", "-b", branch, str(wt)],
                cwd=str(base_repo),
                check=True,
                capture_output=True,
            )

        for wt, filename, value in [
            (wt_a, "pkg/a.py", "a = 1\n"),
            (wt_b, "pkg/b.py", "b = 1\n"),
        ]:
            _commit_change(wt, filename, value)
            cache_path = wt / ".factory" / "merge-check-cache.json"
            # Run plan/record from inside the worktree so current_branch() and
            # current_head() read the worktree's git state, not the test runner's.
            monkeypatch.chdir(wt)
            request = PlanRequest(
                droids_dir=droids_dir,
                cache_path=cache_path,
                only=["python-reviewer"],
                force_full=False,
            )
            changed = [filename]
            fp = build_plan(request, changed)["fingerprints"]["python-reviewer"]
            record_verdict(
                request, changed,
                reviewer="python-reviewer",
                fingerprint=fp,
                verdict=Verdict.APPROVE,
                head=current_head(),
            )

        cache_a = read_cache(wt_a / ".factory" / "merge-check-cache.json")
        cache_b = read_cache(wt_b / ".factory" / "merge-check-cache.json")
        assert cache_a.get(KEY_BRANCH) == "feat/branch-a"
        assert cache_b.get(KEY_BRANCH) == "feat/branch-b"
        assert "python-reviewer" in cache_a[KEY_ENTRIES]
        assert "python-reviewer" in cache_b[KEY_ENTRIES]
        # Each cache only has its own branch's entry; no cross-read occurred.
        assert cache_a[KEY_ENTRIES]["python-reviewer"][KEY_HEAD] != (
            cache_b[KEY_ENTRIES]["python-reviewer"][KEY_HEAD]
        )
