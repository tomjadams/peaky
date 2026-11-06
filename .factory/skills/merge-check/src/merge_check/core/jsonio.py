"""Atomic JSON persistence and a cross-process advisory file lock.

The incremental-review cache is read-modify-written by concurrent ``record``
invocations. Two guarantees keep it from losing entries: every write lands
atomically through a uniquely-named sibling temp file plus :func:`os.replace`, so
a reader never sees a half-written file; and :func:`file_lock` serialises the
whole read-modify-write across processes so two writers cannot each start from
the same stale snapshot.
"""

from __future__ import annotations

import contextlib
import fcntl
import json
import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from merge_check.errors import MergeCheckError


def read_json_object(path: Path) -> dict[str, Any]:
    """Read and parse a JSON object from ``path``.

    Parameters
    ----------
    path : Path
        File to read.

    Returns
    -------
    dict[str, Any]
        The parsed object.

    Raises
    ------
    MergeCheckError
        When the file cannot be read, is not valid JSON, or does not parse to a
        JSON object. Fail-closed: a corrupt cache must stop the run, not be
        silently treated as empty.

    Examples
    --------
    >>> read_json_object(Path("cache.json"))  # doctest: +SKIP
    {'schema_version': 1, 'entries': {}}  # doctest: +SKIP
    """
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MergeCheckError(f"cannot read JSON {path}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise MergeCheckError(f"{path} must contain a JSON object")
    return parsed


def write_json_atomic(path: Path, data: dict[str, Any]) -> None:
    """Write ``data`` to ``path`` atomically via a sibling temp file and rename.

    The payload is serialised in memory first, written to a uniquely-named sibling
    temp file in the same directory (so :func:`os.replace` stays on one
    filesystem), then renamed over ``path``. A concurrent reader sees either the
    old or the new content, never a partial write.

    ``os.write`` may legally perform a *short* write (returning fewer bytes than
    requested) on signal interruption; the writer loops until every byte has
    landed, and removes the temp file in a ``finally`` block so a mid-write
    failure cannot leak a partially-written ``cache.json.tmp.*`` to subsequent
    runs.

    Parameters
    ----------
    path : Path
        Destination path; parent directories are created as needed.
    data : dict[str, Any]
        JSON-serialisable object to persist.

    Raises
    ------
    MergeCheckError
        When the directory cannot be created or the file cannot be written.

    Examples
    --------
    >>> write_json_atomic(Path("cache.json"), {"entries": {}})  # doctest: +SKIP
    """
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(data, indent=2, sort_keys=True) + "\n"
        encoded = payload.encode("utf-8")
        fd, tmp_str = tempfile.mkstemp(
            prefix=path.name + ".tmp.", suffix=".json", dir=str(path.parent)
        )
        try:
            written = 0
            while written < len(encoded):
                chunk = os.write(fd, encoded[written:])
                if chunk == 0:  # defensive: zero-length write means EOF on disk
                    raise OSError("os.write returned 0")
                written += chunk
            os.fsync(fd)
        finally:
            os.close(fd)
            if written != len(encoded):
                # Mid-write failure: drop the partial temp file so it does not
                # masquerade as a real cache entry on the next run. The original
                # exception (e.g. disk full) is allowed to propagate; do not
                # replace it with a synthesized short-write error.
                with contextlib.suppress(OSError):
                    os.unlink(tmp_str)
        os.replace(tmp_str, path)
    except OSError as exc:
        raise MergeCheckError(f"cannot write JSON {path}: {exc}") from exc


def _lockfile_path(target: Path) -> Path:
    """Return the sibling ``<target>.lock`` path used for advisory locking."""
    return target.with_name(target.name + ".lock")


@contextmanager
def file_lock(target: Path) -> Iterator[None]:
    """Hold an exclusive OS-level advisory lock for the duration of the block.

    The lock is taken on a sibling ``<target>.lock`` file so it shares the
    target's directory permissions. It blocks on contention: a second holder
    waits until the first releases, then proceeds against the freshly-written
    state. The lock is advisory and tied to the open descriptor, so the kernel
    releases it if the process exits.

    Parameters
    ----------
    target : Path
        The file whose read-modify-write is being serialised (e.g. the cache).

    Yields
    ------
    None
        Control returns to the caller while the lock is held.

    Examples
    --------
    >>> with file_lock(Path("cache.json")):  # doctest: +SKIP
    ...     ...  # read-modify-write the cache here
    """
    lock_path = _lockfile_path(target)
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)
