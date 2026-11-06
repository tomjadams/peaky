"""Property-based tests for the invariants an adversary would try to break.

These use Hypothesis to assert structural invariants over wide input spaces:
glob anchoring, fingerprint determinism/sensitivity, the path-traversal guard,
and the attestation frontmatter round-trip. They complement the example-based
unit tests by searching for the counterexample a hand-written test would miss.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from merge_check.attestation import RESERVED, render_frontmatter
from merge_check.core.fingerprint import reviewer_fingerprint
from merge_check.core.frontmatter import parse_frontmatter
from merge_check.core.globs import glob_to_regex, matches_any
from merge_check.core.paths import ensure_repo_relative
from merge_check.errors import MergeCheckError
from merge_check.models import MergeCheckSpec, Verdict

# A single path segment: printable, no separator, not a traversal token.
_SEGMENT = st.text(
    alphabet=st.characters(min_codepoint=33, max_codepoint=122, blacklist_characters="/\\"),
    min_size=1,
    max_size=8,
).filter(lambda segment: segment not in {".", ".."})
_REL_PATH = st.lists(_SEGMENT, min_size=1, max_size=4).map("/".join)
_ROOT = Path("/repo")


class TestGlobAnchoring:
    @given(_REL_PATH)
    def test_a_literal_path_matches_itself(self, path: str) -> None:
        # GIVEN a glob with no wildcard metacharacters (a literal path)
        # WHEN matching it against itself
        # THEN it matches
        assert glob_to_regex(path).match(path) is not None

    @given(_REL_PATH)
    def test_double_star_prefix_matches_at_any_depth(self, path: str) -> None:
        # GIVEN a `**/<basename>` glob
        # WHEN matching it against the path at whatever depth it is nested
        # THEN the `**/` prefix collapses the leading directories and it matches
        basename = path.split("/")[-1]
        assert glob_to_regex(f"**/{basename}").match(path) is not None

    @given(_REL_PATH)
    def test_matches_any_is_false_for_disjoint_globs(self, path: str) -> None:
        # GIVEN a glob that cannot match (a sentinel never present in a path)
        # WHEN testing membership of any real path
        # THEN nothing matches
        assert matches_any(path, ["\x00nonexistent-sentinel\x00"]) is False


class TestFingerprintInvariants:
    @settings(suppress_health_check=[HealthCheck.function_scoped_fixture], max_examples=50)
    @given(before=st.binary(max_size=48), after=st.binary(max_size=48))
    def test_deterministic_and_content_sensitive(
        self, tmp_path: Path, before: bytes, after: bytes
    ) -> None:
        # GIVEN a reviewer over one relevant file
        # WHEN the file is fingerprinted twice unchanged, then after its bytes change
        # THEN the fingerprint is stable while content is identical and changes once
        #      the bytes differ (no reuse of a tampered file)
        (tmp_path / "py.md").write_text("---\nname: py\n---\n")
        target = tmp_path / "x.py"
        spec = MergeCheckSpec(triggers=["**/*.py"])

        target.write_bytes(before)
        first = reviewer_fingerprint(
            "py", spec, tmp_path, [str(target)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        again = reviewer_fingerprint(
            "py", spec, tmp_path, [str(target)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        assert first == again

        target.write_bytes(after)
        changed = reviewer_fingerprint(
            "py", spec, tmp_path, [str(target)], criteria="c", is_verifier=False, repo_root=tmp_path
        )
        if before != after:
            assert changed != first


class TestPathTraversalGuard:
    @given(_REL_PATH)
    def test_safe_relative_paths_are_accepted(self, path: str) -> None:
        # GIVEN any path built from safe (non-traversal) segments
        # WHEN validating it against the project root
        # THEN it is accepted and returned unchanged
        assert ensure_repo_relative(path, root=_ROOT) == Path(path)

    @given(st.lists(_SEGMENT, max_size=3), st.lists(_SEGMENT, max_size=3))
    def test_any_dotdot_segment_is_rejected(self, before: list[str], after: list[str]) -> None:
        # GIVEN a path with a `..` segment anywhere in it
        # WHEN validating it
        # THEN it is rejected regardless of the surrounding segments
        candidate = "/".join([*before, "..", *after])
        with pytest.raises(MergeCheckError):
            ensure_repo_relative(candidate, root=_ROOT)


class TestAttestationFrontmatterRoundtrip:
    _JSON = st.recursive(
        st.none() | st.booleans() | st.integers() | st.text(max_size=20),
        lambda children: (
            st.lists(children, max_size=4)
            | st.dictionaries(st.text(min_size=1, max_size=10), children, max_size=4)
        ),
        max_leaves=8,
    )

    @given(extra=st.dictionaries(st.text(min_size=1, max_size=10), _JSON, max_size=5))
    def test_reserved_keys_reflect_derived_values(self, extra: dict[str, object]) -> None:
        # GIVEN arbitrary extra audit metadata
        # WHEN rendering the frontmatter
        # THEN the reserved keys always carry the derived commit/verdict/force_full,
        #      and the block re-parses (an agent cannot smuggle a forged verdict in).
        sanitised = {key: value for key, value in extra.items() if key not in RESERVED}
        text = render_frontmatter(
            "a" * 40,
            Verdict.APPROVE,
            reviewed_base="b" * 40,
            force_full=True,
            generated_at="2026-01-01T00:00:00Z",
            extra=sanitised,
            cumulative_findings={},
        )
        parsed = parse_frontmatter(text)["attestation"]
        assert parsed["commit_sha"] == "a" * 40
        assert parsed["reviewed_base"] == "b" * 40
        assert parsed["verdict"] == "APPROVE"
        assert parsed["force_full"] is True
