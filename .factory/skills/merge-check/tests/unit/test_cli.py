"""Smoke tests for the CLI adapters (surface preservation + exit codes)."""

from __future__ import annotations

import io
import json
from pathlib import Path

import pytest

from merge_check.cli import (
    discover_roster,
    incremental_review,
    merge_check_config,
    write_attestation,
)
from merge_check.constants import KEY_BRANCH, KEY_CLASSIFY_DONE, KEY_CLASSIFY_SKIP_REASON
from merge_check.errors import MergeCheckError


class TestDiscoverRosterCli:
    def test_audit_lists_droids(self, droids_dir: Path, capsys: pytest.CaptureFixture[str]) -> None:
        # GIVEN a droids directory
        # WHEN running --audit
        # THEN it exits 0 and lists each droid's wiring
        code = discover_roster.main(["--audit", "--droids-dir", str(droids_dir)])
        out = capsys.readouterr().out
        assert code == 0
        assert out.splitlines() == [
            (
                "outcome-verifier             verifier role "
                "(filename -verifier suffix, opt-in via --change/--issue)"
            ),
            "python-reviewer              triggers: **/*.py",
            "security-reviewer            always (non-bypassable floor)",
        ]

    def test_missing_droids_dir_exits_2(self, capsys: pytest.CaptureFixture[str]) -> None:
        # GIVEN a non-existent droids dir
        # WHEN running the CLI
        # THEN it fails closed with exit 2
        code = discover_roster.main(["--audit", "--droids-dir", "does/not/exist"])
        assert code == 2
        assert capsys.readouterr().err == "[discover-roster] droids dir not found: does/not/exist\n"

    def test_path_routing_reads_stdin(
        self, droids_dir: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # GIVEN a changed .py file on stdin
        # WHEN running path-routed discovery
        # THEN the python reviewer and the floor are printed
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = discover_roster.main(["--droids-dir", str(droids_dir)])
        out = capsys.readouterr().out
        assert code == 0
        assert out.splitlines() == ["python-reviewer", "security-reviewer"]

    def test_unknown_only_exits_2(
        self, droids_dir: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # GIVEN a --only name that is not in the droid roster
        # WHEN running discover-roster
        # THEN it fails closed with exit 2 and names the unknown droid
        code = discover_roster.main(
            ["--droids-dir", str(droids_dir), "--only", "ghost-reviewer"]
        )
        assert code == 2
        assert (
            capsys.readouterr().err
            == "[discover-roster] --only names not found in droid roster: ghost-reviewer\n"
        )

    def test_explicit_blank_only_exits_2(
        self, droids_dir: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # GIVEN ``--only ''`` parsed to no droid names
        # WHEN running discover-roster
        # THEN it fails closed with exit 2 and the empty-blank message is on stderr
        code = discover_roster.main(["--droids-dir", str(droids_dir), "--only", ""])
        assert code == 2
        assert (
            capsys.readouterr().err
            == "[discover-roster] --only was passed but parsed to no droid names; "
            "either list names or omit --only\n"
        )


class TestConfigCli:
    def test_get_reads_default(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # GIVEN no config file
        # WHEN getting droids_dir
        # THEN the universal default is printed
        monkeypatch.chdir(tmp_path)
        code = merge_check_config.main(["--get", "droids_dir"])
        assert code == 0
        assert capsys.readouterr().out.strip() == ".factory/droids"

    def test_test_cmd_skip_exits_3(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        # GIVEN no configured command for a language
        # WHEN requesting it
        # THEN a skip marker is printed and the exit code is 3
        monkeypatch.chdir(tmp_path)
        code = merge_check_config.main(["--test-cmd", "rs"])
        assert code == 3
        assert capsys.readouterr().out.strip() == "skip:no-command-for-rs"


class TestIncrementalCli:
    def test_plan_emits_json(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN a changed .py file on stdin
        # WHEN running plan (iteration mode, no --force-full)
        # THEN the python reviewer runs; the always-floor (no triggers, no relevant
        #      files) is reused via the no-relevant-files fast path, not run
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = incremental_review.main(
            ["--cache", str(tmp_path / "cache.json"), "plan", "--droids-dir", str(droids_dir)]
        )
        assert code == 0
        plan = json.loads(capsys.readouterr().out)
        assert plan["run"] == ["python-reviewer"]
        assert "security-reviewer" in plan["reuse"]

    def test_explicit_blank_only_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN ``--only ''`` parsed to no droid names
        # WHEN running incremental-review plan
        # THEN it fails closed with exit 2 and the empty-blank message is on stderr
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = incremental_review.main(
            [
                "--cache", str(tmp_path / "cache.json"),
                "plan", "--only", "",
                "--droids-dir", str(droids_dir),
            ]
        )
        assert code == 2
        assert (
            capsys.readouterr().err
            == "[incremental-review] --only was passed but parsed to no droid names; "
            "either list names or omit --only\n"
        )

    def test_unknown_only_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN a --only name that is not in the droid roster
        # WHEN running incremental-review plan
        # THEN it fails closed with exit 2 and names the unknown reviewer
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = incremental_review.main(
            [
                "--cache", str(tmp_path / "cache.json"),
                "plan", "--only", "ghost-reviewer",
                "--droids-dir", str(droids_dir),
            ]
        )
        assert code == 2
        assert (
            capsys.readouterr().err
            == "[incremental-review] unknown reviewer names: ghost-reviewer\n"
        )

    def test_record_force_full_approve_without_tool_use_count_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN a record call with --force-full and --verdict APPROVE but no --tool-use-count
        # WHEN running the CLI
        # THEN it exits non-zero with the exact fail-closed stamp message
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = incremental_review.main(
            [
                "--cache", str(tmp_path / "cache.json"),
                "record",
                "--droids-dir", str(droids_dir),
                "--force-full",
                "--reviewer", "security-reviewer",
                "--fingerprint", "abc",
                "--verdict", "APPROVE",
                "--head", "0" * 40,
            ]
        )
        assert code == 2
        assert capsys.readouterr().err == (
            "[incremental-review] --force-full stamp with --verdict APPROVE "
            "requires --tool-use-count (got missing). "
            "Pass the reviewer's real, observed tool-call total.\n"
        )

    @pytest.mark.parametrize("bad_count,expected_label", [(0, "0"), (-1, "-1")])
    def test_record_force_full_approve_with_non_positive_tool_use_count_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        bad_count: int,
        expected_label: str,
    ) -> None:
        # GIVEN a record call with --force-full, --verdict APPROVE, and --tool-use-count <= 0
        # WHEN running the CLI
        # THEN it exits non-zero with the exact fail-closed message naming the bad count
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = incremental_review.main(
            [
                "--cache", str(tmp_path / "cache.json"),
                "record",
                "--droids-dir", str(droids_dir),
                "--force-full",
                "--reviewer", "security-reviewer",
                "--fingerprint", "abc",
                "--verdict", "APPROVE",
                "--head", "0" * 40,
                "--tool-use-count", str(bad_count),
            ]
        )
        assert code == 2
        assert capsys.readouterr().err == (
            "[incremental-review] --force-full stamp with --verdict APPROVE "
            f"requires --tool-use-count (got {expected_label}). "
            "Pass the reviewer's real, observed tool-call total.\n"
        )


    def test_classify_adds_classification_field(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN a diff file and findings on stdin
        # WHEN running the classify subcommand
        # THEN each finding gains a "classification" field (in_diff or pre_existing)
        # AND the cache is updated with classify_done: true (G3)
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        diff_file = tmp_path / "full.diff"
        diff_file.write_text(
            "+++ b/pkg/x.py\n@@ -10,3 +10,4 @@\n unchanged\n+added\n unchanged\n"
        )
        cache_path = tmp_path / "cache.json"
        monkeypatch.setattr("sys.stdin", io.StringIO(
            '{"file":"pkg/x.py","line":11}\n'
            '{"file":"pkg/x.py","line":99}\n'
        ))
        code = incremental_review.main(
            [
                "--cache", str(cache_path),
                "classify",
                "--diff-file", str(diff_file),
            ]
        )
        out = capsys.readouterr().out.strip().splitlines()
        assert code == 0
        assert len(out) == 2
        classified = [json.loads(line) for line in out]
        assert classified[0]["classification"] == "in_diff"
        assert classified[1]["classification"] == "pre_existing"
        # G3: classify_done flag must be set in the cache
        from merge_check.persistence import read_cache
        cache = read_cache(cache_path)
        assert cache.get(KEY_CLASSIFY_DONE) is True
        assert cache.get(KEY_BRANCH) == "feat/unit-test"

    def test_classify_skip_reason_sets_classify_done(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN --skip-reason is passed (explicit opt-out)
        # WHEN running classify
        # THEN classify_done is set in the cache without reading any findings
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        cache_path = tmp_path / "cache.json"
        code = incremental_review.main(
            [
                "--cache", str(cache_path),
                "classify",
                "--skip-reason", "all reviewers APPROVE",
            ]
        )
        assert code == 0
        from merge_check.persistence import read_cache
        cache = read_cache(cache_path)
        assert cache.get(KEY_CLASSIFY_DONE) is True
        assert cache.get(KEY_CLASSIFY_SKIP_REASON) == "all reviewers APPROVE"
        assert cache.get(KEY_BRANCH) == "feat/unit-test"

    def test_classify_skip_reason_empty_string_falls_through_to_normal(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN --skip-reason is passed as an empty string
        # WHEN running classify
        # THEN it is treated as "not provided" and normal classification runs
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        diff_text = (
            "+++ b/pkg/x.py\n"
            "@@ -10,3 +10,4 @@\n"
            " unchanged\n"
            "+added\n"
            " unchanged\n"
        )
        monkeypatch.setattr(
            "merge_check.cli.incremental_review._derive_diff_text",
            lambda diff_file, base: diff_text,
        )
        monkeypatch.setattr("sys.stdin", io.StringIO('{"file":"pkg/x.py","line":11}\n'))
        cache_path = tmp_path / "cache.json"
        code = incremental_review.main(
            [
                "--cache", str(cache_path),
                "classify",
                "--skip-reason", "",
            ]
        )
        assert code == 0
        from merge_check.persistence import read_cache
        cache = read_cache(cache_path)
        assert cache.get(KEY_CLASSIFY_DONE) is True
        assert cache.get(KEY_CLASSIFY_SKIP_REASON) is None

    def test_classify_auto_derives_diff_when_no_diff_file_provided(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN no --diff-file and no --skip-reason
        # WHEN the merge-base diff can be computed
        # THEN classify auto-derives the diff and still classifies findings
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        cache_path = tmp_path / "cache.json"
        diff_text = (
            "+++ b/pkg/x.py\n"
            "@@ -10,3 +10,4 @@\n"
            " unchanged\n"
            "+added\n"
            " unchanged\n"
        )
        monkeypatch.setattr(
            "merge_check.cli.incremental_review._derive_diff_text",
            lambda diff_file, base: diff_text,
        )
        monkeypatch.setattr("sys.stdin", io.StringIO('{"file":"pkg/x.py","line":11}\n'))
        code = incremental_review.main(
            [
                "--cache", str(cache_path),
                "classify",
            ]
        )
        out = capsys.readouterr().out.strip().splitlines()
        assert code == 0
        assert len(out) == 1
        assert json.loads(out[0])["classification"] == "in_diff"
        from merge_check.persistence import read_cache
        cache = read_cache(cache_path)
        assert cache.get(KEY_CLASSIFY_DONE) is True
        assert cache.get(KEY_BRANCH) == "feat/unit-test"

    @pytest.mark.parametrize(
        "failure",
        [
            MergeCheckError("git merge-base failed"),
            MergeCheckError("git diff failed"),
        ],
    )
    def test_classify_returns_error_when_diff_derivation_fails(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
        failure: MergeCheckError,
    ) -> None:
        # GIVEN no --diff-file and diff derivation fails
        # WHEN running classify
        # THEN the CLI exits non-zero and surfaces the error
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        cache_path = tmp_path / "cache.json"
        monkeypatch.setattr(
            "merge_check.cli.incremental_review._derive_diff_text",
            lambda diff_file, base: (_ for _ in ()).throw(failure),
        )
        monkeypatch.setattr("sys.stdin", io.StringIO('{"file":"pkg/x.py","line":11}\n'))
        code = incremental_review.main(
            [
                "--cache", str(cache_path),
                "classify",
            ]
        )
        assert code != 0
        err = capsys.readouterr().err
        assert failure.args[0] in err

    def test_classify_missing_diff_file_exits_nonzero(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN a --diff-file path that does not exist
        # WHEN running classify
        # THEN it exits non-zero with a MergeCheckError (not a traceback)
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        cache_path = tmp_path / "cache.json"
        monkeypatch.setattr("sys.stdin", io.StringIO('{"file":"pkg/x.py","line":11}\n'))
        code = incremental_review.main(
            [
                "--cache", str(cache_path),
                "classify",
                "--diff-file", str(tmp_path / "nonexistent.diff"),
            ]
        )
        assert code != 0
        err = capsys.readouterr().err
        assert "cannot read diff file" in err

    def test_classify_clears_stale_skip_reason_on_normal_run(
        self,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN a first classify with --skip-reason sets classify_skip_reason
        # WHEN a second normal classify runs on the same branch
        # THEN classify_skip_reason is cleared from the cache
        monkeypatch.setattr(
            "merge_check.core.gitio.current_branch", lambda: "feat/unit-test"
        )
        cache_path = tmp_path / "cache.json"
        # First run: skip-reason
        code = incremental_review.main(
            ["--cache", str(cache_path), "classify", "--skip-reason", "no findings"]
        )
        assert code == 0
        from merge_check.persistence import read_cache
        cache = read_cache(cache_path)
        assert cache.get(KEY_CLASSIFY_SKIP_REASON) == "no findings"

        # Second run: normal classify (no skip-reason)
        diff_text = (
            "+++ b/pkg/x.py\n"
            "@@ -10,3 +10,4 @@\n"
            " unchanged\n"
            "+added\n"
            " unchanged\n"
        )
        monkeypatch.setattr(
            "merge_check.cli.incremental_review._derive_diff_text",
            lambda diff_file, base: diff_text,
        )
        monkeypatch.setattr("sys.stdin", io.StringIO('{"file":"pkg/x.py","line":11}\n'))
        code = incremental_review.main(
            ["--cache", str(cache_path), "classify"]
        )
        assert code == 0
        cache = read_cache(cache_path)
        assert cache.get(KEY_CLASSIFY_SKIP_REASON) is None

    def test_plan_includes_zero_delta(
        self,
        droids_dir: Path,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        # GIVEN a plan with changed files
        # WHEN building the plan
        # THEN the JSON includes a zero_delta field
        monkeypatch.setattr("sys.stdin", io.StringIO("pkg/x.py\n"))
        code = incremental_review.main(
            [
                "--cache", str(tmp_path / "cache.json"),
                "plan",
                "--droids-dir", str(droids_dir),
            ]
        )
        assert code == 0
        plan = json.loads(capsys.readouterr().out)
        assert "zero_delta" in plan
        assert isinstance(plan["zero_delta"], bool)


class TestWriteAttestationCli:
    def test_force_full_with_only_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN --force-full combined with --only (a roster restriction)
        # WHEN running the writer
        # THEN it fails closed with exit 2 and writes nothing
        monkeypatch.chdir(tmp_path)
        stdin = io.StringIO("# body")
        # _read_body now reads via sys.stdin.buffer; mirror the bytes stub there too
        stdin.buffer = io.BytesIO(b"# body")  # type: ignore[attr-defined]
        monkeypatch.setattr("sys.stdin", stdin)
        code = write_attestation.main(
            [
                "attestations/mr-1.md",
                "--force-full",
                "--only",
                "security-reviewer",
                "--droids-dir",
                str(droids_dir),
            ]
        )
        assert code == 2
        assert (
            capsys.readouterr().err
            == "[write-attestation] --force-full cannot be combined with --only "
            "(roster restriction)\n"
        )

    def test_explicit_blank_only_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN ``--only ''`` parsed to no droid names
        # WHEN running the writer
        # THEN it fails closed with exit 2 and the empty-blank message is on stderr;
        #      unlike an absent ``--only`` (which would let the planner pick) the
        #      explicit blank is treated as a request for an empty roster and refused
        # (No stdin needed — the empty-blank validation fails before _read_body)
        monkeypatch.chdir(tmp_path)
        code = write_attestation.main(
            [
                "attestations/mr-1.md",
                "--only",
                "",
                "--droids-dir",
                str(droids_dir),
            ]
        )
        assert code == 2
        assert (
            capsys.readouterr().err
            == "[write-attestation] --only was passed but parsed to no droid names; "
            "either list names or omit --only\n"
        )

    def test_oversized_utf8_body_exits_2(
        self,
        droids_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
        tmp_path: Path,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        # GIVEN a non-ASCII body whose UTF-8 encoded size is exactly MAX_BODY_BYTES + 1
        # WHEN running the writer (force_full so the only enforced size limit is the
        # raw byte count, not the absent-flag roster / criteria gates)
        # THEN the writer fails closed with exit 2 before any disk write — UTF-8
        #      character-count checks would otherwise let this slip through
        monkeypatch.chdir(tmp_path)
        from merge_check.attestation import MAX_BODY_BYTES  # local import

        # ``\u2603`` (snowman) is a single grapheme but 3 UTF-8 bytes; ceil((N+1)/3)
        # characters already blow the cap on encoded bytes.
        oversized = "\u2603" * ((MAX_BODY_BYTES // 3) + 1)
        encoded = oversized.encode("utf-8")
        assert len(encoded) > MAX_BODY_BYTES
        monkeypatch.setattr("sys.stdin", io.BytesIO(encoded))
        code = write_attestation.main(
            [
                "attestations/mr-1.md",
                "--force-full",
                "--droids-dir",
                str(droids_dir),
            ]
        )
        assert code == 2
        assert (
            capsys.readouterr().err
            == f"[write-attestation] body must be <= {MAX_BODY_BYTES} bytes\n"
        )


class TestReadChangedFiles:
    """Tests for the stdin path validation in read_changed_files."""

    def test_absolute_paths_are_filtered(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # GIVEN stdin with a mix of relative and absolute paths
        # WHEN read_changed_files processes them
        # THEN absolute paths are filtered out (path traversal protection)
        from merge_check.cli._io import read_changed_files

        monkeypatch.setattr("sys.stdin", io.StringIO(
            "src/main.py\n"
            "/etc/passwd\n"
            "src/utils.py\n"
        ))
        result = read_changed_files()
        assert result == ["src/main.py", "src/utils.py"]

    def test_dotdot_traversal_is_filtered(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # GIVEN stdin with a path containing .. traversal
        # WHEN read_changed_files processes it
        # THEN the traversal path is filtered out
        from merge_check.cli._io import read_changed_files

        monkeypatch.setattr("sys.stdin", io.StringIO(
            "src/main.py\n"
            "../../../etc/shadow\n"
            "pkg/../lib/utils.py\n"
        ))
        result = read_changed_files()
        assert result == ["src/main.py"]
