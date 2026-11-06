"""Content fingerprints that bind a cached APPROVE to the exact inputs reviewed.

A cached approval may be reused only when the reviewer, its routing, the criteria,
and the content of every relevant file are byte-for-byte unchanged. The
fingerprint is that binding. It is the anti-forgery linchpin: an agent cannot
reuse or fabricate an approval without reproducing the real file contents, and a
fingerprint recomputed from a tampered file will not match the cached one.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from merge_check.models import MergeCheckSpec

REVIEWER_SUFFIX = ".md"


def file_digest(path: Path) -> str:
    """Return a SHA-256 over a file's path and its content (or symlink target).

    A symlink is digested by its target string (via :func:`os.readlink`), never by
    following it, so a symlink swapped in to impersonate a file changes the digest.
    A missing or unreadable file digests to a stable ``<missing>`` marker.

    Parameters
    ----------
    path : Path
        File to digest.

    Returns
    -------
    str
        Hex SHA-256 digest.

    Examples
    --------
    >>> file_digest(Path("/does/not/exist")) == file_digest(Path("/does/not/exist"))
    True
    """
    digest = hashlib.sha256()
    digest.update(str(path).encode())
    digest.update(b"\0")
    try:
        if path.is_symlink():
            digest.update(b"<symlink>")
            digest.update(os.readlink(path).encode())
        else:
            digest.update(path.read_bytes())
    except OSError:
        digest.update(b"<missing>")
    return digest.hexdigest()


def criteria_digest(value: str) -> str:
    """Return a SHA-256 over the criteria text.

    Parameters
    ----------
    value : str
        The concatenated acceptance criteria.

    Returns
    -------
    str
        Hex SHA-256 digest.

    Examples
    --------
    >>> criteria_digest("") == criteria_digest("")
    True
    """
    return hashlib.sha256(value.encode()).hexdigest()


def reviewer_fingerprint(
    reviewer: str,
    spec: MergeCheckSpec,
    droids_dir: Path,
    relevant_files: list[str],
    *,
    criteria: str,
    is_verifier: bool,
    repo_root: Path,
) -> str:
    """Compute the fingerprint binding a reviewer's approval to its inputs.

    The digest covers the reviewer name, the criteria digest, the reviewer's droid
    file content, its routing (triggers/always/verifier), and the path + content of
    every relevant file in sorted order. Any change to any of these invalidates a
    cached approval.

    Parameters
    ----------
    reviewer : str
        Reviewer droid name.
    spec : MergeCheckSpec
        The reviewer's routing spec.
    droids_dir : Path
        Directory holding ``<reviewer>.md``.
    relevant_files : list[str]
        Repo-relative files this reviewer is responsible for.
    criteria : str
        Pre-computed criteria digest (see :func:`criteria_digest`).
    is_verifier : bool
        Whether this reviewer is a verifier-role droid.
    repo_root : Path
        Repository root (so file digests are anchored there, not to the cwd of the
        running process — keeps hash output stable regardless of where the agent
        launched the skill).

    Returns
    -------
    str
        Hex SHA-256 fingerprint.

    Examples
    --------
    >>> from pathlib import Path
    >>> from merge_check.models import MergeCheckSpec
    >>> from merge_check.core.fingerprint import reviewer_fingerprint
    >>> spec = MergeCheckSpec(triggers=["**/*.py"])
    >>> a = reviewer_fingerprint("py", spec, Path("d"), [], criteria="c",
    ...                          is_verifier=False, repo_root=Path("/r"))
    >>> b = reviewer_fingerprint("py", spec, Path("d"), [], criteria="c",
    ...                          is_verifier=False, repo_root=Path("/r"))
    >>> a == b
    True
    """
    digest = hashlib.sha256()
    digest.update(f"reviewer:{reviewer}\ncriteria:{criteria}\n".encode())
    digest.update(file_digest(droids_dir / f"{reviewer}{REVIEWER_SUFFIX}").encode())
    routing = {"triggers": spec.triggers, "always": spec.always, "verifier": is_verifier}
    digest.update(json.dumps(routing, sort_keys=True).encode())
    for file_name in sorted(relevant_files):
        digest.update(file_name.encode())
        digest.update(b"\0")
        # Anchor reads against repo_root: ``Path("a/b.py")`` interpreted in cwd
        # would otherwise yield different paths on different runs of the skill
        # and break the cache's byte-for-byte fingerprint binding.
        digest.update(file_digest(repo_root / file_name).encode())
        digest.update(b"\0")
    return digest.hexdigest()
