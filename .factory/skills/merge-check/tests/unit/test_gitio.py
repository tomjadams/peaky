"""Unit tests for git primitives (worktree-ref safety)."""

from __future__ import annotations

from merge_check.core.gitio import WORKTREE_REF_RE


class TestWorktreeRefRe:
    """Behaviour tests pinning :data:`WORKTREE_REF_RE` safety guarantees."""

    def test_accepts_a_normal_branch_name(self) -> None:
        # GIVEN a normal GitLab head / branch ref
        # WHEN the regex evaluates it
        # THEN it accepts the full match
        assert WORKTREE_REF_RE.fullmatch("main") is not None
        assert WORKTREE_REF_RE.fullmatch("feature/foo-bar") is not None
        assert WORKTREE_REF_RE.fullmatch("refs/heads/main") is not None

    def test_rejects_a_leading_hyphen(self) -> None:
        # GIVEN a token whose first character is a hyphen (option-flag shaped)
        # WHEN the regex evaluates it
        # THEN it MUST refuse the match — a leading ``-`` would let
        #      ``git checkout`` accept it as a flag bit, which is the exact
        #      bypass the regex's first-character class is here to block.
        assert WORKTREE_REF_RE.fullmatch("-refs/heads/main") is None
        assert WORKTREE_REF_RE.fullmatch("--upload-pack=foo") is None

    def test_rejects_an_empty_string(self) -> None:
        # GIVEN an empty token
        # WHEN the regex evaluates it
        # THEN it MUST refuse the match
        assert WORKTREE_REF_RE.fullmatch("") is None

    def test_rejects_a_ref_with_whitespace(self) -> None:
        # GIVEN a ref containing whitespace (a shell-injection attempt)
        # WHEN the regex evaluates it
        # THEN it MUST refuse the match
        assert WORKTREE_REF_RE.fullmatch("main; rm -rf /") is None
