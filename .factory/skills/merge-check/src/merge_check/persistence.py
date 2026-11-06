"""Persistence for the incremental-review cache — all of its disk I/O.

Reviewer ``APPROVE`` verdicts are cached so an unchanged reviewer need not be
re-dispatched. This module owns every disk capability for that cache: the on-disk
schema, reading, the atomic write, the locked read-modify-write transaction, and
the status report. It does **not** decide what to run or whether a write is
legitimate — :mod:`merge_check.planner` makes those decisions and calls
:func:`write_cache` inside a :func:`cache_transaction` to persist them.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from merge_check.constants import (
    CACHE_SCHEMA_VERSION,
    KEY_BRANCH,
    KEY_SCHEMA_VERSION,
)
from merge_check.core.jsonio import file_lock, read_json_object, write_json_atomic
from merge_check.errors import MergeCheckError

# Serialises read-modify-write of the cache within a single process; the
# cross-process half is the POSIX ``file_lock``. Both are taken together by
# :func:`cache_transaction` so a caller never has to know there are two.
_CACHE_LOCK = threading.Lock()

STATUS_DEFAULT_STALE_DAYS = 7

# Cache entry keys (the persisted schema).
KEY_ENTRIES = "entries"
KEY_FINGERPRINT = "fingerprint"
KEY_VERDICT = "verdict"
KEY_RECORDED_AT = "recorded_at"
KEY_HEAD = "head"
KEY_REVIEWED_FILES = "reviewed_files"
KEY_SUMMARY = "summary"
KEY_TIMING = "timing"
KEY_ELAPSED_S = "elapsed_s"
KEY_ROUNDS = "rounds"
KEY_REVIEWER = "reviewer"
KEY_DISPATCH_STARTED_AT = "dispatch_started_at"

# V2 keys are imported above from constants and used directly below; callers
# that need KEY_BRANCH / KEY_TOOL_USE_COUNT / KEY_ENTRY_FORCE_FULL / KEY_CLASSIFY_DONE
# should import them from merge_check.constants.

# Maximum number of per-round history snapshots to retain.
MAX_ROUND_HISTORY = 20

# Maximum number of per-reviewer rounds retained in a cache entry (C08).
MAX_REVIEWER_ROUNDS = 20


def _empty_cache(branch: str = "") -> dict[str, Any]:
    """Return an empty V2 cache skeleton, optionally scoped to a branch."""
    return {
        KEY_SCHEMA_VERSION: CACHE_SCHEMA_VERSION,
        KEY_BRANCH: branch,
        KEY_ENTRIES: {},
        KEY_ROUNDS: [],
    }


def read_cache(path: Path) -> dict[str, Any]:
    """Read the incremental cache, validating its schema version.

    Returns an empty V2 skeleton when the file is absent.  Rejects V1 caches
    (schema_version < 2) with a clear migration message — delete the old file
    to start a fresh V2 cache.

    Parameters
    ----------
    path : Path
        Cache file path.

    Returns
    -------
    dict[str, Any]
        The cache object with ``schema_version``, ``branch``, ``entries``, and
        ``rounds`` populated.

    Raises
    ------
    MergeCheckError
        When the file is unreadable, not an object, is a V1 cache (requires
        migration), has the wrong schema version, or its ``entries`` is not an
        object.

    Examples
    --------
    >>> from pathlib import Path
    >>> from merge_check.persistence import read_cache
    >>> read_cache(Path("missing.json"))  # doctest: +SKIP
    {'schema_version': 2, 'branch': '', 'entries': {}, 'rounds': []}
    """
    if not path.is_file():
        return _empty_cache()
    parsed = read_json_object(path)
    on_disk_version = parsed.get(KEY_SCHEMA_VERSION)
    if isinstance(on_disk_version, int) and on_disk_version < CACHE_SCHEMA_VERSION:
        raise MergeCheckError(
            f"cache at {path} uses schema_version {on_disk_version} (current is "
            f"{CACHE_SCHEMA_VERSION}). Delete the file to start a fresh cache:\n"
            f"  rm {path}"
        )
    parsed.setdefault(KEY_SCHEMA_VERSION, CACHE_SCHEMA_VERSION)
    parsed.setdefault(KEY_BRANCH, "")
    parsed.setdefault(KEY_ENTRIES, {})
    parsed.setdefault(KEY_ROUNDS, [])
    if parsed[KEY_SCHEMA_VERSION] != CACHE_SCHEMA_VERSION:
        raise MergeCheckError(
            f"cache schema_version must be {CACHE_SCHEMA_VERSION}, "
            f"got {parsed[KEY_SCHEMA_VERSION]!r}"
        )
    if not isinstance(parsed[KEY_ENTRIES], dict):
        raise MergeCheckError(f"cache {path} entries must be an object")
    return parsed


def write_cache(path: Path, cache: dict[str, Any]) -> None:
    """Persist the cache to ``path`` atomically.

    Parameters
    ----------
    path : Path
        Cache file path.
    cache : dict[str, Any]
        The full cache object to write.

    Raises
    ------
    MergeCheckError
        When the file cannot be written (propagated from the atomic writer).

    Examples
    --------
    >>> from pathlib import Path
    >>> write_cache(Path("cache.json"), {"schema_version": 1, "entries": {}})  # doctest: +SKIP
    """
    write_json_atomic(path, cache)


@contextmanager
def cache_transaction(path: Path) -> Iterator[None]:
    """Hold the cache's read-modify-write critical section (both locks).

    Wraps the in-process :data:`_CACHE_LOCK` and the cross-process
    :func:`~merge_check.core.jsonio.file_lock` so a caller can
    :func:`read_cache` → modify → :func:`write_cache` without two concurrent
    writers losing each other's entry.

    Parameters
    ----------
    path : Path
        The cache file whose access is being serialised.

    Yields
    ------
    None
        Control returns to the caller while both locks are held.

    Examples
    --------
    >>> from pathlib import Path
    >>> with cache_transaction(Path("cache.json")):  # doctest: +SKIP
    ...     ...  # read_cache -> modify -> write_cache
    """
    with _CACHE_LOCK, file_lock(path):
        yield


def _entry_timing(payload: object) -> tuple[float, str]:
    """Extract ``(elapsed_s, recorded_at)`` from a cache entry; tolerate bad rows.

    A non-numeric ``elapsed_s`` (corrupt cache row, future-schema entry, hand-
    edited file) must not crash the report; every bad shape collapses to
    ``(0.0, payload.get('recorded_at') or '')``. Pulled out of :func:`status_report`
    to keep the orchestrator function under ruff's structural-complexity budget.
    """
    if not isinstance(payload, dict):
        return 0.0, ""
    recorded_at = payload.get(KEY_RECORDED_AT) or ""
    timing = payload.get(KEY_TIMING)
    elapsed = _parse_elapsed(timing)
    return elapsed, recorded_at


def _parse_elapsed(timing: object) -> float:
    """Extract a numeric ``elapsed_s`` from a ``timing`` JSON value; default ``0.0``."""
    if isinstance(timing, dict):
        raw = timing.get(KEY_ELAPSED_S)
    else:
        raw = timing if isinstance(timing, (int, float)) and not isinstance(timing, bool) else None
    if isinstance(raw, bool):
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        try:
            return float(raw)
        except ValueError:
            return 0.0
    return 0.0


def status_report(cache_path: Path, *, stale_days: int = STATUS_DEFAULT_STALE_DAYS) -> list[str]:
    """Render the cache status report lines (slowest reviewers, largest slices).

    Parameters
    ----------
    cache_path : Path
        Cache file to summarise.
    stale_days : int, optional
        Age threshold, in days, for flagging stale entries.

    Returns
    -------
    list[str]
        Human-readable report lines.

    Raises
    ------
    MergeCheckError
        When the cache cannot be read (propagated from :func:`read_cache` on a
        corrupt file or an unexpected schema version).

    Examples
    --------
    >>> from pathlib import Path
    >>> status_report(Path(".factory/merge-check-cache.json"))  # doctest: +SKIP
    ['slowest: python-reviewer (12.3s)', ...]
    """
    cache = read_cache(cache_path)
    entries = cache[KEY_ENTRIES]
    if not entries:
        return ["merge-check cache is empty (no recorded timings yet)."]

    threshold = stale_days if stale_days > 0 else STATUS_DEFAULT_STALE_DAYS
    now = datetime.now(UTC)
    timings: list[tuple[str, float, str]] = []
    slice_sizes: list[tuple[str, int]] = []
    stale: list[tuple[str, str, int]] = []
    newest = oldest = ""
    for name, payload in entries.items():
        if not isinstance(payload, dict):
            continue
        recorded_at = payload.get(KEY_RECORDED_AT) or ""
        elapsed, _ = _entry_timing(payload)
        timings.append((name, elapsed, recorded_at))
        reviewed = payload.get(KEY_REVIEWED_FILES) or []
        if isinstance(reviewed, list):
            slice_sizes.append((name, len(reviewed)))
        if recorded_at:
            oldest = recorded_at if not oldest or recorded_at < oldest else oldest
            newest = recorded_at if not newest or recorded_at > newest else newest
            try:
                ts = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
            except ValueError:
                continue
            age_days = (now - ts).days
            if age_days > threshold:
                stale.append((name, recorded_at, age_days))

    timings.sort(key=lambda row: row[1], reverse=True)
    slice_sizes.sort(key=lambda row: row[1], reverse=True)
    branch = cache.get(KEY_BRANCH) or "(unknown)"
    lines = [
        (
            f"merge-check cache: {len(entries)} entries "
            f"(schema {cache[KEY_SCHEMA_VERSION]}, branch {branch})"
        ),
        f"  newest:  {newest or '(none)'}",
        f"  oldest:  {oldest or '(none)'}",
    ]
    if stale:
        lines.append(f"  stale (>{threshold} days): {len(stale)}")
        lines.extend(f"    - {name} @ {ts} ({age}d)" for name, ts, age in stale)
    lines.append("\nSlowest cached reviewers (top 5):")
    lines.extend(f"  {elapsed:6.1f}s  {name}  (recorded {ts})" for name, elapsed, ts in timings[:5])
    lines.append("\nLargest reviewed slices (top 5):")
    lines.extend(f"  {count:4d} files  {name}" for name, count in slice_sizes[:5])
    return lines
