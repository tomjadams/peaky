"""Discover which reviewer droids /merge-check should run for the current diff.

The roster is not a hardcoded list. Each reviewer droid declares how it wants to
be routed in a ``merge_check:`` block in its Markdown frontmatter, and this module
reads those blocks from a droids directory. Routing lives with the droids, so the
skill stays portable: drop it into any repo, annotate that repo's droids, done.

Glob triggers are a *floor*, not a ceiling. The orchestrator is expected to read
the actual diff and add any reviewer the globs missed; :func:`audit` reports how
every droid is wired so an unannotated reviewer is visible rather than silently
dormant.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from merge_check.constants import KEY_ALWAYS, KEY_TRIGGERS, MERGE_CHECK_KEY, VERIFIER_NAME_SUFFIX
from merge_check.core.frontmatter import parse_frontmatter
from merge_check.core.gitio import repo_toplevel, run_git
from merge_check.core.globs import matches_any
from merge_check.errors import MergeCheckError
from merge_check.models import MergeCheckSpec, RosterMode

_TRUTHY = frozenset({"true", "yes", "1"})


def is_verifier_role(name: str) -> bool:
    """Return ``True`` when ``name`` follows the ``-verifier`` filename convention.

    A droid whose filename stem ends with ``verifier`` is the role marker for an
    outcome-style reviewer. Today only ``outcome-verifier`` registers; future
    examples (``compliance-verifier``, …) plug into the same dispatch path.

    Parameters
    ----------
    name : str
        Droid filename stem.

    Returns
    -------
    bool
        Whether the droid is a verifier-role reviewer.

    Examples
    --------
    >>> is_verifier_role("outcome-verifier")
    True
    >>> is_verifier_role("go-reviewer")
    False
    """
    return name.endswith(VERIFIER_NAME_SUFFIX)


def _as_bool(value: Any) -> bool:
    """Coerce a YAML scalar to bool, accepting ``true``/``yes``/``1`` truthy forms."""
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in _TRUTHY


def _as_trigger_list(value: Any, *, droid: str) -> list[str]:
    """Validate a ``triggers`` value into a list of glob strings; reject malformed rows.

    Accepts a non-empty string (treated as a single trigger) or a non-empty list
    of strings. Empty strings/empty lists, booleans, integers, dicts, and
    ``None`` are all rejected — silently coercing them to a bare empty list would
    turn a typo (``: true`` accidentally under ``triggers``) into a dormant-looking
    droid that path-routing skips forever. The fix applied here propagates the
    error so an operator sees the bad droid file at parse time, not at the
    orchestrator's empty-roster exit.

    Parameters
    ----------
    value : Any
        The raw ``triggers`` YAML value.
    droid : str
        Droid filename stem, used only for the error message.

    Returns
    -------
    list[str]
        The validated trigger list.

    Raises
    ------
    MergeCheckError
        On any shape other than a non-empty string or a non-empty list of strings.
    """
    if isinstance(value, str):
        if not value.strip():
            raise MergeCheckError(
                f"merge_check.triggers for {droid!r} is an empty string; "
                "either drop the key (no path routing) or set a glob"
            )
        return [value]
    if isinstance(value, list):
        if not value:
            raise MergeCheckError(
                f"merge_check.triggers for {droid!r} is an empty list; "
                "either drop the key (no path routing) or list at least one glob"
            )
        result: list[str] = []
        for item in value:
            if not isinstance(item, str):
                raise MergeCheckError(
                    f"merge_check.triggers for {droid!r} contains a non-string entry "
                    f"of type {type(item).__name__}; only str globs are accepted"
                )
            result.append(item)
        return result
    raise MergeCheckError(
        f"merge_check.triggers for {droid!r} must be a non-empty string or list of "
        f"strings, got {type(value).__name__}"
    )


def parse_spec(text: str, *, droid: str = "<droid>") -> MergeCheckSpec:
    """Parse a droid's ``merge_check:`` block out of its Markdown frontmatter.

    Parameters
    ----------
    text : str
        Full droid Markdown file contents.
    droid : str, optional
        Filename stem, used in error messages so an authoring mistake in one
        droid names the right file.

    Returns
    -------
    MergeCheckSpec
        The parsed spec. ``has_block`` is ``False`` when the file has no
        ``merge_check:`` key, so an unannotated droid never auto-routes.

    Raises
    ------
    MergeCheckError
        When the frontmatter is present but malformed (propagated from
        :func:`~merge_check.core.frontmatter.parse_frontmatter`) or when the
        ``triggers`` value is not a non-empty string or list of strings.

    Examples
    --------
    >>> parse_spec("---\\nmerge_check:\\n  triggers: ['**/*.go']\\n---\\n").triggers
    ['**/*.go']
    """
    frontmatter = parse_frontmatter(text)
    block = frontmatter.get(MERGE_CHECK_KEY)
    if not isinstance(block, dict):
        return MergeCheckSpec()
    triggers_raw = block.get(KEY_TRIGGERS)
    triggers = _as_trigger_list(triggers_raw, droid=droid) if triggers_raw is not None else []
    return MergeCheckSpec(
        triggers=triggers,
        always=_as_bool(block.get(KEY_ALWAYS, False)),
        has_block=True,
    )


def load_droids(droids_dir: Path) -> dict[str, MergeCheckSpec]:
    """Parse every ``*.md`` droid in ``droids_dir`` into ``name -> MergeCheckSpec``.

    Parameters
    ----------
    droids_dir : Path
        Directory of reviewer droid Markdown files.

    Returns
    -------
    dict[str, MergeCheckSpec]
        Specs keyed by droid filename stem, sorted by filename.

    Examples
    --------
    >>> load_droids(Path(".factory/droids"))  # doctest: +SKIP
    {'go-reviewer': MergeCheckSpec(...)}  # doctest: +SKIP
    """
    droids: dict[str, MergeCheckSpec] = {}
    for path in sorted(droids_dir.glob("*.md")):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            logging.warning("Cannot read droid file %s: %s", path, exc)
            droids[path.stem] = MergeCheckSpec()
            continue
        droids[path.stem] = parse_spec(text, droid=path.stem)
    return droids


def discover(
    droids: dict[str, MergeCheckSpec],
    changed: list[str],
    *,
    mode: RosterMode,
    only: list[str],
    with_outcome: bool,
) -> set[str]:
    """Resolve the roster for ``mode``, always unioning the non-bypassable floor.

    Parameters
    ----------
    droids : dict[str, MergeCheckSpec]
        All known droids and their routing.
    changed : list[str]
        Repo-relative changed file paths.
    mode : RosterMode
        ``PATH`` (trigger-routed), ``ALL`` (every non-verifier droid), or ``ONLY``
        (exactly ``only``).
    only : list[str]
        Explicit droid names, used only in ``ONLY`` mode.
    with_outcome : bool
        Whether to include verifier-role droids.

    Returns
    -------
    set[str]
        The reviewer names to dispatch. ``always`` droids are present in every
        mode; verifier-role droids only when ``with_outcome`` is set.

    Examples
    --------
    >>> from merge_check.models import MergeCheckSpec, RosterMode
    >>> from merge_check.roster import discover
    >>> specs = {"go-reviewer": MergeCheckSpec(triggers=["**/*.go"])}
    >>> discover(specs, ["main.go"], mode=RosterMode.PATH, only=[], with_outcome=False)
    {'go-reviewer'}
    """
    always = {name for name, spec in droids.items() if spec.always}
    verifiers = {name for name in droids if is_verifier_role(name)}

    roster: set[str] = set()
    match mode:
        case RosterMode.ALL:
            roster = {name for name in droids if name not in verifiers}
        case RosterMode.ONLY:
            roster = set(only)
            if not with_outcome:
                roster -= verifiers
        case RosterMode.PATH:
            for name, spec in droids.items():
                if spec.always or is_verifier_role(name):
                    continue
                if matches_any_changed(changed, spec.triggers):
                    roster.add(name)

    roster |= always  # floor is non-bypassable in every mode
    if with_outcome:
        roster |= verifiers  # opt-in by intent (--change / --issue)
    return roster


def matches_any_changed(changed: list[str], triggers: list[str]) -> bool:
    """Return ``True`` when any changed path matches any of ``triggers``.

    Parameters
    ----------
    changed : list[str]
        Repo-relative changed file paths.
    triggers : list[str]
        Glob triggers for one droid.

    Returns
    -------
    bool
        Whether the droid should join a path-routed run.
    """
    return any(matches_any(path, triggers) for path in changed)


def audit(droids: dict[str, MergeCheckSpec]) -> tuple[list[str], list[str]]:
    """Describe how every droid is wired and which ones will not auto-route.

    Parameters
    ----------
    droids : dict[str, MergeCheckSpec]
        All known droids and their routing.

    Returns
    -------
    tuple[list[str], list[str]]
        ``(report_lines, dormant_names)`` — one human-readable line per droid in
        sorted order, plus the names with no ``merge_check:`` block.

    Examples
    --------
    >>> from merge_check.models import MergeCheckSpec
    >>> from merge_check.roster import audit
    >>> _lines, dormant = audit({"go-reviewer": MergeCheckSpec(has_block=True)})
    >>> dormant
    []
    """
    report: list[str] = []
    dormant: list[str] = []
    for name in sorted(droids):
        spec = droids[name]
        if not spec.has_block and not is_verifier_role(name):
            dormant.append(name)
            tag = "NO merge_check: block -- dormant (reachable by name / --all only)"
        elif spec.always:
            tag = "always (non-bypassable floor)"
        elif is_verifier_role(name):
            tag = "verifier role (filename -verifier suffix, opt-in via --change/--issue)"
        elif spec.triggers:
            tag = "triggers: " + ", ".join(spec.triggers)
        else:
            tag = "merge_check: block without triggers/always -- dormant"
        report.append(f"{name:28s} {tag}")
    return report, dormant


def load_droids_at_ref(droids_dir: Path, ref: str) -> dict[str, MergeCheckSpec]:
    """Load droid specs from a specific git revision.

    Used to pin the non-bypassable floor: an ``always`` droid present at the
    merge base must still be ``always`` at the stamp, otherwise an MR could
    redefine the floor in the same commit that bypasses it.

    Parameters
    ----------
    droids_dir : Path
        Directory of reviewer droid Markdown files (relative to repo root).
    ref : str
        Git ref to read the droid files from.

    Returns
    -------
    dict[str, MergeCheckSpec]
        Specs keyed by droid filename stem. Missing files at ``ref`` are
        omitted (they did not exist in the base).

    Raises
    ------
    MergeCheckError
        When the repository root cannot be resolved or git fails.
    """
    root = repo_toplevel()
    abs_dir = root / droids_dir
    rel_dir = abs_dir.relative_to(root).as_posix()
    droids: dict[str, MergeCheckSpec] = {}

    # Enumerate droid files from the base ref itself, not the current worktree,
    # so a deleted or renamed always-floor droid is still detected.
    list_result = run_git(["ls-tree", "--name-only", f"{ref}:{rel_dir}"])
    if list_result.returncode != 0:
        # Directory did not exist at this ref; no base floor to pin.
        return droids
    for name in list_result.stdout.strip().splitlines():
        if not name.endswith(".md"):
            continue
        result = run_git(["show", f"{ref}:{rel_dir}/{name}"])
        if result.returncode != 0:
            continue
        droids[Path(name).stem] = parse_spec(result.stdout, droid=Path(name).stem)
    return droids
