"""Shared fixtures for the merge_check test suite.

Unit tests under ``tests/unit`` must not perform real git or network I/O. The
``git_repo`` fixture here builds a throwaway repository on disk for the tests
under ``tests/integration`` that exercise the cache, the attestation writer, and
the worktree-reset path against real git state.
"""

from __future__ import annotations

import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest


def _git(repo: Path, *args: str) -> str:
    """Run a git command in ``repo`` and return its stripped stdout."""
    return subprocess.run(
        ["git", *args], cwd=str(repo), capture_output=True, text=True, check=True
    ).stdout.strip()


def write_droid(
    droids_dir: Path, name: str, *, triggers: list[str] | None = None, always: bool = False
) -> None:
    """Write a reviewer droid Markdown file with a ``merge_check:`` block.

    Parameters
    ----------
    droids_dir : Path
        Directory to write the droid into.
    name : str
        Droid filename stem.
    triggers : list[str] | None, optional
        Trigger globs; omitted when ``None``.
    always : bool, optional
        Whether the droid is an always-floor reviewer.
    """
    lines = ["---", f"name: {name}", "merge_check:"]
    if triggers is not None:
        rendered = ", ".join(f'"{glob}"' for glob in triggers)
        lines.append(f"  triggers: [{rendered}]")
    lines.append(f"  always: {'true' if always else 'false'}")
    lines.extend(["---", f"# {name}", ""])
    (droids_dir / f"{name}.md").write_text("\n".join(lines), encoding="utf-8")


@pytest.fixture
def droids_dir(tmp_path: Path) -> Path:
    """A droids directory with a security floor, a python reviewer, and a verifier."""
    directory = tmp_path / "droids"
    directory.mkdir()
    write_droid(directory, "security-reviewer", always=True)
    write_droid(directory, "python-reviewer", triggers=["**/*.py"])
    # Verifier role is recognised by the -verifier suffix; no merge_check block needed.
    (directory / "outcome-verifier.md").write_text(
        "---\nname: outcome-verifier\n---\n# outcome-verifier\n", encoding="utf-8"
    )
    return directory


@pytest.fixture
def git_repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """A throwaway git repo with one commit, with the cwd set inside it.

    Yields
    ------
    Path
        The repository root (also the current working directory for the test).
    """
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test")
    (repo / "seed.txt").write_text("seed\n", encoding="utf-8")
    _git(repo, "add", "seed.txt")
    _git(repo, "commit", "-q", "-m", "seed")
    monkeypatch.chdir(repo)
    yield repo
