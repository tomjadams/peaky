"""Thin, validated wrappers around the ``git`` CLI.

Four modules used to each shell out to git their own way. Centralising it gives
one place that validates a ref name before it reaches a subprocess argument and
one place that translates a git failure into a :class:`MergeCheckError`.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

from merge_check.errors import MergeCheckError

GIT = "git"

# A ref usable on the left of ``git diff <ref>...HEAD``. Anchored, must start
# with an alphanumeric, and excludes whitespace and shell metacharacters.
DIFF_REF_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/@^~-]*$")
# A ref usable as a worktree base (``git worktree add … <ref>``). Permits the
# ``:{}`` revision-spec characters git itself accepts, but the first character is
# restricted to ANCHOR-only (no leading ``-``), so option-like tokens such as
# ``-foo`` cannot smuggle an option flag through.
WORKTREE_REF_RE = re.compile(r"^[A-Za-z0-9_./:@{}+][A-Za-z0-9_./:@{}+-]*$")


def run_git(
    args: list[str],
    *,
    cwd: str | Path | None = None,
    timeout: int | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a git subcommand with output captured, never raising on exit status.

    Parameters
    ----------
    args : list[str]
        Git arguments after the ``git`` program name, e.g. ``["rev-parse", "HEAD"]``.
    cwd : str | Path | None, optional
        Working directory for the subprocess.
    timeout : int | None, optional
        Seconds before the call times out.

    Returns
    -------
    subprocess.CompletedProcess[str]
        The completed process with text ``stdout``/``stderr``.

    Raises
    ------
    MergeCheckError
        When the ``git`` binary is not on ``PATH`` or the command times out.

    Examples
    --------
    >>> run_git(["rev-parse", "HEAD"]).returncode  # doctest: +SKIP
    0  # doctest: +SKIP
    """
    try:
        return subprocess.run(  # noqa: S603 — fixed `git` argv, refs validated upstream
            [GIT, *args],
            cwd=str(cwd) if cwd is not None else None,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise MergeCheckError(f"git binary not on PATH ({exc})") from exc
    except subprocess.TimeoutExpired as exc:
        raise MergeCheckError(f"git command timed out after {timeout}s: {exc.cmd}") from exc


def current_head(*, cwd: str | Path | None = None) -> str:
    """Return ``git rev-parse HEAD``.

    Parameters
    ----------
    cwd : str | Path | None, optional
        Repository working directory.

    Returns
    -------
    str
        The 40-character HEAD commit SHA.

    Raises
    ------
    MergeCheckError
        When HEAD cannot be resolved (no commits, not a repo, …).

    Examples
    --------
    >>> len(current_head())  # doctest: +SKIP
    40  # doctest: +SKIP
    """
    result = run_git(["rev-parse", "HEAD"], cwd=cwd)
    if result.returncode != 0:
        raise MergeCheckError("cannot resolve current git HEAD")
    return result.stdout.strip()


def diff_names(base: str, *, cwd: str | Path | None = None) -> list[str]:
    """Return changed file paths from ``git diff --name-only <base>...HEAD``.

    Parameters
    ----------
    base : str
        Base ref. Validated against :data:`DIFF_REF_RE` before use.
    cwd : str | Path | None, optional
        Repository working directory.

    Returns
    -------
    list[str]
        Repo-relative changed file paths, blanks removed.

    Raises
    ------
    MergeCheckError
        When ``base`` is not a valid ref name or the diff command fails.

    Examples
    --------
    >>> diff_names("main")  # doctest: +SKIP
    ['app/x.ts', 'server/api.ts']  # doctest: +SKIP
    """
    if not DIFF_REF_RE.match(base):
        raise MergeCheckError(f"--base must be a valid git ref name (got {base!r})")
    result = run_git(["diff", "-z", "--name-only", f"{base}...HEAD"], cwd=cwd)
    if result.returncode != 0:
        raise MergeCheckError(
            f"git diff --name-only {base}...HEAD failed: {(result.stderr or '').strip()}"
        )
    # ``-z`` emits NUL-delimited entries (also quoting C-style bytes); split on
    # NUL and drop the trailer that git appends after the last entry. Names
    # that contain an embedded newline stay intact because we never call
    # ``strip`` on them.
    return [name for name in (result.stdout or "").split("\0") if name]


def diff_names_between(
    old: str, new: str, *, cwd: str | Path | None = None
) -> list[str]:
    """Return changed file paths from ``git diff --name-only <old>..<new>``.

    Unlike :func:`diff_names` (which uses the three-dot ``base...HEAD`` to find
    the merge-base), this uses the two-dot ``old..new`` form to list files that
    differ between two specific commits. Used by the planner's focus-hint
    computation to find files that changed since a reviewer's last APPROVE.

    Parameters
    ----------
    old : str
        The older commit SHA.
    new : str
        The newer commit SHA.
    cwd : str | Path | None, optional
        Repository working directory.

    Returns
    -------
    list[str]
        Repo-relative changed file paths, blanks removed.

    Raises
    ------
    MergeCheckError
        When either ref is not a valid SHA or the diff command fails.
    """
    for ref in (old, new):
        if not DIFF_REF_RE.match(ref):
            raise MergeCheckError(f"diff_names_between ref must be valid (got {ref!r})")
    result = run_git(["diff", "-z", "--name-only", f"{old}..{new}"], cwd=cwd)
    if result.returncode != 0:
        raise MergeCheckError(
            f"git diff --name-only {old}..{new} failed: {(result.stderr or '').strip()}"
        )
    return [name for name in (result.stdout or "").split("\0") if name]


def merge_base(ref_a: str, ref_b: str, *, cwd: str | Path | None = None) -> str:
    """Return ``git merge-base <ref_a> <ref_b>`` — the common ancestor commit.

    This is the true start of what ``git diff <ref_a>...<ref_b>`` reviews, so the
    attestation records it as the surface the reviewers actually saw. The CI gate
    recomputes the merge-base against the real merge target and refuses to honour a
    stamp whose recorded base does not cover the MR's full diff.

    Parameters
    ----------
    ref_a, ref_b : str
        Refs to find the common ancestor of. Each is validated against
        :data:`DIFF_REF_RE` before use.
    cwd : str | Path | None, optional
        Repository working directory.

    Returns
    -------
    str
        The 40-character merge-base commit SHA.

    Raises
    ------
    MergeCheckError
        When either ref is invalid, or the two refs share no common ancestor.

    Examples
    --------
    >>> merge_base("main", "HEAD")  # doctest: +SKIP
    '1a2b3c...'  # doctest: +SKIP
    """
    for ref in (ref_a, ref_b):
        if not DIFF_REF_RE.match(ref):
            raise MergeCheckError(f"merge-base ref must be a valid git ref name (got {ref!r})")
    result = run_git(["merge-base", ref_a, ref_b], cwd=cwd)
    if result.returncode != 0:
        raise MergeCheckError(
            f"cannot resolve merge-base of {ref_a!r} and {ref_b!r}: {(result.stderr or '').strip()}"
        )
    return result.stdout.strip()


def repo_toplevel(*, cwd: str | Path | None = None) -> Path:
    """Return the repository root via ``git rev-parse --show-toplevel``.

    Parameters
    ----------
    cwd : str | Path | None, optional
        A directory inside the repository.

    Returns
    -------
    Path
        The absolute repository root.

    Raises
    ------
    MergeCheckError
        When the directory is not inside a git repository.

    Examples
    --------
    >>> repo_toplevel().is_dir()  # doctest: +SKIP
    True  # doctest: +SKIP
    """
    result = run_git(["rev-parse", "--show-toplevel"], cwd=cwd)
    if result.returncode != 0:
        raise MergeCheckError("not inside a git repository")
    return Path(result.stdout.strip())


def current_branch(*, cwd: str | Path | None = None) -> str:
    """Return the current branch name.

    In detached-HEAD state (e.g. CI checkout), returns ``"detached-<short-sha>"``
    rather than ``"HEAD"`` so downstream consumers always have a stable, non-empty
    scope key.

    Parameters
    ----------
    cwd : str | Path | None, optional
        Repository working directory.

    Returns
    -------
    str
        The branch name, or ``"detached-<short-sha>"`` in detached-HEAD state.

    Raises
    ------
    MergeCheckError
        When the branch cannot be resolved.

    Examples
    --------
    >>> current_branch()  # doctest: +SKIP
    'main'
    """
    result = run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd)
    if result.returncode != 0:
        raise MergeCheckError("cannot resolve current git branch")
    branch = result.stdout.strip()
    if branch == "HEAD":
        sha_result = run_git(["rev-parse", "--short", "HEAD"], cwd=cwd)
        if sha_result.returncode != 0:
            raise MergeCheckError("cannot resolve HEAD SHA in detached state")
        return f"detached-{sha_result.stdout.strip()}"
    return branch


