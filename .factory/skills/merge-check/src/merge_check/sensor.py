"""Discrimination sensor for /merge-check — prove the tests actually catch regressions.

Adversarial reviewers read code; they cannot tell whether a *green* suite would
turn *red* if the behaviour regressed. This sensor closes that gap: it applies
small, behaviour-level mutations to changed code in a throwaway git worktree, runs
the test command, and confirms the suite fails. A mutation the suite does NOT
catch ("survivor") is evidence of a weak or missing test.

Separation of concerns: the orchestrator owns *selection* (which faults to
inject), this module owns *mechanics* and *verdict* (worktree isolation, applying
each mutation, running the suite, the deterministic kill/survive call). The real
working tree is never touched. The unmutated suite is always run first and must be
green, or the sensor fails closed rather than scoring against a broken baseline.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import subprocess
import tempfile
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from merge_check.constants import (
    DEFAULT_RUNS_DIR,
    KEY_SPEC_BASE_REF,
    KEY_SPEC_FILE,
    KEY_SPEC_FIND,
    KEY_SPEC_LINK,
    KEY_SPEC_MUTATIONS,
    KEY_SPEC_RATIONALE,
    KEY_SPEC_REPLACE,
    KEY_SPEC_TEST_CMD,
    KEY_SPEC_TIMEOUT,
)
from merge_check.core.gitio import (
    WORKTREE_REF_RE,
    branch_slug,
    current_branch,
    repo_toplevel,
    run_git,
)
from merge_check.core.paths import is_within
from merge_check.env import Env, env_from_mapping
from merge_check.errors import MergeCheckError

# Per-mutation verdicts (also the summary tallies).
KILLED = "killed"  # suite went red — a real regression here would be caught (good)
SURVIVED = "survived"  # suite stayed green despite the fault — weak/missing test (bad)
ERRORED = "error"  # inconclusive (timeout, bad mutation, missing file)

SHELL_CD = "cd"
SHELL_AND = "&&"
DEFAULT_BASE_REF = "HEAD"
DEFAULT_TIMEOUT_SECONDS = 1200
MAX_STDIN_BYTES = 1_000_000
MAX_MUTATIONS = 3
MAX_MUTATION_FILE_BYTES = 1_000_000

ProgressLog = Callable[[str], None]


def _noop(_message: str) -> None:
    """Default progress sink that discards messages."""


@dataclass(frozen=True)
class Mutation:
    """One behaviour-level fault to inject on a changed line.

    Parameters
    ----------
    file : str
        Worktree-relative path to mutate.
    find : str
        Exact substring to replace; must occur exactly once in the file.
    replace : str
        Replacement substring; must differ from ``find``.
    rationale : str
        Why a correct test must catch this fault (audit only).
    """

    file: str
    find: str
    replace: str
    rationale: str = ""


@dataclass(frozen=True)
class SensorSpec:
    """A validated discrimination-sensor request.

    Parameters
    ----------
    test_cmd : str
        One-shot test command, run inside the worktree.
    mutations : list[Mutation]
        1-3 faults to inject.
    base_ref : str
        Ref the throwaway worktree is created at.
    timeout : int
        Seconds per test run.
    link : list[str]
        Dependency dirs to symlink from the repo root into the worktree.
    """

    test_cmd: str
    mutations: list[Mutation]
    base_ref: str = DEFAULT_BASE_REF
    timeout: int = DEFAULT_TIMEOUT_SECONDS
    link: list[str] = field(default_factory=list)


def parse_spec(payload: str) -> SensorSpec:
    """Parse and validate the sensor spec from a JSON string.

    Parameters
    ----------
    payload : str
        The JSON request (see module docstring for the schema).

    Returns
    -------
    SensorSpec
        The validated spec.

    Raises
    ------
    MergeCheckError
        On oversized input, invalid JSON, missing/!str ``test_cmd``, a bad
        ``mutations`` list, an unsafe ``base_ref``, a non-positive ``timeout``, or
        a malformed ``link`` list.

    Examples
    --------
    >>> from merge_check.sensor import Mutation, parse_spec
    >>> spec = parse_spec(
    ...     '{"test_cmd": "pytest -q", "mutations": [{"file": "pkg/x.py",'
    ...     ' "find": "x = 1", "replace": "x = 2"}]}'
    ... )
    >>> spec.test_cmd
    'pytest -q'
    """
    if len(payload.encode("utf-8")) > MAX_STDIN_BYTES:
        raise MergeCheckError(f"stdin JSON must be <= {MAX_STDIN_BYTES} bytes")
    try:
        spec = json.loads(payload or "{}")
    except json.JSONDecodeError as exc:
        raise MergeCheckError(f"stdin is not valid JSON: {exc}") from exc
    if not isinstance(spec, dict):
        raise MergeCheckError("stdin JSON must be an object")

    raw_cmd = spec.get(KEY_SPEC_TEST_CMD)
    if raw_cmd is not None and not isinstance(raw_cmd, str):
        raise MergeCheckError(f"'{KEY_SPEC_TEST_CMD}' must be a string")
    test_cmd = (raw_cmd or "").strip()
    if not test_cmd:
        raise MergeCheckError(f"missing required '{KEY_SPEC_TEST_CMD}'")

    mutations = _parse_mutations(spec.get(KEY_SPEC_MUTATIONS) or [])
    return SensorSpec(
        test_cmd=test_cmd,
        mutations=mutations,
        base_ref=_parse_base_ref(spec.get(KEY_SPEC_BASE_REF)),
        timeout=_parse_timeout(spec.get(KEY_SPEC_TIMEOUT)),
        link=_parse_link(spec.get(KEY_SPEC_LINK)),
    )


def _parse_base_ref(raw: Any) -> str:
    """Validate the worktree base ref, defaulting to HEAD."""
    base_ref = raw or DEFAULT_BASE_REF
    if not isinstance(base_ref, str):
        raise MergeCheckError(f"'{KEY_SPEC_BASE_REF}' must be a string")
    if base_ref.startswith("-") or not WORKTREE_REF_RE.fullmatch(base_ref):
        raise MergeCheckError(f"'{KEY_SPEC_BASE_REF}' contains unsafe characters")
    return base_ref


def _parse_timeout(raw: Any) -> int:
    """Validate the per-run timeout in seconds.

    ``None`` (or absent) falls back to :data:`DEFAULT_TIMEOUT_SECONDS`. Any other
    value is parsed as int and must be strictly positive — a zero or negative
    timeout would let every mutant silently error out, which is exactly the
    false-confidence mode the baseline guard is meant to prevent.
    """
    if raw is None:
        return DEFAULT_TIMEOUT_SECONDS
    try:
        timeout = int(raw)
    except (TypeError, ValueError) as exc:
        raise MergeCheckError(f"'{KEY_SPEC_TIMEOUT}' must be an integer number of seconds") from exc
    if timeout <= 0:
        raise MergeCheckError(f"'{KEY_SPEC_TIMEOUT}' must be greater than zero")
    return timeout


def _parse_link(raw: Any) -> list[str]:
    """Validate the dependency-link list."""
    link = raw or []
    if not isinstance(link, list) or not all(isinstance(path, str) for path in link):
        raise MergeCheckError(f"'{KEY_SPEC_LINK}' must be a list of paths")
    return link


def _parse_mutations(raw: Any) -> list[Mutation]:
    """Validate the ``mutations`` field and build :class:`Mutation` objects."""
    if not isinstance(raw, list):
        raise MergeCheckError(f"'{KEY_SPEC_MUTATIONS}' must be a list of objects")
    if not raw:
        raise MergeCheckError("no mutations supplied — selection is the orchestrator's job")
    if not all(isinstance(item, dict) for item in raw):
        raise MergeCheckError(f"'{KEY_SPEC_MUTATIONS}' must be a list of objects")
    if len(raw) > MAX_MUTATIONS:
        raise MergeCheckError(
            f"'{KEY_SPEC_MUTATIONS}' must include at most {MAX_MUTATIONS} objects"
        )
    mutations: list[Mutation] = []
    _item_keys: tuple[str, ...] = (
        KEY_SPEC_FILE,
        KEY_SPEC_FIND,
        KEY_SPEC_REPLACE,
        KEY_SPEC_RATIONALE,
    )
    for item in raw:
        for key in _item_keys:
            if key in item and not isinstance(item[key], str):
                raise MergeCheckError(f"'mutations[].{key}' must be a string")
        if (
            KEY_SPEC_FIND in item
            and KEY_SPEC_REPLACE in item
            and item[KEY_SPEC_FIND] == item[KEY_SPEC_REPLACE]
        ):
            raise MergeCheckError("'mutations[].find' and 'mutations[].replace' must differ")
        mutations.append(
            Mutation(
                file=item.get(KEY_SPEC_FILE, ""),
                find=item.get(KEY_SPEC_FIND, ""),
                replace=item.get(KEY_SPEC_REPLACE, ""),
                rationale=item.get(KEY_SPEC_RATIONALE, ""),
            )
        )
    return mutations


def score(exit_code: int | None) -> str:
    """Map a suite exit code to a verdict.

    Parameters
    ----------
    exit_code : int | None
        Suite exit code, or ``None`` on timeout.

    Returns
    -------
    str
        :data:`KILLED` (red), :data:`SURVIVED` (green), or :data:`ERRORED` (timeout).

    Examples
    --------
    >>> score(1), score(0), score(None)
    ('killed', 'survived', 'error')
    """
    if exit_code is None:
        return ERRORED
    return KILLED if exit_code != 0 else SURVIVED


def parse_test_command(test_cmd: str, worktree: Path) -> tuple[list[str], Path]:
    """Parse the test command into argv + cwd without invoking a shell.

    Supports a plain argv command or a single leading ``cd <dir> && <command>``.
    Other shell operators are rejected because the sensor runs repo-controlled
    commands against repo-controlled filenames.

    Parameters
    ----------
    test_cmd : str
        The configured command.
    worktree : Path
        The worktree the command runs in.

    Returns
    -------
    tuple[list[str], Path]
        The argv and the working directory.

    Raises
    ------
    MergeCheckError
        On invalid shell syntax, an unsupported operator, or a ``cd`` target that
        is missing or escapes the worktree.
    """
    try:
        tokens = shlex.split(test_cmd)
    except ValueError as exc:
        raise MergeCheckError(f"test_cmd is not valid shell-style argv: {exc}") from exc
    if not tokens:
        raise MergeCheckError("test_cmd parsed to an empty command")
    if SHELL_AND not in tokens:
        return tokens, worktree
    if (
        tokens.count(SHELL_AND) != 1
        or len(tokens) < 4
        or tokens[0] != SHELL_CD
        or tokens[2] != SHELL_AND
    ):
        raise MergeCheckError(
            "test_cmd supports only argv commands or a leading `cd <dir> && <command>`"
        )
    cwd = worktree / tokens[1]
    if not is_within(cwd, worktree) or not cwd.is_dir():
        raise MergeCheckError(
            f"test_cmd cd target is missing or outside the worktree: {tokens[1]!r}"
        )
    command = tokens[3:]
    if not command:
        raise MergeCheckError("test_cmd has no command after `cd <dir> &&`")
    return command, cwd


# Substrings that signal zero tests collected/ran on a green (exit 0) run.
_ZERO_TEST_MARKERS = (
    "no tests ran",
    "no tests found",
    "no test files",  # go / vitest "No test files found"
    "collected 0 items",  # pytest
)

# Positive-evidence patterns: when present, at least one test actually ran.
# Go emits "[no test files]" for packages without tests but also "ok  <pkg>"
# for packages that passed — the compound check avoids falsely flagging the
# mixed-package case (the bug from the MR !110 forensic audit, G2).
_POSITIVE_TEST_RE = re.compile(
    r"--- pass"          # Go: --- PASS: TestFoo (0.00s)
    r"|^ok[ \t]"         # Go: ok  example/pkg  0.002s  (line-anchored)
    r"|[1-9]\d* passed", # pytest/vitest/jest: 5 passed
    re.IGNORECASE | re.MULTILINE,
)


def ran_no_tests(output: str) -> bool:
    """Return whether a test-run output signals zero tests collected/ran.

    Uses a **two-phase check**: first confirm that a zero-test marker is
    present, then confirm there is no positive evidence of tests actually
    running.  This prevents false positives on mixed Go output where a
    package without test files (``[no test files]``) appears alongside a
    passing package (``ok  pkg  0.002s``).

    Parameters
    ----------
    output : str
        The combined stdout+stderr captured from a test command.

    Returns
    -------
    bool
        ``True`` only when a zero-test marker is present **and** no positive
        test-run evidence is found. ``False`` for any output that shows real
        runs, or an empty capture.

    Examples
    --------
    >>> ran_no_tests("===== no tests ran in 0.01s =====")
    True
    >>> ran_no_tests("5 passed in 0.30s")
    False
    >>> ran_no_tests("?   pkg1   [no test files]\\nok  pkg2  0.003s")
    False
    >>> ran_no_tests("")
    False
    """
    lowered = output.lower()
    if not any(marker in lowered for marker in _ZERO_TEST_MARKERS):
        return False
    return not bool(_POSITIVE_TEST_RE.search(output))


def _run_suite(
    test_cmd: str, worktree: Path, timeout: int, env: dict[str, str], *, capture: bool = False
) -> tuple[int | None, str]:
    """Run the test command inside the worktree.

    Parameters
    ----------
    test_cmd : str
        The one-shot test command.
    worktree : Path
        The throwaway worktree to run in.
    timeout : int
        Seconds before the run is abandoned.
    env : dict[str, str]
        Environment for the subprocess.
    capture : bool, optional
        When ``True``, capture combined stdout+stderr into the returned string (the
        baseline uses this to confirm tests actually ran). Mutation runs leave it
        ``False`` and discard output to avoid buffering a large suite's logs.

    Returns
    -------
    tuple[int | None, str]
        ``(exit_code, output)`` — exit code (``None`` on timeout); ``output`` is the
        captured text when ``capture`` is set, otherwise an empty string.

    Raises
    ------
    MergeCheckError
        When the command cannot be launched (``OSError``).
    """
    argv, cwd = parse_test_command(test_cmd, worktree)
    try:
        completed = subprocess.run(  # noqa: S603 — repo-configured test command, shell-free argv
            argv,
            cwd=str(cwd),
            stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
            stderr=subprocess.STDOUT if capture else subprocess.DEVNULL,
            timeout=timeout,
            env=env,
            text=True,
        )
    except subprocess.TimeoutExpired:
        return None, ""
    except OSError as exc:
        raise MergeCheckError(f"could not run test_cmd {argv[0]!r}: {exc}") from exc
    return completed.returncode, completed.stdout or ""


def reset_worktree_state(worktree: Path, link_dirs: list[str] | None = None) -> None:
    """Revert every modification in the worktree to HEAD, keeping dependency symlinks.

    Runs ``git checkout HEAD -- .`` to restore tracked files, then ``git clean -fd``
    (excluding ``link_dirs``) to remove untracked artifacts the suite wrote — so the
    next mutation runs against the same clean baseline. ``-x`` is intentionally not
    set, preserving ``.gitignore``-d files like ``__pycache__``.

    Parameters
    ----------
    worktree : Path
        The throwaway worktree.
    link_dirs : list[str] | None, optional
        Dependency directories to exclude from the clean step.

    Raises
    ------
    MergeCheckError
        When the checkout or clean step fails — isolation could not be enforced.

    Examples
    --------
    >>> from pathlib import Path
    >>> reset_worktree_state(Path("/tmp/merge-check-wt"))  # doctest: +SKIP
    """
    link_dirs = link_dirs or []
    checkout = run_git(["checkout", DEFAULT_BASE_REF, "--", "."], cwd=worktree)
    if checkout.returncode != 0:
        raise MergeCheckError(
            f"could not reset worktree state between runs (`git checkout HEAD -- .` returned "
            f"{checkout.returncode}): {_stderr_tail(checkout.stderr)}"
        )
    clean_cmd = ["clean", "-fd"]
    for relative_dir in link_dirs:
        clean_cmd.extend(["-e", relative_dir])
    cleaned = run_git(clean_cmd, cwd=worktree)
    if cleaned.returncode != 0:
        raise MergeCheckError(
            f"could not clean untracked artifacts between runs "
            f"(`git clean -fd` returned {cleaned.returncode}): {_stderr_tail(cleaned.stderr)}"
        )


def _stderr_tail(stderr: str | None) -> str:
    """Return the last line of a captured stderr, or a placeholder."""
    lines = (stderr or "").strip().splitlines()
    return lines[-1] if lines else "no stderr"


def _link_dependencies(repo_root: Path, worktree: Path, link_dirs: list[str]) -> None:
    """Symlink heavy uncommitted dependency dirs into the worktree so tests can run."""
    for relative_dir in link_dirs:
        source = repo_root / relative_dir
        destination = worktree / relative_dir
        if not is_within(source, repo_root) or not is_within(destination, worktree):
            raise MergeCheckError(
                f"refusing to link path outside the repo/worktree: {relative_dir!r}"
            )
        if source.exists() and not destination.exists():
            try:
                destination.parent.mkdir(parents=True, exist_ok=True)
                os.symlink(source, destination)
            except OSError as exc:
                raise MergeCheckError(f"could not link {relative_dir}: {exc}") from exc


def _require_green_baseline(
    test_cmd: str, worktree: Path, timeout: int, env: dict[str, str], log: ProgressLog
) -> None:
    """Run the unmutated suite once; abort unless it is green AND actually ran tests."""
    log(f"baseline: running `{test_cmd}` unmutated (timeout {timeout}s) …")
    started = time.monotonic()
    exit_code, output = _run_suite(test_cmd, worktree, timeout, env, capture=True)
    state = "green" if exit_code == 0 else "NOT green"
    log(f"baseline: {state} in {time.monotonic() - started:.1f}s")
    if exit_code != 0:
        raise MergeCheckError(
            f"baseline suite is not green at base_ref (exit {exit_code}); a red base makes "
            "every mutant look killed, so the sensor cannot score"
        )
    # A green exit only proves the command *ran*, not that it *ran tests*. If it
    # collected zero tests, every mutant would falsely survive — treat that as an
    # operational failure at the baseline rather than mis-scoring downstream.
    if ran_no_tests(output):
        raise MergeCheckError(
            f"baseline `{test_cmd}` exited 0 but appears to have run no tests; every mutant "
            "would falsely survive. Check the command actually executes the suite (test deps "
            "installed, correct working directory, no runner skip on a symlinked dep dir)."
        )


def _run_one_mutation(
    worktree: Path,
    mutation: Mutation,
    spec: SensorSpec,
    env: dict[str, str],
    index: int,
    total: int,
    log: ProgressLog,
) -> dict[str, Any]:
    """Apply one mutation, run the suite, revert, and score it."""
    record = {
        "file": mutation.file,
        "find": mutation.find,
        "replace": mutation.replace,
        "rationale": mutation.rationale,
    }
    target = worktree / mutation.file
    if not mutation.file or not is_within(target, worktree) or not target.is_file():
        return {
            **record,
            "verdict": ERRORED,
            "exit_code": None,
            "note": "file missing or outside the worktree",
        }
    if not mutation.find:
        return {**record, "verdict": ERRORED, "exit_code": None, "note": "empty 'find'"}
    try:
        too_large = target.stat().st_size > MAX_MUTATION_FILE_BYTES
        original = "" if too_large else target.read_text(encoding="utf-8")
    except OSError as exc:
        return {
            **record,
            "verdict": ERRORED,
            "exit_code": None,
            "note": f"cannot read target: {exc}",
        }
    if too_large:
        return {
            **record,
            "verdict": ERRORED,
            "exit_code": None,
            "note": "file too large to mutate safely",
        }
    match_count = original.count(mutation.find)
    if match_count != 1:
        return {
            **record,
            "verdict": ERRORED,
            "exit_code": None,
            "note": f"'find' must match exactly once, matched {match_count}",
        }

    log(
        f"({index}/{total}) {mutation.file}: {mutation.find!r} -> "
        f"{mutation.replace!r} — running tests …"
    )
    try:
        target.write_text(original.replace(mutation.find, mutation.replace, 1), encoding="utf-8")
    except OSError as exc:
        return {
            **record,
            "verdict": ERRORED,
            "exit_code": None,
            "note": f"cannot write mutation: {exc}",
        }
    started = time.monotonic()
    try:
        exit_code, _ = _run_suite(spec.test_cmd, worktree, spec.timeout, env)
    except MergeCheckError as exc:
        # A mid-run launch failure (fork ENOMEM/EMFILE, or a mutation that makes the
        # command unrunnable) scores THIS mutation ERRORED and lets the rest run —
        # matching the other per-mutation failure paths. A launch failure at the
        # baseline stays fatal (see _require_green_baseline): with no green base there
        # is nothing to score against.
        return {
            **record,
            "verdict": ERRORED,
            "exit_code": None,
            "note": f"test command failed: {exc}",
        }
    finally:
        reset_worktree_state(worktree, spec.link)
    verdict = score(exit_code)
    elapsed = round(time.monotonic() - started, 1)
    log(f"({index}/{total}) {verdict} in {elapsed}s")
    return {**record, "verdict": verdict, "exit_code": exit_code, "elapsed_s": elapsed}


def run_sensor(
    spec: SensorSpec,
    *,
    log: ProgressLog = _noop,
    env: Env | Mapping[str, str],
) -> dict[str, Any]:
    """Run the sensor in an isolated worktree and return the summary dict.

    Parameters
    ----------
    spec : SensorSpec
        The validated request.
    log : ProgressLog, optional
        Progress sink (the CLI wires this to stderr).
    env : Env | Mapping[str, str]
        Environment for the test subprocess. ``Env`` (the CLI passes one) is
        preferred; a raw mapping is accepted for test ergonomics (built via
        :func:`merge_check.env.env_from_mapping`). Injectable so tests need not
        mutate the real process environment.

    Returns
    -------
    dict[str, Any]
        The summary: ``ran``, per-verdict tallies, ``elapsed_s``, ``test_cmd``, the
        per-mutation ``results``, and a ``warning`` when every mutant survived (a
        sign the test command may not actually be executing tests).

    Raises
    ------
    MergeCheckError
        On any operational failure (not a git repo, worktree add failed, baseline
        not green, isolation failure).

    Notes
    -----
    Runtime contract: the CLI adapter (see ``cli/mutation_sensor.py:main``)
    is the only place that calls :func:`merge_check.env.env_from_environ`
    and threads the resulting :class:`Env` snapshot here; this library
    function MUST NOT read :data:`os.environ` directly, in tests or in REPL.
    Production usage always passes an ``env=`` argument; tests build one via
    :func:`merge_check.env.env_from_mapping`.

    Call stack::

        run_sensor
          └─ worktree add ── _link_dependencies ── _require_green_baseline
                └─ for each mutation: _run_one_mutation
                      └─ (mutate) ── _run_suite ── reset_worktree_state
          └─ worktree remove  (always, in finally)

    Examples
    --------
    >>> from merge_check.env import env_from_mapping
    >>> run_sensor(
    ...     SensorSpec(test_cmd="python -m pytest -q", mutations=[]),
    ...     env=env_from_mapping({}),
    ... )  # doctest: +SKIP
    {'ran': True, 'injected': 0, 'killed': 0, 'survived': 0, 'errored': 0, ...}
    """
    snapshot = env if isinstance(env, Env) else env_from_mapping(env)
    subprocess_env = dict(snapshot.data)
    repo_root = repo_toplevel()
    # G0: use .factory/merge-check-runs/<branch-slug>/ instead of /tmp so run
    # artifacts are co-located with the repo and keyed by branch.
    try:
        slug = branch_slug(current_branch())
    except Exception:
        slug = "unknown"
    runs_base = repo_root / DEFAULT_RUNS_DIR / slug
    try:
        runs_base.mkdir(parents=True, exist_ok=True)
        tmp_dir = str(tempfile.mkdtemp(dir=str(runs_base), prefix="sensor-"))
    except OSError:
        # Fall back to system /tmp when the repo dir is read-only (CI sandbox etc.)
        tmp_dir = tempfile.mkdtemp(prefix="merge-check-sensor-")
    worktree = Path(tmp_dir) / "wt"
    added = run_git(["worktree", "add", "--detach", str(worktree), spec.base_ref], cwd=repo_root)
    if added.returncode != 0:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise MergeCheckError(f"git worktree add failed: {added.stderr.strip()}")

    try:
        env = subprocess_env
        _link_dependencies(repo_root, worktree, spec.link)
        _require_green_baseline(spec.test_cmd, worktree, spec.timeout, env, log)
        reset_worktree_state(worktree, spec.link)
        total = len(spec.mutations)
        run_started = time.monotonic()
        results = [
            _run_one_mutation(worktree, mutation, spec, env, index, total, log)
            for index, mutation in enumerate(spec.mutations, 1)
        ]
        elapsed_total = round(time.monotonic() - run_started, 1)
    finally:
        run_git(["worktree", "remove", "--force", str(worktree)], cwd=repo_root)
        shutil.rmtree(tmp_dir, ignore_errors=True)

    killed = sum(1 for result in results if result["verdict"] == KILLED)
    survived = sum(1 for result in results if result["verdict"] == SURVIVED)
    errored = sum(1 for result in results if result["verdict"] == ERRORED)
    log(
        f"done: killed {killed}/{len(results)} ({survived} survived, {errored} errored) "
        f"in {elapsed_total}s"
    )
    summary: dict[str, Any] = {
        "ran": True,
        "injected": len(results),
        "killed": killed,
        "survived": survived,
        "errored": errored,
        "elapsed_s": elapsed_total,
        "test_cmd": spec.test_cmd,
        "results": results,
    }
    # A green baseline only proves the command *exited* 0, not that it *ran tests*.
    # If every injected fault survived, the likeliest cause is a command that isn't
    # actually exercising the suite (missing test deps, or a runner erroring silently
    # on a symlinked dependency dir) rather than a uniformly weak suite. Surface it so
    # the operator re-checks the command instead of trusting a false all-clear.
    if killed == 0 and survived == len(results) and results:
        warning = (
            f"every one of {len(results)} mutants survived — before trusting this as weak "
            f"tests, confirm `{spec.test_cmd}` actually runs the suite (real assertions, not "
            "zero tests collected and not a runner erroring on a symlinked dependency dir)."
        )
        summary["warning"] = warning
        log(warning)
    return summary


def summary_exit_code(summary: dict[str, Any]) -> int:
    """Map a sensor summary to its exit code: 2 errored, 1 survived, else 0.

    Parameters
    ----------
    summary : dict[str, Any]
        The :func:`run_sensor` summary.

    Returns
    -------
    int
        ``2`` if any mutation errored, ``1`` if any survived, ``0`` if all killed.

    Examples
    --------
    >>> summary_exit_code({"errored": 0, "survived": 0})
    0
    """
    if summary.get("errored"):
        return 2
    if summary.get("survived"):
        return 1
    return 0
