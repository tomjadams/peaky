"""Unit tests for /merge-check config loading and test-command rendering."""

from __future__ import annotations

from pathlib import Path

import pytest

from merge_check.config import (
    MergeCheckConfig,
    default_config_text,
    load_config,
    render_test_command,
    select_test_template,
    write_default_config,
)
from merge_check.errors import MergeCheckError, SkipLanguageError


class TestLoadConfig:
    def test_missing_file_yields_defaults(self, tmp_path: Path) -> None:
        # GIVEN no config file present
        # WHEN loading
        # THEN the universal defaults are returned
        config = load_config(".factory/merge-check.yml", root=tmp_path)
        assert config.droids_dir == ".factory/droids"
        assert config.attestation_dir == "attestations"
        assert config.test == {}

    def test_reads_overrides_and_test_map(self, tmp_path: Path) -> None:
        # GIVEN a config overriding paths and the test map
        # WHEN loading
        # THEN the overrides and the extension->command map are returned
        (tmp_path / "cfg.yml").write_text(
            "schema_version: 1\n"
            "droids_dir: custom/droids\n"
            "attestation_dir: out\n"
            "test:\n"
            '  ts: "vitest related --run {files}"\n'
        )
        config = load_config("cfg.yml", root=tmp_path)
        assert config.droids_dir == "custom/droids"
        assert config.attestation_dir == "out"
        assert config.test == {"ts": "vitest related --run {files}"}

    def test_gate_only_policy_subtree_is_tolerated(self, tmp_path: Path) -> None:
        # GIVEN a config carrying the gate-only `gate:` policy subtree
        # WHEN the client loads it
        # THEN the subtree is tolerated (not an unknown-key failure) and simply ignored
        (tmp_path / "cfg.yml").write_text(
            "droids_dir: .factory/droids\n"
            "gate:\n"
            "  attestation_exempt:\n"
            "    - reason: changelog\n"
            "      paths: [CHANGELOG.md]\n"
        )
        config = load_config("cfg.yml", root=tmp_path)
        assert config.droids_dir == ".factory/droids"

    def test_unknown_top_level_key_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config with a typo'd key
        # WHEN loading
        # THEN it fails loudly rather than silently defaulting
        (tmp_path / "cfg.yml").write_text("attestation-dir: out\n")
        with pytest.raises(MergeCheckError, match="unknown config key"):
            load_config("cfg.yml", root=tmp_path)

    def test_absolute_path_rejected(self, tmp_path: Path) -> None:
        # GIVEN an absolute config path
        # WHEN loading
        # THEN it is rejected as outside the project
        with pytest.raises(MergeCheckError, match="inside the project"):
            load_config("/etc/merge-check.yml", root=tmp_path)

    def test_non_mapping_document_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config whose top-level document is a list, not a mapping
        # WHEN loading
        # THEN it fails closed rather than being silently ignored
        (tmp_path / "cfg.yml").write_text("- a\n- b\n")
        with pytest.raises(MergeCheckError, match="must be a mapping"):
            load_config("cfg.yml", root=tmp_path)

    def test_non_mapping_test_section_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config whose `test:` section is not a mapping
        # WHEN loading
        # THEN it fails closed with a clear mapping error
        (tmp_path / "cfg.yml").write_text("test: not-a-mapping\n")
        with pytest.raises(MergeCheckError, match="must be a mapping"):
            load_config("cfg.yml", root=tmp_path)

    def test_non_positive_schema_version_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config with a non-positive schema_version
        # WHEN loading
        # THEN it fails closed rather than loading a nonsensical version
        (tmp_path / "cfg.yml").write_text("schema_version: 0\n")
        with pytest.raises(MergeCheckError, match="positive integer"):
            load_config("cfg.yml", root=tmp_path)

    def test_non_integer_schema_version_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config with a non-integer schema_version
        # WHEN loading
        # THEN it fails closed rather than raising a raw ValueError
        (tmp_path / "cfg.yml").write_text("schema_version: not-a-number\n")
        with pytest.raises(MergeCheckError, match="must be an integer"):
            load_config("cfg.yml", root=tmp_path)

    def test_empty_droids_dir_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config whose droids_dir strips to empty (would resolve to the repo root)
        # WHEN loading
        # THEN it fails closed
        (tmp_path / "cfg.yml").write_text('droids_dir: "   "\n')
        with pytest.raises(MergeCheckError, match="non-empty string"):
            load_config("cfg.yml", root=tmp_path)

    def test_empty_attestation_dir_fails_closed(self, tmp_path: Path) -> None:
        # GIVEN a config whose attestation_dir strips to empty (would resolve to the repo root)
        # WHEN loading
        # THEN it fails closed, mirroring the droids_dir branch
        (tmp_path / "cfg.yml").write_text('attestation_dir: "   "\n')
        with pytest.raises(MergeCheckError, match="non-empty string"):
            load_config("cfg.yml", root=tmp_path)


