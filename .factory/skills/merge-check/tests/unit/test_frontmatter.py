"""Unit tests for Markdown frontmatter parsing."""

from __future__ import annotations

import pytest

from merge_check.core.frontmatter import parse_frontmatter
from merge_check.errors import MergeCheckError


class TestParseFrontmatter:
    def test_parses_nested_merge_check_block(self) -> None:
        # GIVEN a droid file with a nested merge_check block
        # WHEN parsing its frontmatter
        # THEN nested mappings and lists are returned as native types
        text = (
            "---\n"
            "name: go-reviewer\n"
            "merge_check:\n"
            '  triggers: ["**/*.go"]\n'
            "  always: false\n"
            "---\n"
            "# body\n"
        )
        fm = parse_frontmatter(text)
        assert fm["name"] == "go-reviewer"
        assert fm["merge_check"]["triggers"] == ["**/*.go"]
        assert fm["merge_check"]["always"] is False

    def test_parses_block_style_list(self) -> None:
        # GIVEN triggers written as a block-style YAML list
        # WHEN parsing
        # THEN every item is captured in order
        text = "---\nmerge_check:\n  triggers:\n    - 'app/**/*.ts'\n    - 'server/**/*.ts'\n---\n"
        assert parse_frontmatter(text)["merge_check"]["triggers"] == [
            "app/**/*.ts",
            "server/**/*.ts",
        ]

    def test_no_frontmatter_returns_empty_mapping(self) -> None:
        # GIVEN a file that does not open with a frontmatter fence
        # WHEN parsing
        # THEN an empty mapping is returned (the file simply never auto-routes)
        assert parse_frontmatter("# just a heading\n") == {}

    def test_unterminated_frontmatter_returns_empty_mapping(self) -> None:
        # GIVEN an opening fence with no closing fence
        # WHEN parsing
        # THEN there is no complete block, so an empty mapping is returned
        assert parse_frontmatter("---\nname: x\nno closing fence\n") == {}

    def test_empty_frontmatter_body_returns_empty_mapping(self) -> None:
        # GIVEN a frontmatter block whose YAML body parses to None (an empty body)
        # WHEN parsing
        # THEN the ``parsed is None`` branch returns an empty mapping rather than
        #      raising — the file has well-formed fences but no metadata
        assert parse_frontmatter("---\n---\n# no metadata\n") == {}

    def test_preserves_native_scalar_types(self) -> None:
        # GIVEN a frontmatter with an integer and a boolean
        # WHEN parsing
        # THEN YAML scalar typing is preserved (int stays int, not str)
        fm = parse_frontmatter("---\nschema_version: 1\nforce_full: true\n---\n")
        assert fm["schema_version"] == 1
        assert fm["force_full"] is True

    def test_malformed_yaml_fails_closed(self) -> None:
        # GIVEN frontmatter that is not valid YAML
        # WHEN parsing
        # THEN it raises a domain error rather than silently yielding {}
        with pytest.raises(MergeCheckError, match="frontmatter"):
            parse_frontmatter("---\nkey: [unterminated\n---\n")

    def test_non_mapping_frontmatter_fails_closed(self) -> None:
        # GIVEN frontmatter whose body is a YAML list, not a mapping
        # WHEN parsing
        # THEN it raises rather than returning a non-dict
        with pytest.raises(MergeCheckError, match="mapping"):
            parse_frontmatter("---\n- a\n- b\n---\n")
