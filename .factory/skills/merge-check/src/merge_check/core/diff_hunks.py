"""Parse unified diff hunks and classify lines as in-diff or pre-existing.

A finding whose evidence anchors entirely outside the MR's changed lines must not
gate the merge. This module parses the unified diff (``git diff`` output) to
extract per-file changed line ranges, then classifies each finding's evidence
(file:line) as ``in_diff`` or ``pre_existing``.

The classification is deterministic and planner-side, not droid-side, so a droid
cannot misclassify to bypass the gate.
"""

from __future__ import annotations

import re

from merge_check.errors import MergeCheckError

# Unified diff hunk header: @@ -old_start,old_count +new_start,new_count @@
_HUNK_HEADER_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")

# Diff file header: --- a/path or +++ b/path
_FILE_HEADER_RE = re.compile(r"^\+\+\+ b/(.+)$")

_MAX_DIFF_BYTES = 10_000_000

# Finding JSON wire keys — shared with the classify CLI subcommand.
KEY_FILE = "file"
KEY_LINE = "line"
KEY_CLASSIFICATION = "classification"

# Classification values.
CLASSIFICATION_IN_DIFF = "in_diff"
CLASSIFICATION_PRE_EXISTING = "pre_existing"


def parse_diff_hunks(diff_text: str) -> dict[str, set[int]]:
    """Parse a unified diff and return per-file changed line number sets.

    Only the *new* file's line numbers (the ``+`` side) are tracked. Context
    lines and removal lines (``-``) are excluded from the changed set.

    Parameters
    ----------
    diff_text : str
        Unified diff output from ``git diff``.

    Returns
    -------
    dict[str, set[int]]
        Mapping from file path to the set of changed line numbers (new side).

    Raises
    ------
    MergeCheckError
        When the diff exceeds the size limit.

    Examples
    --------
    >>> diff = "+++ b/pkg/x.py\\n@@ -10,6 +10,8 @@\\n context\\n+added\\n"
    >>> hunks = parse_diff_hunks(diff)
    >>> 11 in hunks["pkg/x.py"]
    True
    """
    if len(diff_text.encode("utf-8")) > _MAX_DIFF_BYTES:
        raise MergeCheckError(f"diff must be <= {_MAX_DIFF_BYTES} bytes")
    hunks: dict[str, set[int]] = {}
    current_file: str | None = None
    new_line: int = 0
    for line in diff_text.splitlines():
        file_match = _FILE_HEADER_RE.match(line)
        if file_match:
            current_file = file_match.group(1)
            hunks.setdefault(current_file, set())
            continue
        hunk_match = _HUNK_HEADER_RE.match(line)
        if hunk_match:
            new_line = int(hunk_match.group(1))
            continue
        if current_file is None:
            continue
        if line.startswith(" "):
            # Context line — present in both old and new, not a changed line
            new_line += 1
        elif line.startswith("+"):
            hunks[current_file].add(new_line)
            new_line += 1
        elif line.startswith("-"):
            # Removal line — present in old only
            pass
        # Binary diffs, "\ No newline" markers, etc. are silently ignored
    return hunks


def classify_finding(
    hunks: dict[str, set[int]], file_path: str, line_number: int
) -> str:
    """Classify whether a finding's evidence line is in-diff or pre-existing.

    Parameters
    ----------
    hunks : dict[str, set[int]]
        Per-file changed line sets from :func:`parse_diff_hunks`.
    file_path : str
        The finding's evidence file path.
    line_number : int
        The finding's evidence line number (1-based).

    Returns
    -------
    str
        :data:`CLASSIFICATION_IN_DIFF` when the line falls within a diff hunk for
        that file, :data:`CLASSIFICATION_PRE_EXISTING` otherwise.

    Examples
    --------
    >>> classify_finding({"pkg/x.py": {10, 11, 12}}, "pkg/x.py", 11)
    'in_diff'
    >>> classify_finding({"pkg/x.py": {10, 11}}, "pkg/x.py", 99)
    'pre_existing'
    """
    changed_lines = hunks.get(file_path)
    if changed_lines is None:
        return CLASSIFICATION_PRE_EXISTING
    return CLASSIFICATION_IN_DIFF if line_number in changed_lines else CLASSIFICATION_PRE_EXISTING


def classify_findings(
    diff_text: str,
    findings: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Classify a list of findings against the diff.

    Each finding dict must have ``file`` (str) and ``line`` (int) keys. A new
    ``classification`` key (``"in_diff"`` or ``"pre_existing"``) is added.

    Parameters
    ----------
    diff_text : str
        Unified diff text.
    findings : list[dict[str, object]]
        Findings to classify.

    Returns
    -------
    list[dict[str, object]]
        The same findings with ``classification`` added.

    Examples
    --------
    >>> classify_findings(
    ...     "+++ b/pkg/x.py\\n@@ -1,0 +1,2 @@\\n+new\\n",
    ...     [{"file": "pkg/x.py", "line": 1, "text": "foo"}],
    ... )
    [{'file': 'pkg/x.py', 'line': 1, 'text': 'foo', 'classification': 'in_diff'}]
    """
    hunks = parse_diff_hunks(diff_text)
    result: list[dict[str, object]] = []
    for finding in findings:
        file_path = str(finding.get(KEY_FILE, ""))
        raw_line = finding.get(KEY_LINE, 0)
        line_number = int(raw_line) if isinstance(raw_line, (int, float, str)) else 0
        classification = classify_finding(hunks, file_path, line_number)
        result.append({**finding, KEY_CLASSIFICATION: classification})
    return result
