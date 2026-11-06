"""Path-glob translation used by roster routing and per-reviewer diff slicing.

A droid's ``triggers`` are path globs, and the same translation must drive both
roster discovery (does this droid join?) and incremental slicing (which changed
files concern this droid?). Keeping it in one place guarantees the two never
disagree about what a glob means.
"""

from __future__ import annotations

import functools
import re
from collections.abc import Iterable


@functools.lru_cache(maxsize=512)
def glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Translate a path glob into a fully anchored regex.

    ``**/`` matches any number of leading directories (including none), ``**``
    matches across path separators, ``*`` matches within a single path segment,
    and ``?`` matches one non-separator character. Every other character is
    matched literally.

    The compiled pattern is cached per glob string: roster discovery and diff
    slicing test the same handful of triggers against many paths, so the
    translation runs once per distinct glob rather than once per path. The
    returned :class:`re.Pattern` is immutable and safe to share.

    Parameters
    ----------
    pattern : str
        A path glob such as ``"app/**/*.ts"``.

    Returns
    -------
    re.Pattern[str]
        A compiled, anchored (``^…$``) regex.

    Examples
    --------
    >>> glob_to_regex("**/*.go").match("services/api/main.go") is not None
    True
    >>> glob_to_regex("*.py").match("pkg/app.py") is None
    True
    """
    out: list[str] = ["^"]
    i = 0
    while i < len(pattern):
        if pattern[i : i + 3] == "**/":
            out.append("(?:.*/)?")
            i += 3
        elif pattern[i : i + 2] == "**":
            out.append(".*")
            i += 2
        elif pattern[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    out.append("$")
    return re.compile("".join(out))


def matches_any(path: str, patterns: Iterable[str]) -> bool:
    """Return ``True`` when ``path`` matches at least one glob in ``patterns``.

    Parameters
    ----------
    path : str
        A repo-relative changed-file path.
    patterns : Iterable[str]
        Path globs to test against.

    Returns
    -------
    bool
        ``True`` if any pattern matches; ``False`` for an empty pattern set.

    Examples
    --------
    >>> matches_any("services/api/main.go", ["**/*.ts", "**/*.go"])
    True
    """
    return any(glob_to_regex(glob).match(path) is not None for glob in patterns)