class TestWriteDefaultConfig:
    def test_write_failure_is_translated(self, tmp_path: Path) -> None:
        # GIVEN a destination whose parent path is an existing file, not a directory
        # WHEN writing the default config
        # THEN the OSError is translated to a fail-closed MergeCheckError
        (tmp_path / "blocker").write_text("i am a file, not a dir\n")
        with pytest.raises(MergeCheckError, match="cannot write default config"):
            write_default_config("blocker/child.yml", root=tmp_path)


class TestRenderTestCommand:
    def test_interpolates_and_shell_quotes_files(self) -> None:
        # GIVEN a template with the {files} placeholder and files with a space
        # WHEN rendering
        # THEN each file is shell-quoted so it stays one argv token
        config = MergeCheckConfig(test={"ts": "vitest related --run {files}"})
        rendered = render_test_command(config, "ts", "a.ts,dir name/b.ts")
        assert rendered == "vitest related --run a.ts 'dir name/b.ts'"

    def test_package_placeholder_resolves_to_first_file_directory(self) -> None:
        # GIVEN a template using {package}
        # WHEN rendering with a nested first file
        # THEN {package} resolves to that file's directory
        config = MergeCheckConfig(test={"go": "cd {package} && go test ./..."})
        assert render_test_command(config, "go", "services/api/main.go") == (
            "cd services/api && go test ./..."
        )

    def test_package_placeholder_falls_back_to_dot_for_top_level_file(self) -> None:
        # GIVEN a template using {package} and a top-level file with no directory
        # WHEN rendering
        # THEN {package} falls back to "." so `cd {package}` stays at the project root
        config = MergeCheckConfig(test={"go": "cd {package} && go test ./..."})
        assert render_test_command(config, "go", "main.go") == "cd . && go test ./..."

    def test_unconfigured_language_skips(self) -> None:
        # GIVEN a language with no configured command
        # WHEN rendering
        # THEN it raises a skip (exit 3), not a failure
        config = MergeCheckConfig(test={"ts": "vitest {files}"})
        with pytest.raises(SkipLanguageError) as excinfo:
            render_test_command(config, "rs", "main.rs")
        assert excinfo.value.exit_code == 3
        assert excinfo.value.reason == "no-command-for-rs"


class TestSelectTestTemplate:
    def test_resolves_template_by_extension_today(self) -> None:
        # GIVEN the current extension-keyed config (the monorepo seam, pre-enhancement)
        # WHEN selecting a template for a language
        # THEN it returns the language's command
        config = MergeCheckConfig(test={"ts": "vitest related --run {files}"})
        template = select_test_template(config, "ts")
        assert template == "vitest related --run {files}"

    def test_returns_none_for_unconfigured_language(self) -> None:
        # GIVEN a language with no command
        # WHEN selecting a template
        # THEN None is returned (the caller turns this into an explicit skip)
        assert select_test_template(MergeCheckConfig(), "rs") is None


def test_write_default_config_is_idempotent(tmp_path: Path) -> None:
    # GIVEN no config file
    # WHEN writing the default twice
    # THEN the first write creates it and the second is a no-op
    assert write_default_config("cfg.yml", root=tmp_path) is True
    assert write_default_config("cfg.yml", root=tmp_path) is False
    assert (tmp_path / "cfg.yml").read_text() == default_config_text()
