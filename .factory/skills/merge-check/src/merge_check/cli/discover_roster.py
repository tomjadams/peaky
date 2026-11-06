"""CLI: discover the /merge-check reviewer roster from droid ``merge_check:`` blocks.

Usage::

    git diff --name-only main...HEAD | python -m merge_check.cli.discover_roster [--with-outcome]
    python -m merge_check.cli.discover_roster --audit
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from merge_check.cli._io import parse_only, read_changed_files, report_error
from merge_check.constants import DEFAULT_DROIDS_DIR
from merge_check.errors import MergeCheckError
from merge_check.models import RosterMode
from merge_check.roster import audit, discover, load_droids

LOG_PREFIX = "[discover-roster]"


def main(argv: list[str] | None = None) -> int:
    """Run the roster-discovery CLI.

    Parameters
    ----------
    argv : list[str] | None
        Optional argument vector for tests. ``None`` uses ``sys.argv``.

    Returns
    -------
    int
        ``0`` when a roster or audit was produced, ``2`` when configuration is
        missing or the roster is empty.

    Examples
    --------
    >>> main(["--audit", "--droids-dir", ".factory/droids"])  # doctest: +SKIP
    0  # doctest: +SKIP

    Notes
    -----
    Call stack::

        main
          └─ _run
                ├─ load_droids
                ├─ audit (if --audit) or discover
                └─ read_changed_files
          └─ on MergeCheckError: report_error
    """
    parser = argparse.ArgumentParser(
        description="Discover the /merge-check reviewer roster from droid merge_check: blocks."
    )
    parser.add_argument("--droids-dir", default=DEFAULT_DROIDS_DIR)
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument(
        "--all", action="store_true", help="Every droid except outcome reviewers."
    )
    selection.add_argument("--audit", action="store_true", help="Report how every droid is wired.")
    selection.add_argument(
        "--only", metavar="A,B,C", help="Run exactly these named droids (plus the floor)."
    )
    parser.add_argument("--with-outcome", action="store_true", help="Include outcome verifiers.")
    args = parser.parse_args(argv)

    try:
        return _run(args)
    except MergeCheckError as exc:
        return report_error(LOG_PREFIX, exc)


def _run(args: argparse.Namespace) -> int:
    """Execute discovery or audit against the loaded droids."""
    droids_dir = Path(args.droids_dir)
    if not droids_dir.is_dir():
        raise MergeCheckError(f"droids dir not found: {droids_dir}")
    droids = load_droids(droids_dir)

    if args.audit:
        report, dormant = audit(droids)
        for line in report:
            print(line)
        if dormant:
            print(
                f"{LOG_PREFIX} {len(dormant)} droid(s) will not auto-route "
                f"(no merge_check: block): {', '.join(dormant)}",
                file=sys.stderr,
            )
        return 0

    only = parse_only(args.only)
    if only.present and not only.names:
        # ``--only ""`` (or ``--only ,``) is an explicit demand for an empty
        # roster, which is never a useful operation — fail closed rather than
        # silently downgrade to ``PATH``-mode routing on user-supplied nothing.
        raise MergeCheckError(
            "--only was passed but parsed to no droid names; either list names or omit --only"
        )
    mode = RosterMode.ALL if args.all else RosterMode.ONLY if only.present else RosterMode.PATH
    if mode is RosterMode.ONLY:
        unknown = sorted(name for name in only.names if name not in droids)
        if unknown:
            raise MergeCheckError(f"--only names not found in droid roster: {', '.join(unknown)}")

    roster = discover(
        droids,
        read_changed_files(),
        mode=mode,
        only=only.names,
        with_outcome=args.with_outcome,
    )
    if not roster:
        raise MergeCheckError(
            "empty roster. Annotate droids with a merge_check: block (triggers/always), "
            "or pass --all / --only a,b,c."
        )
    print("\n".join(sorted(roster)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
