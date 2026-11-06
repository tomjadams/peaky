"""Unit tests for repo-relative path validation (traversal/symlink guards)."""

from __future__ import annotations

from pathlib import Path

import pytest

from merge_check.core.paths import ensure_repo_relative
from merge_check.errors import MergeCheckError


class TestEnsureRepoRelative:
    def test_accepts_a_plain_relative_path(self, tmp_path: Path) -> None:
        # GIVEN a plain repo-relative path inside the root
        # WHEN validating it
        # THEN it is returned unchanged
        assert ensure_repo_relative("attestations/mr-7.md", root=tmp_path) == Path(
            "attestations/mr-7.md"
        )

    def test_rejects_absolute_path(self, tmp_path: Path) -> None:
        # GIVEN an absolute path
        # WHEN validating it
        # THEN it is rejected
        with pytest.raises(MergeCheckError, match="inside the project"):
            ensure_repo_relative("/etc/passwd", root=tmp_path)

    def test_rejects_parent_traversal(self, tmp_path: Path) -> None:
        # GIVEN a path that climbs out with ..
        # WHEN validating it
        # THEN it is rejected
        with pytest.raises(MergeCheckError, match="inside the project"):
            ensure_repo_relative("../../secrets.txt", root=tmp_path)

    def test_rejects_escape_via_resolved_target(self, tmp_path: Path) -> None:
        # GIVEN a path whose resolved location is outside the root
        # WHEN validating it
        # THEN it is rejected even without a literal `..` token at the front
        outside = tmp_path.parent / "outside"
        with pytest.raises(MergeCheckError, match="inside the project"):
            ensure_repo_relative(str(outside), root=tmp_path)

    def test_rejects_symlink_when_disallowed(self, tmp_path: Path) -> None:
        # GIVEN a symlink inside the root
        # WHEN validating with allow_symlink=False
        # THEN the symlink is rejected (anti-TOCTOU for attestation reads)
        target = tmp_path / "real.md"
        target.write_text("x")
        link = tmp_path / "link.md"
        link.symlink_to(target)
        with pytest.raises(MergeCheckError, match="symlink"):
            ensure_repo_relative("link.md", root=tmp_path, allow_symlink=False)

    def test_rejects_symlinked_intermediate_directory(self, tmp_path: Path) -> None:
        # GIVEN a path whose intermediate directory is a symlink
        # WHEN validating with allow_symlink=False
        # THEN it is rejected — the guard must reject a symlink at any component, not just the leaf
        real_dir = tmp_path / "real_dir"
        real_dir.mkdir()
        (real_dir / "mr.md").write_text("x")
        (tmp_path / "link_dir").symlink_to(real_dir)
        with pytest.raises(MergeCheckError, match="symlink"):
            ensure_repo_relative("link_dir/mr.md", root=tmp_path, allow_symlink=False)

    def test_allows_symlink_by_default(self, tmp_path: Path) -> None:
        # GIVEN a symlink inside the root
        # WHEN validating with the default policy
        # THEN it is accepted (the default callers do not read through it blindly)
        target = tmp_path / "real.md"
        target.write_text("x")
        (tmp_path / "link.md").symlink_to(target)
        assert ensure_repo_relative("link.md", root=tmp_path) == Path("link.md")
