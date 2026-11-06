"""Unit tests for reviewer-roster discovery and routing."""

from __future__ import annotations

from pathlib import Path

from merge_check.models import MergeCheckSpec, RosterMode
from merge_check.roster import audit, discover, is_verifier_role, load_droids, parse_spec


class TestParseSpec:
    def test_reads_inline_and_always(self) -> None:
        # GIVEN a droid with inline triggers and always: true
        # WHEN parsing the spec
        # THEN triggers and the always floor flag are captured
        spec = parse_spec("---\nmerge_check:\n  triggers: ['**/*.go']\n  always: true\n---\n")
        assert spec.triggers == ["**/*.go"]
        assert spec.always is True
        assert spec.has_block is True

    def test_block_list_triggers(self) -> None:
        # GIVEN triggers written as a block-style list
        # WHEN parsing
        # THEN each item is captured
        spec = parse_spec("---\nmerge_check:\n  triggers:\n    - 'a/**'\n    - 'b/**'\n---\n")
        assert spec.triggers == ["a/**", "b/**"]

    def test_truthy_one_is_always(self) -> None:
        # GIVEN always written as the scalar 1 (not a YAML bool)
        # WHEN parsing
        # THEN it is treated as the always floor, matching the legacy truthy rule
        assert parse_spec("---\nmerge_check:\n  always: 1\n---\n").always is True

    def test_no_block_is_dormant(self) -> None:
        # GIVEN a droid frontmatter without a merge_check block
        # WHEN parsing
        # THEN has_block is False so the droid never auto-routes
        spec = parse_spec("---\nname: x\n---\n")
        assert spec.has_block is False
        assert spec.triggers == []


class TestDiscover:
    def _droids(self) -> dict[str, MergeCheckSpec]:
        return {
            "go-reviewer": MergeCheckSpec(triggers=["**/*.go"], has_block=True),
            "ts-reviewer": MergeCheckSpec(triggers=["**/*.ts"], has_block=True),
            "security-reviewer": MergeCheckSpec(always=True, has_block=True),
            "outcome-verifier": MergeCheckSpec(has_block=False),
        }

    def test_path_mode_routes_by_trigger_and_includes_floor(self) -> None:
        # GIVEN a Go change
        # WHEN discovering in path mode without outcome
        # THEN the Go reviewer routes, the always floor joins, verifier stays out
        roster = discover(
            self._droids(),
            ["services/api/main.go"],
            mode=RosterMode.PATH,
            only=[],
            with_outcome=False,
        )
        assert roster == {"go-reviewer", "security-reviewer"}

    def test_with_outcome_adds_verifier_role(self) -> None:
        # GIVEN criteria resolved (with_outcome)
        # WHEN discovering
        # THEN the verifier-role droid joins
        roster = discover(
            self._droids(), ["main.go"], mode=RosterMode.PATH, only=[], with_outcome=True
        )
        assert "outcome-verifier" in roster

    def test_all_mode_excludes_verifiers_but_keeps_floor(self) -> None:
        # GIVEN --all without outcome
        # WHEN discovering
        # THEN every non-verifier droid is selected, verifier excluded
        roster = discover(self._droids(), [], mode=RosterMode.ALL, only=[], with_outcome=False)
        assert "outcome-verifier" not in roster
        assert {"go-reviewer", "ts-reviewer", "security-reviewer"} <= roster

    def test_only_mode_still_unions_the_always_floor(self) -> None:
        # GIVEN --only ts-reviewer
        # WHEN discovering
        # THEN the explicit droid AND the non-bypassable always floor are present
        roster = discover(
            self._droids(), [], mode=RosterMode.ONLY, only=["ts-reviewer"], with_outcome=False
        )
        assert roster == {"ts-reviewer", "security-reviewer"}


class TestAudit:
    def test_flags_droid_without_block_as_dormant(self) -> None:
        # GIVEN a droid with no merge_check block and a wired one
        # WHEN auditing
        # THEN only the unannotated non-verifier droid is reported dormant
        droids = {
            "go-reviewer": MergeCheckSpec(triggers=["**/*.go"], has_block=True),
            "stray-reviewer": MergeCheckSpec(has_block=False),
        }
        _lines, dormant = audit(droids)
        assert dormant == ["stray-reviewer"]


def test_load_droids_reads_directory(tmp_path: Path) -> None:
    # GIVEN a droids directory with one annotated reviewer
    # WHEN loading the directory
    # THEN the spec is keyed by filename stem
    (tmp_path / "go-reviewer.md").write_text("---\nmerge_check:\n  triggers: ['**/*.go']\n---\n")
    droids = load_droids(tmp_path)
    assert droids["go-reviewer"].triggers == ["**/*.go"]


def test_is_verifier_role_recognises_suffix() -> None:
    # GIVEN verifier and non-verifier names
    # WHEN checking the role
    # THEN only the -verifier suffix is recognised
    assert is_verifier_role("compliance-verifier") is True
    assert is_verifier_role("python-reviewer") is False
