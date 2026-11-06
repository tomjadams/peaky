"""Unit tests for content fingerprints (the cache reuse / anti-forgery binding)."""

from __future__ import annotations

import hashlib
from pathlib import Path

from merge_check.core.fingerprint import criteria_digest, file_digest, reviewer_fingerprint
from merge_check.models import MergeCheckSpec


def _droid(tmp_path: Path, name: str = "py") -> Path:
    """Write a minimal droid file and return its directory."""
    (tmp_path / f"{name}.md").write_text("---\nname: py\n---\n", encoding="utf-8")
    return tmp_path


class TestReviewerFingerprint:
    def test_is_stable_across_calls_for_identical_inputs(self, tmp_path: Path) -> None:
        # GIVEN identical reviewer, droid, criteria, and file content
        # WHEN computing the fingerprint twice
        # THEN the two fingerprints are equal
        droids = _droid(tmp_path)
        target = tmp_path / "a.py"
        target.write_text("value = 1\n")
        spec = MergeCheckSpec(triggers=["**/*.py"])
        first = reviewer_fingerprint(
            "py", spec, droids, [str(target)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        second = reviewer_fingerprint(
            "py", spec, droids, [str(target)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        assert first == second

    def test_changes_when_a_relevant_file_changes(self, tmp_path: Path) -> None:
        # GIVEN two different file contents
        # WHEN fingerprinting each
        # THEN the fingerprints differ (a tampered file cannot reuse an approval)
        droids = _droid(tmp_path)
        spec = MergeCheckSpec(triggers=["**/*.py"])
        a = tmp_path / "a.py"
        a.write_text("value = 1\n")
        before = reviewer_fingerprint(
            "py", spec, droids, [str(a)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        a.write_text("value = 2\n")
        after = reviewer_fingerprint(
            "py", spec, droids, [str(a)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        assert before != after

    def test_changes_when_criteria_change(self, tmp_path: Path) -> None:
        # GIVEN the same files but different criteria digests
        # WHEN fingerprinting
        # THEN the fingerprints differ
        droids = _droid(tmp_path)
        spec = MergeCheckSpec(triggers=["**/*.py"])
        one = reviewer_fingerprint(
            "py", spec, droids, [], criteria="c1", is_verifier=False, repo_root=tmp_path
        )
        two = reviewer_fingerprint(
            "py", spec, droids, [], criteria="c2", is_verifier=False, repo_root=tmp_path
        )
        assert one != two

    def test_changes_when_routing_changes(self, tmp_path: Path) -> None:
        # GIVEN the same inputs but a different always flag
        # WHEN fingerprinting
        # THEN the routing change invalidates the fingerprint
        droids = _droid(tmp_path)
        triggered = MergeCheckSpec(triggers=["**/*.py"], always=False)
        floored = MergeCheckSpec(triggers=["**/*.py"], always=True)
        a = reviewer_fingerprint(
            "py", triggered, droids, [], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        b = reviewer_fingerprint(
            "py", floored, droids, [], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        assert a != b

    def test_changes_when_is_verifier_changes(self, tmp_path: Path) -> None:
        # GIVEN identical inputs that differ only in the is_verifier flag
        # WHEN fingerprinting each
        # THEN the verifier role is part of the routing digest, so they differ
        droids = _droid(tmp_path)
        spec = MergeCheckSpec(triggers=["**/*.py"])
        reviewer = reviewer_fingerprint(
            "py", spec, droids, [], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        verifier = reviewer_fingerprint(
            "py", spec, droids, [], criteria="c", is_verifier=True, repo_root=tmp_path
        )
        assert reviewer != verifier


class TestFileDigest:
    def test_missing_file_has_stable_marker_digest(self, tmp_path: Path) -> None:
        # GIVEN a path that does not exist
        # WHEN digesting it twice
        # THEN the digest is stable (the <missing> marker)
        missing = tmp_path / "nope.py"
        assert file_digest(missing) == file_digest(missing)

    def test_symlink_digests_by_target_not_content(self, tmp_path: Path) -> None:
        # GIVEN a real file and a symlink pointing at it
        # WHEN digesting both
        # THEN they differ (a symlink swap cannot impersonate the file's content)
        real = tmp_path / "real.py"
        real.write_text("value = 1\n")
        link = tmp_path / "link.py"
        link.symlink_to(real)
        assert file_digest(real) != file_digest(link)


class TestCriteriaDigest:
    """The criteria digest binds an APPROVE to its criteria text byte-for-byte.

    A mutant that returns a constant digest would silently let reviewers
    reuse approvals across distinct criteria — break the discrimination
    sensor. These two assertions pin the contract.
    """

    def test_criteria_digest_matches_sha256_of_payload(self) -> None:
        # GIVEN an arbitrary criteria string
        # WHEN digesting it
        # THEN the digest equals sha256(payload.encode()) (constant zero digest would fail this)
        assert (
            criteria_digest("explicit-ac-line") == hashlib.sha256(b"explicit-ac-line").hexdigest()
        )

    def test_different_criteria_yield_different_digests(self) -> None:
        # GIVEN two distinct criteria strings
        # WHEN digesting each
        # THEN the digests are different (a constant-digest mutant would fail this)
        assert criteria_digest("criterion-A") != criteria_digest("criterion-B")