def branch_slug(branch: str) -> str:
    """Convert a branch name to a filesystem-safe slug for path components.

    Replaces ``/``, spaces, and other shell-unsafe characters with ``-``.
    Leading and trailing dashes are stripped. An empty result falls back
    to ``"unknown"``.

    Parameters
    ----------
    branch : str
        Git branch name.

    Returns
    -------
    str
        A slug safe for use as a directory name.

    Examples
    --------
    >>> branch_slug("feat/my-feature")
    'feat-my-feature'
    >>> branch_slug("main")
    'main'
    """
    slug = re.sub(r"[^A-Za-z0-9._-]", "-", branch)
    slug = re.sub(r"-{2,}", "-", slug).strip("-")
    return slug or "unknown"


def is_ancestor(candidate: str, descendant: str, *, cwd: str | Path | None = None) -> bool:
    """Return ``True`` iff ``candidate`` is a git ancestor of (or equal to) ``descendant``.

    Uses ``git merge-base --is-ancestor``. Both refs must be valid SHAs or ref
    names matching :data:`DIFF_REF_RE`; an invalid ref returns ``False`` rather
    than raising.

    Parameters
    ----------
    candidate : str
        The commit that must be an ancestor.
    descendant : str
        The commit that must be a descendant.
    cwd : str | Path | None, optional
        Repository working directory.

    Returns
    -------
    bool
        ``True`` when ``candidate`` is reachable from ``descendant``.

    Raises
    ------
    MergeCheckError
        If the git binary is not on PATH or the subprocess times out.

    Examples
    --------
    >>> is_ancestor("abc123", "HEAD")  # doctest: +SKIP
    True
    """
    if not DIFF_REF_RE.match(candidate) or not DIFF_REF_RE.match(descendant):
        return False
    result = run_git(["merge-base", "--is-ancestor", candidate, descendant], cwd=cwd)
    return result.returncode == 0
