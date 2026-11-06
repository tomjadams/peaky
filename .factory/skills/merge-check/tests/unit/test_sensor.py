"""Unit tests for the discrimination sensor's parsing, scoring, and isolation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from merge_check.errors import MergeCheckError
from merge_check.sensor import (
    ERRORED,
    KILLED,
    SURVIVED,
    parse_spec,
    parse_test_command,
    ran_no_tests,
    score,
    summary_exit_code,
)


class TestRanNoTests:
    @pytest.mark.parametrize(
        "output",
        [
            "===== no tests ran in 0.01s =====",  # pytest
            "collected 0 items",  # pytest
            "No test files found, exiting with code 1",  # vitest
            "?   example/pkg   [no test files]",  # go (pure no-test package)
            "No tests found, exiting with code 1",  # jest
        ],
    )
    def test_zero_test_markers_are_detected(self, output: str) -> None:
        # GIVEN a green run whose output signals it collected/ran zero tests
        # WHEN checking ran_no_tests
        # THEN it returns True so the baseline can fail closed
        assert ran_no_tests(output) is True

    @pytest.mark.parametrize("output", ["5 passed in 0.30s", "ok  example/pkg  0.2s", ""])
    def test_real_or_empty_output_is_not_flagged(self, output: str) -> None:
        # GIVEN output that shows tests actually ran (or is empty)
        # WHEN checking ran_no_tests
        # THEN it returns False
        assert ran_no_tests(output) is False

    @pytest.mark.parametrize(
        "output",
        [
            # GIVEN mixed Go output where one package has no test files but another passed
            # (the MR !110 forensic incident: sensor falsely flagged this as zero-tests)
            "?   example/noop   [no test files]\nok  example/core   0.003s\n",
            # GIVEN output with both [no test files] and --- PASS from another package
            "?   example/noop   [no test files]\n--- PASS: TestFoo (0.00s)\n",
            # GIVEN output with "collected 0 items" (from a sub-suite) and "1 passed"
            "collected 0 items / 1 selected\n1 passed in 0.01s\n",
        ],
    )
    def test_positive_evidence_clears_zero_test_marker(self, output: str) -> None:
        # GIVEN output that contains a zero-test marker but also positive evidence
        # WHEN checking ran_no_tests
        # THEN it returns False because the positive-evidence regex disarms the marker
        assert ran_no_tests(output) is False


_VALID_MUTATION = {"file": "a.py", "find": "a > b", "replace": "a >= b", "rationale": "boundary"}


class TestScore:
    @pytest.mark.parametrize(
        ("exit_code", "expected"),
        [(1, KILLED), (0, SURVIVED), (None, ERRORED)],
    )
    def test_maps_exit_code_to_verdict(self, exit_code: int | None, expected: str) -> None:
        # GIVEN a suite exit code (red, green, or timeout)
        # WHEN scoring it
        # THEN red is killed, green is survived, timeout is errored
        assert score(exit_code) == expected


class TestParseTestCommand:
    def test_plain_argv_runs_in_worktree(self, tmp_path: Path) -> None:
        # GIVEN a plain argv command
        # WHEN parsing it
        # THEN argv is returned and cwd is the worktree root
        argv, cwd = parse_test_command("pytest -q", tmp_path)
        assert argv == ["pytest", "-q"]
        assert cwd == tmp_path

    def test_leading_cd_changes_directory(self, tmp_path: Path) -> None:
        # GIVEN a `cd <dir> && <command>` form
        # WHEN parsing it
        # THEN cwd is the subdirectory and argv excludes the cd prefix
        (tmp_path / "services").mkdir()
        argv, cwd = parse_test_command("cd services && go test ./...", tmp_path)
        assert argv == ["go", "test", "./..."]
        assert cwd == tmp_path / "services"

    def test_rejects_cd_target_outside_worktree(self, tmp_path: Path) -> None:
        # GIVEN a cd target that escapes the worktree
        # WHEN parsing
        # THEN it fails closed
        with pytest.raises(MergeCheckError, match="outside the worktree"):
            parse_test_command("cd ../escape && go test", tmp_path)

    def test_rejects_extra_shell_operators(self, tmp_path: Path) -> None:
        # GIVEN more than one && operator
        # WHEN parsing
        # THEN only the single leading cd form is allowed
        (tmp_path / "a").mkdir()
        with pytest.raises(MergeCheckError, match="only argv commands"):
            parse_test_command("cd a && go build && go test", tmp_path)


class TestParseSpec:
    def test_requires_test_cmd(self) -> None:
        # GIVEN a spec with no test_cmd
        # WHEN parsing
        # THEN it fails closed
        with pytest.raises(MergeCheckError, match="test_cmd"):
            parse_spec('{"mutations": []}')

    def test_requires_at_least_one_mutation(self) -> None:
        # GIVEN a spec with an empty mutations list
        # WHEN parsing
        # THEN it fails closed (selection is the orchestrator's job)
        with pytest.raises(MergeCheckError, match="no mutations"):
            parse_spec('{"test_cmd": "pytest", "mutations": []}')

    def test_rejects_more_than_three_mutations(self) -> None:
        # GIVEN four mutations
        # WHEN parsing
        # THEN it fails closed
        payload = json.dumps({"test_cmd": "pytest", "mutations": [_VALID_MUTATION] * 4})
        with pytest.raises(MergeCheckError, match="at most"):
            parse_spec(payload)

    def test_rejects_find_equal_to_replace(self) -> None:
        # GIVEN a mutation whose find equals replace
        # WHEN parsing
        # THEN it fails closed (a no-op mutation cannot be scored)
        payload = json.dumps(
            {"test_cmd": "pytest", "mutations": [{"file": "a.py", "find": "x", "replace": "x"}]}
        )
        with pytest.raises(MergeCheckError, match="must differ"):
            parse_spec(payload)

    def test_rejects_unsafe_base_ref(self) -> None:
        # GIVEN a base_ref starting with a dash
        # WHEN parsing
        # THEN it is rejected as unsafe
        payload = json.dumps(
            {"test_cmd": "pytest", "base_ref": "-x", "mutations": [_VALID_MUTATION]}
        )
        with pytest.raises(MergeCheckError, match="unsafe"):
            parse_spec(payload)

    @pytest.mark.parametrize(
        ("raw_test_cmd", "match"),
        [
            (123, "test_cmd"),  # non-string
            (True, "test_cmd"),  # non-string boolean
            ([], "test_cmd"),  # non-string list
        ],
    )
    def test_rejects_non_string_test_cmd(self, raw_test_cmd: object, match: str) -> None:
        # GIVEN a test_cmd that is not a string
        # WHEN parsing
        # THEN it fails closed (exercising the non-string branch)
        payload = json.dumps({"test_cmd": raw_test_cmd, "mutations": [_VALID_MUTATION]})
        with pytest.raises(MergeCheckError, match=match):
            parse_spec(payload)

    @pytest.mark.parametrize(
        ("raw_base_ref", "match"),
        [
            (123, "base_ref"),  # non-string
            ("has spaces", "unsafe"),  # ref regex rejects whitespace
            ("-flag", "unsafe"),  # leading dash is unsafe
        ],
    )
    def test_rejects_bad_base_ref(self, raw_base_ref: object, match: str) -> None:
        # GIVEN a base_ref that is non-string or contains unsafe characters
        # WHEN parsing
        # THEN it fails closed
        payload = json.dumps(
            {"test_cmd": "pytest", "base_ref": raw_base_ref, "mutations": [_VALID_MUTATION]}
        )
        with pytest.raises(MergeCheckError, match=match):
            parse_spec(payload)

    @pytest.mark.parametrize("raw_timeout", [0, -1, "0", "-5"])
    def test_rejects_non_positive_timeout(self, raw_timeout: object) -> None:
        # GIVEN a timeout that is zero, negative, or coerced to zero
        # WHEN parsing
        # THEN it fails closed (a zero-second timeout would score every mutant as errored)
        payload = json.dumps(
            {"test_cmd": "pytest", "timeout": raw_timeout, "mutations": [_VALID_MUTATION]}
        )
        with pytest.raises(MergeCheckError, match="timeout"):
            parse_spec(payload)

    @pytest.mark.parametrize(
        "raw_link",
        [
            "not-a-list",  # string instead of list
            [1, 2, 3],  # non-string entries
            [123, "valid/path"],  # mix of valid and non-string entries
        ],
    )
    def test_rejects_malformed_link(self, raw_link: object) -> None:
        # GIVEN a link field that is not a list-of-strings
        # WHEN parsing
        # THEN it fails closed (a non-list would silently drop link_dirs)
        payload = json.dumps(
            {"test_cmd": "pytest", "link": raw_link, "mutations": [_VALID_MUTATION]}
        )
        with pytest.raises(MergeCheckError, match="link"):
            parse_spec(payload)

    def test_accepts_a_valid_spec(self) -> None:
        # GIVEN a well-formed spec
        # WHEN parsing
        # THEN the typed spec carries the mutation and defaults
        spec = parse_spec(json.dumps({"test_cmd": "pytest", "mutations": [_VALID_MUTATION]}))
        assert spec.test_cmd == "pytest"
        assert spec.mutations[0].find == "a > b"
        assert spec.base_ref == "HEAD"


class TestSummaryExitCode:
    @pytest.mark.parametrize(
        ("summary", "expected"),
        [
            ({"errored": 1, "survived": 0}, 2),
            ({"errored": 0, "survived": 1}, 1),
            ({"errored": 0, "survived": 0}, 0),
        ],
    )
    def test_loudest_signal_wins(self, summary: dict[str, int], expected: int) -> None:
        # GIVEN a sensor summary
        # WHEN mapping it to an exit code
        # THEN errored beats survived beats all-killed
        assert summary_exit_code(summary) == expected
