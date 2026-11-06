"""Unit tests for path-glob translation and matching."""

from __future__ import annotations

import pytest

from merge_check.core.globs import glob_to_regex, matches_any


class TestGlobToRegex:
    def test_single_star_stays_within_one_segment(self) -> None:
        # GIVEN a single-star glob
        # WHEN matching paths with and without a separator
        # THEN it matches within a segment but not across one
        rx = glob_to_regex("*.py")
        assert rx.match("app.py") is not None
        assert rx.match("pkg/app.py") is None

    def test_double_star_slash_matches_any_leading_dirs(self) -> None:
        # GIVEN a `**/` prefix glob
        # WHEN matching both a top-level and a deeply nested file
        # THEN both match because `**/` collapses leading directories
        rx = glob_to_regex("**/*.go")
        assert rx.match("main.go") is not None
        assert rx.match("services/api/main.go") is not None
        assert rx.match("main.rs") is None

    def test_double_star_matches_across_separators(self) -> None:
        # GIVEN a bare `**` in the middle of a glob
        # WHEN matching a path with intervening directories
        # THEN the `**` spans separators
        rx = glob_to_regex("app/**/db")
        assert rx.match("app/x/y/db") is not None
        assert rx.match("app/db") is not None

    def test_question_mark_matches_one_non_separator(self) -> None:
        # GIVEN a `?` glob
        # WHEN matching one character versus a separator
        # THEN `?` matches exactly one non-separator character
        rx = glob_to_regex("a?c")
        assert rx.match("abc") is not None
        assert rx.match("a/c") is None

    def test_is_fully_anchored(self) -> None:
        # GIVEN a literal glob
        # WHEN a candidate has a matching prefix but extra trailing text
        # THEN the anchored regex rejects it (no partial match)
        rx = glob_to_regex("Pulumi.yaml")
        assert rx.match("Pulumi.yaml") is not None
        assert rx.match("Pulumi.yaml.bak") is None

    def test_dot_is_treated_literally(self) -> None:
        # GIVEN a glob containing a dot
        # WHEN matching a string where the dot position holds another character
        # THEN the dot is literal, not a regex wildcard
        rx = glob_to_regex("a.c")
        assert rx.match("axc") is None


class TestMatchesAny:
    def test_true_when_any_pattern_matches(self) -> None:
        # GIVEN several globs and a path matching the second
        # WHEN testing membership
        # THEN the result is True
        assert matches_any("services/api/main.go", ["**/*.ts", "**/*.go"]) is True

    def test_false_when_no_pattern_matches(self) -> None:
        # GIVEN globs that none of which match the path
        # WHEN testing membership
        # THEN the result is False
        assert matches_any("README.md", ["**/*.ts", "**/*.go"]) is False

    def test_empty_pattern_list_never_matches(self) -> None:
        # GIVEN an empty pattern list
        # WHEN testing any path
        # THEN nothing matches
        assert matches_any("anything.py", []) is False


@pytest.mark.parametrize(
    ("glob", "path"),
    [
        ("app/**/*.ts", "app/components/Button.ts"),
        (".factory/droids/*.md", ".factory/droids/python-reviewer.md"),
        ("**/Pulumi.*.yaml", "infra/Pulumi.prod.yaml"),
    ],
)
def test_representative_droid_triggers_match(glob: str, path: str) -> None:
    # GIVEN a real droid trigger glob and a path it should route
    # WHEN matching
    # THEN the path is routed
    assert glob_to_regex(glob).match(path) is not None
