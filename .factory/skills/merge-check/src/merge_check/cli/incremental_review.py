"""CLI: plan/record/status/slice/classify for incremental /merge-check reviewer reuse.

Usage (module is ``merge_check.cli.incremental_review``)::

    git diff --name-only main...HEAD | python -m merge_check.cli.incremental_review plan
    python -m merge_check.cli.incremental_review record --reviewer X --fingerprint FP \\
        --head SHA --verdict APPROVE
    python -m merge_check.cli.incremental_review status
    git diff --name-only main...HEAD \\
        | python -m merge_check.cli.incremental_review slice --reviewer X
    printf '{"file":"pkg/x.py","line":42,"severity":"WARN"}\\n' \\
        | python -m merge_check.cli.incremental_review classify --base main
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from merge_check.cli._io import parse_only, read_changed_files, report_error
from merge_check.constants import (
    DEFAULT_BASE,
    DEFAULT_CACHE_PATH,
    DEFAULT_DROIDS_DIR,
    KEY_BRANCH,
    KEY_CLASSIFY_DONE,
    KEY_CLASSIFY_SKIP_REASON,
)
from merge_check.core.diff_hunks import (
    KEY_FILE,
    KEY_LINE,
    classify_findings,
)
from merge_check.core.gitio import merge_base, run_git
from merge_check.errors import MergeCheckError
from merge_check.models import Verdict
from merge_check.persistence import (
    KEY_ENTRIES,
    STATUS_DEFAULT_STALE_DAYS,
    cache_transaction,
    read_cache,
    status_report,
    write_cache,
)
from merge_check.planner import PlanRequest, build_plan, record_verdict, slice_files

LOG_PREFIX = "[incremental-review]"
DEFAULT_PYTEST_QUIET = "-q"


def _plan_request(args: argparse.Namespace) -> PlanRequest:
    """Build a :class:`PlanRequest` from shared planner CLI flags."""
    only = parse_only(getattr(args, "only", None))
    if only.present and not only.names:
        raise MergeCheckError(
            "--only was passed but parsed to no droid names; either list names or omit --only"
        )
    return PlanRequest(
        droids_dir=Path(args.droids_dir),
        cache_path=Path(args.cache),
        criteria=getattr(args, "criteria", ""),
        with_outcome=getattr(args, "with_outcome", False),
        all_=getattr(args, "all", False),
        only=only.names,
        force_full=getattr(args, "force_full", False),
        skip_outcome_runner=list(getattr(args, "skip_outcome_runner", []) or []),
    )


def _cmd_test(args: argparse.Namespace) -> int:
    """Smoke-test the package by delegating to ``pytest -q``.

    The legacy inline ``test`` subcommand is preserved as a convenience entry
    point that simply forwards to the external pytest suite. A user typing
    ``merge-check-plan test`` (or the module's own ``incremental_review.py
    test``) sees the same tests run as ``uv run --project
    .factory/skills/merge-check --extra dev pytest -q`` would.

    Parameters
    ----------
    args : argparse.Namespace
        Namespace carrying optional passthrough ``-q``/``-- fixtures`` style
        arguments under ``args.pytest_args`` (default ``[DEFAULT_PYTEST_QUIET]``).

    Returns
    -------
    int
        The pytest process exit code (0 on success).
    """
    pytest_args = list(getattr(args, "pytest_args", None) or [DEFAULT_PYTEST_QUIET])
    try:
        completed = subprocess.run(  # noqa: S603
            [sys.executable, "-m", "pytest", *pytest_args],
            cwd=str(Path(__file__).resolve().parents[2]),  # package root
        )
    except OSError as exc:
        raise MergeCheckError(f"could not launch pytest for the smoke test: {exc}") from exc
    return completed.returncode


def _cmd_plan(args: argparse.Namespace) -> int:
    """Print the run/reuse plan as JSON."""
    plan = build_plan(_plan_request(args), read_changed_files())
    print(json.dumps(plan, indent=2, sort_keys=True))
    return 0


def _cmd_record(args: argparse.Namespace) -> int:
    """Record one reviewer's verdict into the cache.

    Mirrors the planner's stamp guard before the transaction: when
    ``--force-full`` and ``--verdict APPROVE`` are set but ``--tool-use-count``
    is missing or non-positive, fail closed with exit 2 so the cache transaction
    never starts. Otherwise delegate to :func:`record_verdict`.

    Parameters
    ----------
    args : argparse.Namespace
        Parsed CLI args with ``reviewer``, ``fingerprint``, ``verdict``,
        ``head``, ``summary``, ``elapsed_s``, ``tool_use_count``, and
        ``force_full`` attributes.

    Returns
    -------
    int
        0 on success.

    Raises
    ------
    MergeCheckError
        When the stamp guard fails (missing/invalid ``--tool-use-count`` at
        ``--force-full`` with ``APPROVE``), or when :func:`record_verdict`
        raises for any planner-level reason (HEAD, fingerprint, hollow).
    """
    # Mirror the planner's stamp guard so the CLI fails before the transaction.
    if (
        args.force_full
        and args.verdict == "APPROVE"
        and (args.tool_use_count is None or args.tool_use_count <= 0)
    ):
        reason = "missing" if args.tool_use_count is None else f"{args.tool_use_count}"
        raise MergeCheckError(
            f"--force-full stamp with --verdict APPROVE requires --tool-use-count "
            f"(got {reason}). Pass the reviewer's real, observed tool-call total."
        )
    record_verdict(
        _plan_request(args),
        read_changed_files(),
        reviewer=args.reviewer,
        fingerprint=args.fingerprint,
        verdict=Verdict(args.verdict),
        head=args.head,
        summary=args.summary,
        elapsed_s=args.elapsed_s,
        tool_use_count=args.tool_use_count,
        dispatch_started_at=args.dispatch_started_at,
    )
    return 0


def _cmd_status(args: argparse.Namespace) -> int:
    """Print the cache status report."""
    for line in status_report(Path(args.cache), stale_days=args.stale_days):
        print(line)
    return 0


def _cmd_slice(args: argparse.Namespace) -> int:
    """Print the per-reviewer relevant file list."""
    for path in slice_files(
        Path(args.droids_dir),
        args.reviewer,
        read_changed_files(),
        with_outcome=args.with_outcome,
        force_full=args.force_full,
    ):
        print(path)
    return 0


def _derive_diff_text(diff_file: str | None, base: str) -> str:
    """Return the unified diff text from a file or by computing it from the merge-base.

    Parameters
    ----------
    diff_file : str | None
        Path to an explicit diff file. When ``None``, the diff is computed via
        ``git diff <merge-base>...HEAD`` (G3).
    base : str
        Base ref used to compute the merge-base when ``diff_file`` is not provided.

    Returns
    -------
    str
        Unified diff text.

    Raises
    ------
    MergeCheckError
        When the explicit diff file cannot be read or when git fails to compute
        the merge-base diff.

    Notes
    -----
    The merge-base diff is the canonical source for classification; it never
    trusts an orchestrator-supplied file list.
    """
    if diff_file:
        try:
            return Path(diff_file).read_text(encoding="utf-8")
        except OSError as exc:
            raise MergeCheckError(f"cannot read diff file {diff_file}: {exc}") from exc
    # G3: derive diff internally from the merge-base in the current worktree.
    try:
        base_sha = merge_base(base or DEFAULT_BASE, "HEAD")
        result = run_git(["diff", f"{base_sha}...HEAD"])
        if result.returncode != 0:
            raise MergeCheckError(
                f"git diff {base_sha}...HEAD failed: {result.stderr.strip()}"
            )
        return result.stdout
    except MergeCheckError:
        raise
    except Exception as exc:
        raise MergeCheckError(f"could not compute diff from merge-base: {exc}") from exc


def _set_classify_done(cache_path: Path, skip_reason: str | None = None) -> None:
    """Write classify_done (and optionally classify_skip_reason) to the cache.

    The classification result is scoped to the current branch so a stale
    classify_done flag from a different branch cannot satisfy the override guard.
    If the cache previously belonged to a different branch, its entries are
    discarded before the branch key is updated.

    Parameters
    ----------
    cache_path : Path
        Path to the planner cache.
    skip_reason : str | None, optional
        When provided, the classification is explicitly skipped and the reason
        is stored for the audit trail.

    Returns
    -------
    None
    """
    # Local import so tests can monkeypatch merge_check.core.gitio.current_branch.
    from merge_check.core.gitio import current_branch

    with cache_transaction(cache_path):
        cache = read_cache(cache_path)
        current = current_branch()
        if cache.get(KEY_BRANCH) != current:
            cache[KEY_ENTRIES] = {}
        cache[KEY_CLASSIFY_DONE] = True
        cache[KEY_BRANCH] = current
        if skip_reason:
            cache[KEY_CLASSIFY_SKIP_REASON] = skip_reason
        else:
            cache.pop(KEY_CLASSIFY_SKIP_REASON, None)
        write_cache(cache_path, cache)


def _cmd_classify(args: argparse.Namespace) -> int:
    """Classify findings as in-diff or pre-existing against the diff.

    Findings are read from stdin (one JSON object per line, each with ``file``
    and ``line`` keys). The diff is read from ``--diff-file`` when provided;
    otherwise it is computed from ``git diff <merge-base>...HEAD`` (G3).

    When ``--skip-reason`` is given no findings are read; the cache is flagged
    with ``classify_done: true`` + ``classify_skip_reason: <reason>`` as an
    explicit, audited skip that the writer's G3 guard accepts.

    Usage::

        # Auto-derive diff from merge-base (recommended):
        echo '{"file":"pkg/x.py","line":42,"severity":"WARN"}' \\
            | merge-check-plan classify --base main

        # Supply an explicit diff file:
        echo '{"file":"pkg/x.py","line":42,"severity":"WARN"}' \\
            | merge-check-plan classify --diff-file /tmp/full.diff

        # Explicit skip (accepted risk):
        merge-check-plan classify --skip-reason "all reviewers APPROVE, no findings"

    Parameters
    ----------
    args : argparse.Namespace
        Parsed CLI args with ``cache``, ``diff_file``, ``base``, and
        ``skip_reason`` attributes.

    Returns
    -------
    int
        ``0`` on success, non-zero on error (via :func:`report_error`).

    Raises
    ------
    MergeCheckError
        When the diff cannot be derived from git, stdin contains invalid JSON,
        or a finding is missing the required ``file``/``line`` keys.
    """
    cache_path = Path(args.cache)
    skip_reason = getattr(args, "skip_reason", None)
    if skip_reason is not None and skip_reason != "":
        _set_classify_done(cache_path, skip_reason)
        return 0

    diff_text = _derive_diff_text(args.diff_file, getattr(args, "base", DEFAULT_BASE))
    raw = sys.stdin.read()
    findings: list[dict[str, object]] = []
    for line_text in raw.strip().splitlines():
        if not line_text.strip():
            continue
        try:
            obj = json.loads(line_text)
        except json.JSONDecodeError as exc:
            raise MergeCheckError(f"invalid JSON on stdin: {exc}") from exc
        if not isinstance(obj, dict) or KEY_FILE not in obj or KEY_LINE not in obj:
            raise MergeCheckError(
                f"each finding must be a JSON object with "
                f"'{KEY_FILE}' and '{KEY_LINE}' keys"
            )
        findings.append(obj)

    classified_findings = classify_findings(diff_text, findings)
    for entry in classified_findings:
        print(json.dumps(entry, sort_keys=True))

    _set_classify_done(cache_path)
    return 0


def _add_plan_flags(parser: argparse.ArgumentParser) -> None:
    """Add the shared roster-shaping flags used by plan and record."""
    parser.add_argument("--droids-dir", default=DEFAULT_DROIDS_DIR)
    parser.add_argument("--criteria", default="")
    parser.add_argument("--with-outcome", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--only")
    parser.add_argument("--force-full", action="store_true")
    parser.add_argument(
        "--skip-outcome-runner", action="append", default=[], dest="skip_outcome_runner"
    )


def main(argv: list[str] | None = None) -> int:
    """Run the incremental-review planner CLI.

    Parameters
    ----------
    argv : list[str] | None
        Optional argument vector for tests. ``None`` uses ``sys.argv``.

    Returns
    -------
    int
        ``0`` on success, ``2`` for invalid cache or repo state.

    Notes
    -----
    Flow::

        main
          ├─ plan    ─▶ changed files + droid roster + cache ─▶ run/reuse JSON
          ├─ record  ─▶ reviewer APPROVE + fingerprint        ─▶ cache update
          ├─ status  ─▶ cache contents (slowest reviewers, slices)
          ├─ slice   ─▶ per-reviewer relevant file list
          ├─ classify ─▶ diff + stdin findings ─▶ in_diff/pre_existing + cache flag
          └─ test    ─▶ pytest -q

    Examples
    --------
    >>> from merge_check.cli.incremental_review import main
    >>> main(["status", "--cache", ".factory/merge-check-cache.json"])  # doctest: +SKIP
    0  # doctest: +SKIP
    """
    parser = argparse.ArgumentParser(
        description="Plan/reuse incremental /merge-check reviewer results."
    )
    parser.add_argument("--cache", default=DEFAULT_CACHE_PATH)
    subcommands = parser.add_subparsers(dest="command", required=True)

    plan = subcommands.add_parser("plan")
    _add_plan_flags(plan)
    plan.set_defaults(func=_cmd_plan)

    record = subcommands.add_parser("record")
    record.add_argument("--reviewer", required=True)
    record.add_argument("--fingerprint", required=True)
    _add_plan_flags(record)
    record.add_argument("--verdict", required=True, choices=[v.value for v in Verdict])
    record.add_argument("--head", required=True)
    record.add_argument("--summary", default="")
    record.add_argument("--elapsed-s", type=float, default=0.0, dest="elapsed_s")
    record.add_argument(
        "--dispatch-started-at",
        default=None,
        dest="dispatch_started_at",
        help="ISO-8601 UTC timestamp of dispatch start; planner computes real "
        "wall-clock from this to now. Replaces any caller-supplied --elapsed-s estimate.",
    )
    record.add_argument(
        "--tool-use-count",
        type=int,
        default=None,
        dest="tool_use_count",
        help="Reviewer's real tool-call total from its execution result; "
        "required at the --force-full stamp (positive int), 0 rejects as hollow",
    )
    record.set_defaults(func=_cmd_record)

    status = subcommands.add_parser("status")
    status.add_argument("--droids-dir", default=DEFAULT_DROIDS_DIR)
    status.add_argument("--stale-days", type=int, default=STATUS_DEFAULT_STALE_DAYS)
    status.set_defaults(func=_cmd_status)

    slice_cmd = subcommands.add_parser("slice")
    slice_cmd.add_argument("--reviewer", required=True)
    slice_cmd.add_argument("--droids-dir", default=DEFAULT_DROIDS_DIR)
    slice_cmd.add_argument("--with-outcome", action="store_true")
    slice_cmd.add_argument("--force-full", action="store_true")
    slice_cmd.set_defaults(func=_cmd_slice)

    classify = subcommands.add_parser("classify")
    classify.add_argument(
        "--diff-file",
        default=None,
        help="Path to a unified diff file. Omit to derive from git merge-base (G3).",
    )
    classify.add_argument(
        "--base",
        default=DEFAULT_BASE,
        help="Base ref for git merge-base when --diff-file is not provided.",
    )
    classify.add_argument(
        "--skip-reason",
        default=None,
        dest="skip_reason",
        help=(
            "Mark classification as explicitly skipped (accepted risk). "
            "Sets classify_done=true with a reason; no findings are read. "
            "The --force-full stamp accepts this as the classify_skipped escape."
        ),
    )
    classify.set_defaults(func=_cmd_classify)

    test_cmd = subcommands.add_parser(
        "test",
        help=(
            "Smoke-test the package by delegating to ``pytest -q``. "
            "Extra arguments after ``--`` are passed to pytest verbatim."
        ),
    )
    test_cmd.set_defaults(func=_cmd_test, pytest_args=[DEFAULT_PYTEST_QUIET])

    args = parser.parse_args(argv)
    try:
        result: int = args.func(args)
        return result
    except MergeCheckError as exc:
        return report_error(LOG_PREFIX, exc)


if __name__ == "__main__":
    raise SystemExit(main())
