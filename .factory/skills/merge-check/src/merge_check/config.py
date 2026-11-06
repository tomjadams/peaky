"""Read /merge-check's per-repo config with safe defaults.

The config (``.factory/merge-check.yml``) is the only per-repo state /merge-check
needs: where droids live, where the attestation is written, and the per-language
test command for the discrimination sensor. It lives outside the skill bundle so
a skill upgrade never wipes it, and it regenerates from these defaults when
absent, so /merge-check works zero-ask on day one.

Strict by design: three keys plus the ``test`` map, nothing else. Unknown
top-level keys fail loudly — a typo like ``attestation-dir`` must never silently
fall back to a default. All paths are relative to the project root.
"""

from __future__ import annotations

import os
import re
import shlex
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from merge_check.constants import (
    CONFIG_SCHEMA_VERSION,
    DEFAULT_ATTESTATION_DIR,
    DEFAULT_DROIDS_DIR,
    KEY_ATTESTATION_DIR,
    KEY_DROIDS_DIR,
    KEY_GATE,
    KEY_SCHEMA_VERSION,
    KEY_TEST,
)
from merge_check.core.paths import ensure_repo_relative
from merge_check.errors import MergeCheckError, SkipLanguageError

PLACEHOLDER_FILES = "files"
PLACEHOLDER_PACKAGE = "package"
_PLACEHOLDER_RE = re.compile(r"\{(" + PLACEHOLDER_FILES + "|" + PLACEHOLDER_PACKAGE + r")\}")
# KEY_GATE is the gate-only policy subtree: recognised (so the shared config file does
# not trip unknown-key rejection) but not read into MergeCheckConfig — the client has
# no use for it; the CI gate reads it from the target branch itself.
RECOGNISED_KEYS = frozenset(
    {KEY_SCHEMA_VERSION, KEY_DROIDS_DIR, KEY_ATTESTATION_DIR, KEY_TEST, KEY_GATE}
)


@dataclass(frozen=True)
class MergeCheckConfig:
    """The three recognised config keys plus the sensor's ``test`` command map.

    Parameters
    ----------
    schema_version : int
        Config format version.
    droids_dir : str
        Where reviewer droids live, relative to the project root.
    attestation_dir : str
        Where ``mr-<iid>.md`` attestations are written.
    test : dict[str, str]
        File-extension -> one-shot test command for the discrimination sensor.
    """

    schema_version: int = CONFIG_SCHEMA_VERSION
    droids_dir: str = DEFAULT_DROIDS_DIR
    attestation_dir: str = DEFAULT_ATTESTATION_DIR
    test: dict[str, str] = field(default_factory=dict)


