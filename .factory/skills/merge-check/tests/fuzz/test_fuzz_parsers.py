"""Hypothesis fuzz harnesses for the untrusted-input parsers and CLIs.

Every parser that consumes agent- or repo-supplied input must be *total*: for any
input it either returns a well-typed result or raises the designated fail-closed
:class:`~merge_check.errors.MergeCheckError`. An escaping ``ValueError``,
``KeyError``, ``TypeError`` (or a silent wrong answer) is a finding — that is the
gap an adversary feeding crafted JSON/YAML/argv would drive a crash or a bypass
through. The argparse front-ends additionally exit via ``SystemExit`` on bad
flags, which is expected, not a crash.

These run in the default suite via Hypothesis. Optional coverage-guided
``atheris`` harnesses (a ``fuzz`` extra) can drive the same callables harder, but
are not required because the invariant under test is total fail-closed behaviour,
which Hypothesis already searches.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

from hypothesis import given
from hypothesis import strategies as st

from merge_check.cli import discover_roster, merge_check_config
from merge_check.config import MergeCheckConfig, load_config
from merge_check.core.frontmatter import parse_frontmatter
from merge_check.errors import MergeCheckError
from merge_check.sensor import SensorSpec, parse_spec

# Arbitrary JSON-shaped values, to exercise the structured branches of the parsers.
_JSON = st.recursive(
    st.none() | st.booleans() | st.integers() | st.floats(allow_nan=False) | st.text(max_size=20),
    lambda children: (
        st.lists(children, max_size=4) | st.dictionaries(st.text(max_size=10), children, max_size=4)
    ),
    max_leaves=10,
)


class TestFrontmatterIsTotal:
    @given(st.text(max_size=300))
    def test_arbitrary_text_yields_dict_or_fails_closed(self, text: str) -> None:
        # GIVEN any text
        # WHEN parsing frontmatter
        # THEN the only escape is MergeCheckError; otherwise a dict is returned
        try:
            result = parse_frontmatter(text)
        except MergeCheckError:
            return
        assert isinstance(result, dict)


class TestSensorSpecIsTotal:
    @given(st.text(max_size=300))
    def test_arbitrary_text_payload_fails_closed(self, payload: str) -> None:
        # GIVEN any raw text on the sensor's stdin
        # WHEN parsing the spec
        # THEN it returns a SensorSpec or fails closed with MergeCheckError
        try:
            spec = parse_spec(payload)
        except MergeCheckError:
            return
        assert isinstance(spec, SensorSpec)

    @given(_JSON)
    def test_structured_json_payload_fails_closed(self, obj: object) -> None:
        # GIVEN any JSON-shaped sensor spec
        # WHEN parsing it
        # THEN it returns a SensorSpec or fails closed with MergeCheckError
        try:
            spec = parse_spec(json.dumps(obj))
        except MergeCheckError:
            return
        assert isinstance(spec, SensorSpec)


class TestConfigIsTotal:
    @given(st.text(max_size=300))
    def test_arbitrary_yaml_config_fails_closed(self, text: str) -> None:
        # GIVEN any text written as a config file
        # WHEN loading it
        # THEN it returns a MergeCheckConfig or fails closed with MergeCheckError
        # Use a TemporaryDirectory context manager so the directory is removed
        # after every Hypothesis example — bare ``mkdtemp`` would leak a tree
        # per example (and on the order of ``max_examples=10`` per fuzz run).
        with tempfile.TemporaryDirectory() as tmp_str:
            root = Path(tmp_str)
            (root / "merge-check.yml").write_text(text, encoding="utf-8")
            try:
                config = load_config("merge-check.yml", root=root)
            except MergeCheckError:
                return
            assert isinstance(config, MergeCheckConfig)


class TestArgparseFrontEndsNeverCrash:
    _ARGV = st.lists(st.text(max_size=12), max_size=6)

    @given(_ARGV)
    def test_config_cli_returns_int_or_exits(self, argv: list[str]) -> None:
        # GIVEN any argv (excluding the destructive --init / --path writers)
        # WHEN driving the config CLI
        # THEN it returns an int or exits via argparse — never an unhandled crash
        if any(token in {"--init", "--path"} for token in argv):
            return
        try:
            result = merge_check_config.main(argv)
        except SystemExit:
            return
        assert isinstance(result, int)

    @given(_ARGV)
    def test_roster_cli_returns_int_or_exits(self, argv: list[str]) -> None:
        # GIVEN any argv
        # WHEN driving the roster CLI
        # THEN it returns an int or exits via argparse — never an unhandled crash
        if not argv:
            # Empty argv drops the CLI into stdin-reading mode, which crashes under
            # pytest capture ("reading from stdin while output is captured"). Skip
            # that one degenerate input — the parent test_roster_* already covers
            # empty-argv explicitly via the CLI entry point.
            return
        try:
            result = discover_roster.main(argv)
        except SystemExit:
            return
        assert isinstance(result, int)
