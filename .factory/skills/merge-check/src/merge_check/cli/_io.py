"""Shared CLI plumbing: stdin reading and fail-closed error reporting.

The library raises :class:`~merge_check.errors.MergeCheckError`; this is the one
place that turns it into a stderr line and a process exit code. Keeping it here
means every entry point reports failures the same way and no library module ever
calls :func:`sys.exit`.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import NamedTuple

from merge_check.errors import MergeCheckError


class OnlyFlag(NamedTuple):
    """The two states ``--only`` can be in: absent (``None``) or set to a list.

    Attributes
    ----------
    present : bool
        ``True`` when the flag was passed (even if it parsed to no names).
    names : list[str]
        The droid names; empty when ``--only ""`` was passed.
    """

    present: bool
    names: list[str]


def read_changed_files() -> list[str]:
    """Read newline-separated changed files from stdin (empty when interactive).

    Returns
    -------
    list[str]
        Non-blank, stripped lines from stdin, or an empty list at a TTY.
        Paths are validated to be relative (no absolute paths, no ``..``
        traversal) to prevent path-escape attacks via forged stdin.
    """
    if sys.stdin.isatty():
        return []
    result: list[str] = []
    for line in sys.stdin:
        path = line.strip()
        if not path:
            continue
        if Path(path).is_absolute() or ".." in Path(path).parts:
            continue
        result.append(path)
    return result


def parse_only(raw: str | None) -> OnlyFlag:
    """Parse ``--only A,B,C`` distinguishing the absent flag from a blank value.

    ``--only`` is a roster restriction; an absent flag means *no* restriction
    (the orchestrator picks), an explicit ``--only ""`` means *the caller asked
    for an empty roster* — they must NOT be treated the same way. The
    :class:`OnlyFlag` NamedTuple lets the caller route on both the booleanness
    and the parsed name list.

    Parameters
    ----------
    raw : str | None
        The raw ``--only`` argument, or ``None`` when the flag was absent.

    Returns
    -------
    OnlyFlag
        ``OnlyFlag(present=False, names=[])`` when the flag was absent;
        ``OnlyFlag(present=True, names=[…])`` when the flag was passed.

    Examples
    --------
    >>> parse_only(None)
    OnlyFlag(present=False, names=[])
    >>> parse_only(" security , , python ")
    OnlyFlag(present=True, names=['security', 'python'])
    >>> parse_only("")
    OnlyFlag(present=True, names=[])
    """
    if raw is None:
        return OnlyFlag(present=False, names=[])
    names = [name.strip() for name in raw.split(",") if name.strip()]
    return OnlyFlag(present=True, names=names)


def report_error(prefix: str, exc: MergeCheckError) -> int:
    """Print a fail-closed error to stderr and return its exit code.

    Parameters
    ----------
    prefix : str
        Short log prefix identifying the entry point, e.g. ``"[discover-roster]"``.
    exc : MergeCheckError
        The raised domain error.

    Returns
    -------
    int
        ``exc.exit_code`` for the caller to return from ``main``.
    """
    print(f"{prefix} {exc}", file=sys.stderr)
    return exc.exit_code