def _coerce_test_map(raw: Any, config_path: Path) -> dict[str, str]:
    """Validate and normalise the ``test:`` section to ``str -> str``."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise MergeCheckError(f"'{KEY_TEST}' in {config_path} must be a mapping")
    return {str(key): str(value) for key, value in raw.items() if value is not None}


def load_config(
    config_path: str | Path = ".factory/merge-check.yml", *, root: Path | None = None
) -> MergeCheckConfig:
    """Load the config file over defaults; a missing file yields pure defaults.

    Parameters
    ----------
    config_path : str | Path, optional
        Location of the config file, relative to the project root.
    root : Path | None, optional
        Project root for path validation. Defaults to the current directory.

    Returns
    -------
    MergeCheckConfig
        The merged configuration.

    Raises
    ------
    MergeCheckError
        When the path escapes the project, the file is not valid YAML/mapping, it
        carries an unrecognised top-level key, or a value fails validation
        (non-positive ``schema_version``, empty ``droids_dir``/``attestation_dir``).

    Examples
    --------
    >>> load_config(".factory/merge-check.yml").droids_dir  # doctest: +SKIP
    '.factory/droids'  # doctest: +SKIP
    """
    root = root or Path.cwd()
    relative = ensure_repo_relative(config_path, root=root)
    full_path = root / relative
    if not full_path.is_file():
        return MergeCheckConfig()
    try:
        parsed = yaml.safe_load(full_path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise MergeCheckError(f"cannot read config {config_path}: {exc}") from exc
    if parsed is None:
        return MergeCheckConfig()
    if not isinstance(parsed, dict):
        raise MergeCheckError(f"config {config_path} must be a mapping")

    unknown = sorted(key for key in parsed if key not in RECOGNISED_KEYS)
    if unknown:
        raise MergeCheckError(
            f"unknown config key(s) {', '.join(repr(k) for k in unknown)} in {config_path} "
            f"(recognised: {', '.join(sorted(RECOGNISED_KEYS))})"
        )
    return MergeCheckConfig(
        schema_version=_positive_int(
            parsed.get(KEY_SCHEMA_VERSION, CONFIG_SCHEMA_VERSION), KEY_SCHEMA_VERSION, config_path
        ),
        droids_dir=_repo_relative_path(
            parsed.get(KEY_DROIDS_DIR, DEFAULT_DROIDS_DIR),
            KEY_DROIDS_DIR,
            config_path,
            root=root,
        ),
        attestation_dir=_repo_relative_path(
            parsed.get(KEY_ATTESTATION_DIR, DEFAULT_ATTESTATION_DIR),
            KEY_ATTESTATION_DIR,
            config_path,
            root=root,
        ),
        test=_coerce_test_map(parsed.get(KEY_TEST), Path(config_path)),
    )


def _repo_relative_path(raw: Any, key: str, config_path: str | Path, *, root: Path) -> str:
    """Validate ``raw`` is a non-empty project-relative path; reject ``..`` escapes.

    Centralises the non-empty string check and the ``ensure_repo_relative`` guard
    so an absolute path or a ``..`` traversal under ``droids_dir`` /
    ``attestation_dir`` is rejected before either becomes a runtime filesystem
    footgun. The relative path is rendered back to a forward-slash string for
    consistency with the rest of the config (and ``DEFAULT_DROIDS_DIR`` itself
    ships as ``".factory/droids"``).
    """
    value = _non_empty_str(raw, key, config_path)
    try:
        relative = ensure_repo_relative(value, root=root)
    except MergeCheckError as exc:
        raise MergeCheckError(
            f"config {key!r} in {config_path} must be a project-relative path "
            f"without '..' traversal; got {value!r} ({exc})"
        ) from exc
    return relative.as_posix()


def _positive_int(raw: Any, key: str, config_path: str | Path) -> int:
    """Coerce ``raw`` to a positive int, failing closed on non-numeric or ``<= 0``."""
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise MergeCheckError(f"config {key!r} must be an integer in {config_path}") from exc
    if value <= 0:
        raise MergeCheckError(f"config {key!r} must be a positive integer in {config_path}")
    return value


def _non_empty_str(raw: Any, key: str, config_path: str | Path) -> str:
    """Coerce ``raw`` to a non-empty string, failing closed when it strips to empty."""
    value = str(raw).strip()
    if not value:
        raise MergeCheckError(f"config {key!r} must be a non-empty string in {config_path}")
    return value


def select_test_template(config: MergeCheckConfig, language: str) -> str | None:
    """Select the raw (un-interpolated) test-command template for a language.

    The single seam for command resolution: today it resolves by file extension
    (``config.test[language]``). A monorepo needs per-package resolution here —
    ``apps/web`` running ``vitest`` while ``apps/legacy`` runs ``jest`` for the
    same ``.ts`` suffix — which is left for the team that takes that on (see the
    "monorepo" FAQ). It is a named function rather than an inline ``.get`` so
    that change has one obvious place to land.

    Parameters
    ----------
    config : MergeCheckConfig
        Loaded configuration.
    language : str
        File extension without the dot, e.g. ``"ts"``.

    Returns
    -------
    str | None
        The command template, or ``None`` when the language has no command.

    Examples
    --------
    >>> from merge_check.config import MergeCheckConfig, select_test_template
    >>> cfg = MergeCheckConfig(test={"ts": "vitest related --run {files}"})
    >>> select_test_template(cfg, "ts")
    'vitest related --run {files}'
    >>> select_test_template(cfg, "go") is None
    True
    """
    return config.test.get(language)


def render_test_command(config: MergeCheckConfig, language: str, files_csv: str) -> str:
    """Resolve and interpolate the sensor's test command for one language.

    ``{files}`` and ``{package}`` are shell-quoted before substitution because the
    sensor parses the rendered command with :mod:`shlex`; a filename with spaces or
    shell metacharacters must stay one argv token.

    Parameters
    ----------
    config : MergeCheckConfig
        Loaded configuration.
    language : str
        File extension without the dot, e.g. ``"ts"``.
    files_csv : str
        Comma-separated changed files for resolution + placeholder substitution.

    Returns
    -------
    str
        The rendered, ready-to-run command.

    Raises
    ------
    SkipLanguageError
        When the language has no configured command — an explicit skip (exit 3),
        not a failure.

    Examples
    --------
    >>> from merge_check.config import MergeCheckConfig, render_test_command
    >>> cfg = MergeCheckConfig(test={"ts": "vitest related --run {files}"})
    >>> render_test_command(cfg, "ts", "a.ts,b.ts")
    'vitest related --run a.ts b.ts'
    """
    changed = [name for name in files_csv.split(",") if name]
    template = select_test_template(config, language)
    if not template:
        raise SkipLanguageError(f"no-command-for-{language}")
    package_dir = (os.path.dirname(changed[0]) if changed else "") or "."
    substitutions = {
        PLACEHOLDER_FILES: " ".join(shlex.quote(name) for name in changed),
        PLACEHOLDER_PACKAGE: shlex.quote(package_dir),
    }
    return _PLACEHOLDER_RE.sub(lambda match: substitutions[match.group(1)], template)


def default_config_text() -> str:
    """Return the commented default config file contents."""
    return (
        "# /merge-check config — commit this. Edit when tooling changes; delete to regenerate.\n"
        "# Only per-repo state /merge-check needs. Routing lives in the droids.\n"
        "# ALL paths below are relative to the PROJECT ROOT, not to this file.\n"
        f"{KEY_SCHEMA_VERSION}: {CONFIG_SCHEMA_VERSION}\n"
        "\n"
        "# Where your reviewer droids live.\n"
        f'{KEY_DROIDS_DIR}: "{DEFAULT_DROIDS_DIR}"\n'
        "\n"
        '# Directory for the per-MR attestation; /merge-check writes "<dir>/mr-<iid>.md".\n'
        f'{KEY_ATTESTATION_DIR}: "{DEFAULT_ATTESTATION_DIR}"\n'
        "\n"
        "# Discrimination-sensor test commands, keyed by FILE EXTENSION without the\n"
        "# dot (ts, vue, go, py, rs). An extension with no entry is skipped (recorded,\n"
        "# not failed). Commands must be ONE-SHOT (never watch) and run from the root.\n"
        "# Placeholders: {files} = changed files, {package} = dir of the first file.\n"
        "# KNOWN LIMITATION (monorepo): one command per extension assumes every file\n"
        "# of that suffix uses the same runner. Mixed runners per package are not yet\n"
        '# supported — see the "monorepo" FAQ in the skill README.\n'
        f"{KEY_TEST}:\n"
        '  # ts: "pnpm exec vitest related --run {files}"\n'
    )


def write_default_config(config_path: str | Path, *, root: Path | None = None) -> bool:
    """Write the default config unless it already exists.

    Parameters
    ----------
    config_path : str | Path
        Destination, relative to the project root.
    root : Path | None, optional
        Project root for path validation. Defaults to the current directory.

    Returns
    -------
    bool
        ``True`` if the file was written, ``False`` if it already existed.

    Raises
    ------
    MergeCheckError
        When the path escapes the project, or the file cannot be written.

    Examples
    --------
    >>> from pathlib import Path
    >>> write_default_config(".factory/merge-check.yml", root=Path("."))  # doctest: +SKIP
    True
    """
    root = root or Path.cwd()
    relative = ensure_repo_relative(config_path, root=root)
    full_path = root / relative
    if full_path.is_file():
        return False
    try:
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(default_config_text(), encoding="utf-8")
    except OSError as exc:
        raise MergeCheckError(f"cannot write default config {config_path}: {exc}") from exc
    return True
