"""CLI-specific tests for write_attestation.py (argparse / guard rails)."""

from __future__ import annotations

import pytest

from merge_check.cli.write_attestation import main


class TestOverrideCliGuards:
    def test_override_issue_ref_without_override_requested_rejected(
        self, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # GIVEN only --override-issue-ref (no --override-requested reason)
        # WHEN main() is invoked
        # THEN it exits non-zero with the expected diagnostic on stderr
        rc = main(["attestations/mr-1.md", "--override-issue-ref", "97"])
        assert rc == 2
        out = capsys.readouterr()
        assert "--override-issue-ref requires --override-requested" in out.err
