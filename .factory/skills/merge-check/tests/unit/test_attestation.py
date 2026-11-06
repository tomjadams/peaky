"""Unit tests for the attestation frontmatter rendering (no git I/O).

The git-backed anti-forgery tests (verify_cache / write_attestation refusal and
write paths) live in ``tests/integration/test_git_backed.py``.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from merge_check.attestation import AttestationRequest, render_frontmatter, write_attestation
from merge_check.core.frontmatter import parse_frontmatter
from merge_check.errors import MergeCheckError
from merge_check.models import OverrideRequest, Verdict


class TestRenderFrontmatter:
    def test_derives_reserved_keys_and_nests_extra(self) -> None:
        # GIVEN a commit, verdict, and extra audit metadata
        # WHEN rendering the frontmatter
        # THEN the reserved keys and the extra map both sit under attestation:
        text = render_frontmatter(
            "0" * 40,
            Verdict.APPROVE,
            reviewed_base="1" * 40,
            force_full=True,
            generated_at="2026-01-01T00:00:00Z",
            extra={"runners_ran": ["security-reviewer"]},
            cumulative_findings={"security-reviewer": {"rounds": 1, "by_verdict": {"APPROVE": 1}}},
        )
        parsed = parse_frontmatter(text)["attestation"]
        assert parsed["commit_sha"] == "0" * 40
        assert parsed["reviewed_base"] == "1" * 40
        assert parsed["verdict"] == "APPROVE"
        assert parsed["force_full"] is True
        assert parsed["runners_ran"] == ["security-reviewer"]


class TestRenderFrontmatterOverrideRequested:
    def test_override_requested_block_round_trips_with_issue_ref(self) -> None:
        # GIVEN an OverrideRequest with reason and issue_ref (no identity)
        # WHEN rendering the frontmatter
        # THEN the override_requested block sits under attestation:
        req = OverrideRequest(reason="real-but-deferred findings in file X", issue_ref=97)
        text = render_frontmatter(
            "0" * 40,
            Verdict.NEEDS_FIX,
            reviewed_base="1" * 40,
            force_full=False,
            generated_at="2026-01-01T00:00:00Z",
            extra={},
            cumulative_findings={},
            override_requested=req,
        )
        parsed = parse_frontmatter(text)["attestation"]
        assert parsed["commit_sha"] == "0" * 40
        block = parsed["override_requested"]
        assert block["reason"] == "real-but-deferred findings in file X"
        assert block["issue_ref"] == 97
        assert "applied_by" not in block
        assert "applied_at" not in block

    def test_override_requested_block_omits_issue_ref_when_none(self) -> None:
        # GIVEN an OverrideRequest without an issue_ref
        # WHEN rendering the frontmatter
        # THEN the block does not include a null ``issue_ref`` key
        req = OverrideRequest(reason="tracking in chat for now", issue_ref=None)
        text = render_frontmatter(
            "0" * 40,
            Verdict.NEEDS_FIX,
            reviewed_base="1" * 40,
            force_full=False,
            generated_at="2026-01-01T00:00:00Z",
            extra={},
            cumulative_findings={},
            override_requested=req,
        )
        parsed = parse_frontmatter(text)["attestation"]
        block = parsed["override_requested"]
        assert "issue_ref" not in block
        assert block["reason"] == "tracking in chat for now"


class TestOverrideRequestFromCliArgs:
    def test_empty_reason_rejected(self) -> None:
        # GIVEN a CLI invocation with no reason (or a blank string)
        # WHEN building the OverrideRequest
        # THEN it fails closed on the empty reason
        with pytest.raises(MergeCheckError, match="non-empty reason"):
            OverrideRequest.from_cli_args(reason="", issue_ref=None)

    def test_out_of_range_issue_ref_rejected(self) -> None:
        # GIVEN a CLI invocation with an issue_ref that is not a positive iid
        # WHEN building the OverrideRequest
        # THEN it fails closed on the bad issue_ref
        with pytest.raises(MergeCheckError, match="positive GitLab issue iid"):
            OverrideRequest.from_cli_args(reason="ok", issue_ref=-1)

    def test_issue_ref_upper_bound_rejected(self) -> None:
        # GIVEN an issue_ref that exceeds the 32-bit int ceiling
        # WHEN building the OverrideRequest
        # THEN it fails closed on the out-of-range value
        from merge_check.models import _ISSUE_REF_MAX

        with pytest.raises(MergeCheckError, match="positive GitLab issue iid"):
            OverrideRequest.from_cli_args(reason="ok", issue_ref=_ISSUE_REF_MAX + 1)

    def test_oversized_reason_rejected(self) -> None:
        # GIVEN a CLI invocation with a reason that exceeds the 200-char ceiling
        # WHEN building the OverrideRequest
        # THEN it fails closed so the frontmatter cannot absorb prose
        with pytest.raises(MergeCheckError, match=r"<= 200 characters"):
            OverrideRequest.from_cli_args(reason="x" * 201, issue_ref=None)

    def test_valid_request_has_no_identity_fields(self) -> None:
        # GIVEN a valid reason and issue_ref
        # WHEN building the OverrideRequest
        # THEN the result carries only reason and issue_ref (no applied_by, applied_at)
        req = OverrideRequest.from_cli_args(reason="deferred findings", issue_ref=97)
        assert req.reason == "deferred findings"
        assert req.issue_ref == 97
        assert not hasattr(req, "applied_by")
        assert not hasattr(req, "applied_at")


class TestWriteAttestationPolicyGates:
    """Cover the four pre-verify policy gates in ``write_attestation``.

    These run before :func:`merge_check.attestation.verify_cache` and must reject
    a malformed caller input loudly — verified without any git I/O by stubbing
    the verify step's dependencies out of scope (the unit still exercises the
    gates because they short-circuit before the cache check).
    """

    def test_missing_out_path_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a request whose out_path is empty (the agent forgot to pass an MR IID)
        # WHEN writing
        # THEN it fails closed at the first policy gate
        request = AttestationRequest(out_path="", force_full=True)
        with pytest.raises(MergeCheckError, match="missing OUT_PATH"):
            write_attestation(request, "# report", root=tmp_path)

    def test_criteria_without_outcome_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a request whose criteria is set but --with-outcome is not
        # WHEN writing
        # THEN it fails closed (criteria require outcome verification)
        request = AttestationRequest(out_path="attestations/mr-1.md", criteria="some criterion")
        with pytest.raises(MergeCheckError, match="--with-outcome"):
            write_attestation(request, "# report", root=tmp_path)

    def test_force_full_with_skip_outcome_runner_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a force-full request that also tries to skip an outcome runner
        # WHEN writing
        # THEN it fails closed — the final gate is non-skippable
        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            force_full=True,
            skip_outcome_runner=("outcome-verifier",),
        )
        with pytest.raises(MergeCheckError, match="non-skippable"):
            write_attestation(request, "# report", root=tmp_path)

    def test_force_full_with_only_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a force-full request that also restricts the roster with --only
        # WHEN writing
        # THEN it fails closed — force-full requires the full reviewer floor
        request = AttestationRequest(
            out_path="attestations/mr-1.md",
            force_full=True,
            only=("some-droid",),
        )
        with pytest.raises(MergeCheckError, match="--only"):
            write_attestation(request, "# report", root=tmp_path)

    def test_oversized_body_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a body that exceeds the max size (writer's anti-DoS guard)
        # WHEN writing
        # THEN it fails closed before any git I/O or compute
        oversized = "x" * 10_000_001
        request = AttestationRequest(out_path="attestations/mr-1.md")
        with pytest.raises(MergeCheckError, match=r"<= 10000000 bytes"):
            write_attestation(request, oversized, root=tmp_path)

    def test_symlink_output_path_rejected(self, tmp_path: Path) -> None:
        # GIVEN a symlink at the attestation output path pointing outside the repo
        # WHEN writing
        # THEN it fails closed — the writer must not follow symlinks (security)
        out_dir = tmp_path / "attestations"
        out_dir.mkdir()
        target = tmp_path / "evil.txt"
        target.write_text("stolen", encoding="utf-8")
        symlink_path = out_dir / "mr-1.md"
        symlink_path.symlink_to(target)
        request = AttestationRequest(out_path="attestations/mr-1.md", force_full=True)
        with pytest.raises(MergeCheckError, match="symlink"):
            write_attestation(request, "# report", root=tmp_path)


class TestOverrideReasonLineBreaks:
    @pytest.mark.parametrize("char,desc", [("\n", "newline"), ("\r", "carriage return")])
    def test_rejects_line_break_in_reason(self, char: str, desc: str) -> None:
        # GIVEN an --override-requested reason that contains a literal line break
        # WHEN building the OverrideRequest
        # THEN it fails closed so the stamp frontmatter cannot absorb prose
        with pytest.raises(MergeCheckError, match="single line"):
            OverrideRequest.from_cli_args(
                reason=f"real but{char}deferred findings",
                issue_ref=None,
            )

    def test_rejects_backtick_in_reason(self) -> None:
        # GIVEN an --override-requested reason that contains a backtick
        # WHEN building the OverrideRequest
        # THEN it fails closed so backticks cannot break Markdown in the governance note
        with pytest.raises(MergeCheckError, match="backticks"):
            OverrideRequest.from_cli_args(reason="deferred`injection", issue_ref=None)
