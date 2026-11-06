"""Unit tests for diff-hunk parsing and finding classification."""

from __future__ import annotations

from merge_check.core.diff_hunks import (
    classify_finding,
    classify_findings,
    parse_diff_hunks,
)


class TestParseDiffHunks:
    def test_empty_diff_returns_empty(self) -> None:
        assert parse_diff_hunks("") == {}

    def test_single_file_single_hunk(self) -> None:
        # GIVEN a diff with one file and one hunk adding a single line
        diff = "+++ b/pkg/x.py\n@@ -0,0 +1 @@\n+added_line\n"
        hunks = parse_diff_hunks(diff)
        assert hunks == {"pkg/x.py": {1}}

    def test_context_lines_not_in_changed_set(self) -> None:
        # GIVEN a hunk where line 10 is context (unchanged)
        diff = "+++ b/pkg/x.py\n@@ -10,3 +10,3 @@\n unchanged\n+added\n unchanged\n"
        hunks = parse_diff_hunks(diff)
        assert 10 not in hunks["pkg/x.py"]
        assert 11 in hunks["pkg/x.py"]  # the added line

    def test_removal_lines_not_in_changed_set(self) -> None:
        # GIVEN a hunk where a line is removed
        diff = "+++ b/pkg/x.py\n@@ -10,3 +10,2 @@\n unchanged\n-removed\n unchanged\n"
        hunks = parse_diff_hunks(diff)
        assert "pkg/x.py" in hunks
        assert not hunks["pkg/x.py"]  # no additions

    def test_multiple_files(self) -> None:
        # GIVEN a diff touching two files
        diff = (
            "+++ b/pkg/a.py\n@@ -1,0 +1,2 @@\n+line1\n+line2\n"
            "+++ b/pkg/b.py\n@@ -5,0 +5,1 @@\n+line3\n"
        )
        hunks = parse_diff_hunks(diff)
        assert hunks == {"pkg/a.py": {1, 2}, "pkg/b.py": {5}}

    def test_multi_hunk_file(self) -> None:
        # GIVEN a file with two hunks at different line ranges
        diff = (
            "+++ b/pkg/x.py\n"
            "@@ -10,2 +10,3 @@\n unchanged\n+added1\n unchanged\n"
            "@@ -50,1 +51,2 @@\n unchanged\n+added2\n"
        )
        hunks = parse_diff_hunks(diff)
        assert hunks["pkg/x.py"] == {11, 52}

    def test_binary_diff_skipped(self) -> None:
        # GIVEN a binary file diff (no @@ headers)
        diff = "+++ b/pkg/icon.png\nBinary files differ\n"
        hunks = parse_diff_hunks(diff)
        assert "pkg/icon.png" in hunks
        assert hunks["pkg/icon.png"] == set()


class TestClassifyFinding:
    def test_in_diff_when_line_in_hunk(self) -> None:
        assert classify_finding({"pkg/x.py": {10, 11}}, "pkg/x.py", 11) == "in_diff"

    def test_pre_existing_when_line_not_in_hunk(self) -> None:
        assert classify_finding({"pkg/x.py": {10, 11}}, "pkg/x.py", 99) == "pre_existing"

    def test_pre_existing_when_file_not_in_diff(self) -> None:
        assert classify_finding({"pkg/x.py": {10}}, "pkg/y.py", 10) == "pre_existing"

    def test_pre_existing_when_empty_hunks(self) -> None:
        assert classify_finding({}, "pkg/x.py", 1) == "pre_existing"


class TestClassifyFindings:
    def test_classifies_multiple_findings(self) -> None:
        # GIVEN a diff with one added line at position 1 and findings on lines 1 and 99
        diff = "+++ b/pkg/x.py\n@@ -1,0 +1,2 @@\n+line1\n+line2\n"
        findings = [
            {"file": "pkg/x.py", "line": 1, "severity": "WARN"},
            {"file": "pkg/x.py", "line": 99, "severity": "INFO"},
        ]
        classified = classify_findings(diff, findings)
        assert classified == [
            {"file": "pkg/x.py", "line": 1, "severity": "WARN", "classification": "in_diff"},
            {"file": "pkg/x.py", "line": 99, "severity": "INFO", "classification": "pre_existing"},
        ]

    def test_does_not_mutate_input(self) -> None:
        diff = "+++ b/pkg/x.py\n@@ -1,0 +1,1 @@\n+line1\n"
        findings = [{"file": "pkg/x.py", "line": 1}]
        original = dict(findings[0])
        classify_findings(diff, findings)
        assert findings[0] == original  # input unchanged

    def test_round_trips_deterministically(self) -> None:
        # GIVEN the same diff and findings called twice
        diff = "+++ b/pkg/x.py\n@@ -10,3 +10,3 @@\n ctx\n+added\n ctx\n"
        findings = [{"file": "pkg/x.py", "line": 11}]
        a = classify_findings(diff, findings)
        b = classify_findings(diff, findings)
        assert a == b
