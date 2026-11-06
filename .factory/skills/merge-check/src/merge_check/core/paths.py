"""Repo-relative path validation shared by every module that writes or reads by
caller-supplied path.

The attestation writer, the config loader, the sensor's link list, and the
incremental fast-path all take a path that an agent could influence. Each one
must guarantee the path stays inside the project before touching the filesystem,
or an agent could point a write at ``/etc`` or read through a symlink. This is
that guarantee, in one tested place.
"""

from __future__ import annotations

import os
from collections.abc import Iterable
from pathlib import Path

from merge_check.constants import ATTESTATION_PREFIX
from merge_check.errors import MergeCheckError


def non_attestation_paths(paths: Iterable[str]) -> list[str]:
    """Return only the reviewable-source paths, dropping attestation files.

    Attestation files (under :data:`~merge_check.constants.ATTESTATION_PREFIX`)
    are the stamp a review *produces*, not input it reviews, so every consumer
    reasoning about "the reviewed surface" excludes them. Naming the filter once
    keeps the call sites — planner routing, plan building, and attestation
    verification — reading identically.

    Parameters
    ----------
    paths : Iterable[str]
        Repo-relative changed-file paths.

    Returns
    -------
    list[str]
        The subset that is not an attestation file, order preserved.
    """
    return [path for path in paths if not path.startswith(ATTESTATION_PREFIX)]


def is_within(candidate: Path, root: Path) -> bool:
    """Return ``True`` iff ``candidate`` stays inside ``root`` after resolution.

    Resolves ``..`` segments and symlinks on both sides, then checks containment.
    Unlike :func:`ensure_repo_relative`, this never raises — callers that must
    score a bad path as an error (rather than abort) use this boolean form.

    Parameters
    ----------
    candidate : Path
        The path to test (may be absolute).
    root : Path
        The directory it must stay within.

    Returns
    -------
    bool
        Whether ``candidate`` resolves to a location inside ``root``.

    Examples
    --------
    >>> from pathlib import Path
    >>> is_within(Path.cwd() / "a", Path.cwd())
    True
    """
    try:
        candidate.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def ensure_repo_relative(
    candidate: str | Path,
    *,
    root: Path,
    allow_symlink: bool = True,
) -> Path:
    """Validate that ``candidate`` resolves to a location inside ``root``.

    Rejects absolute paths, any ``..`` traversal token, and paths whose resolved
    target escapes ``root``. Optionally rejects symlinks for callers that must not
    read or write through one.

    Parameters
    ----------
    candidate : str | Path
        A path supplied by config, CLI, or a diff — never trusted as-is.
    root : Path
        The project root the path must stay within.
    allow_symlink : bool, optional
        When ``False``, a symlink at ``root/candidate`` is rejected. Defaults to
        ``True``.

    Returns
    -------
    Path
        The validated path as a relative :class:`~pathlib.Path`.

    Raises
    ------
    MergeCheckError
        When the path is absolute, contains ``..``, resolves outside ``root``, or
        is a symlink while ``allow_symlink`` is ``False``.

    Examples
    --------
    >>> from pathlib import Path
    >>> ensure_repo_relative("attestations/mr-7.md", root=Path.cwd()).as_posix()
    'attestations/mr-7.md'
    """
    path = Path(candidate)
    if path.is_absolute() or ".." in path.parts:
        raise MergeCheckError(f"path must stay inside the project: {str(candidate)!r}")
    root_resolved = root.resolve(strict=False)
    try:
        (root_resolved / path).resolve(strict=False).relative_to(root_resolved)
    except ValueError as exc:
        raise MergeCheckError(f"path must stay inside the project: {str(candidate)!r}") from exc
    # Reject a symlink at ANY component, not just the leaf: an in-repo symlinked
    # intermediate directory would otherwise be silently followed. ``root_resolved``
    # has no symlinks (it is already resolved), so the realpath of the joined path
    # differing from its lexical form means some component of ``path`` is a symlink.
    if not allow_symlink:
        joined = root_resolved / path
        if os.path.realpath(joined) != str(joined):
            raise MergeCheckError(f"path must not traverse a symlink: {str(candidate)!r}")
    return path
