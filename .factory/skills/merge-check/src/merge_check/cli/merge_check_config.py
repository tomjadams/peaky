"""CLI: read /merge-check's per-repo config (``.factory/merge-check.yml``).

Usage::

    python -m merge_check.cli.merge_check_config --get droids_dir|attestation_dir
    python -m merge_check.cli.merge_check_config --test-cmd ts --files a.ts,b.ts
    python -m merge_check.cli.merge_check_config --init
"""

from __future__ import annotations

import argparse
from dataclasses import fields

from merge_check.cli._io import report_error
from merge_check.config import (
    MergeCheckConfig,
    load_config,
    render_test_command,
    write_default_config,
)
from merge_check.constants import DEFAULT_CONFIG_PATH, KEY_TEST
from merge_check.errors import MergeCheckError, SkipLanguageError

LOG_PREFIX = "[merge-check-config]"
_GETTABLE = tuple(f.name for f in fields(MergeCheckConfig) if f.name != KEY_TEST)


def main(argv: list[str] | None = None) -> int:
    """Run the config CLI.

    Parameters
    ----------
    argv : list[str] | None
        Optional argument vector for tests. ``None`` uses ``sys.argv``.

    Returns
    -------
    int
        ``0`` for successful reads/writes, ``2`` for invalid usage, and ``3`` when
        a requested language has no configured sensor command.

    Examples
    --------
    >>> main(["--get", "attestation_dir"])  # doctest: +SKIP
    0

    Notes
    -----
    Call stack::

        main
          └─ _run
                ├─ write_default_config (if --init)
                ├─ load_config + getattr (if --get)
                └─ render_test_command (if --test-cmd)
          └─ on MergeCheckError / SkipLanguageError: report
    """
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--path", default=DEFAULT_CONFIG_PATH)
    parser.add_argument("--get")
    parser.add_argument("--test-cmd", dest="test_cmd")
    parser.add_argument("--files", default="")
    parser.add_argument("--init", action="store_true")
    args = parser.parse_args(argv)

    try:
        return _run(args, parser)
    except SkipLanguageError as exc:
        print(f"skip:{exc.reason}")
        return exc.exit_code
    except MergeCheckError as exc:
        return report_error(LOG_PREFIX, exc)


def _run(args: argparse.Namespace, parser: argparse.ArgumentParser) -> int:
    """Dispatch the requested config operation."""
    if args.init:
        if write_default_config(args.path):
            print(f"{LOG_PREFIX} wrote defaults to {args.path}")
        else:
            print(f"{LOG_PREFIX} {args.path} already exists; not overwriting")
        return 0

    config = load_config(args.path)
    if args.get:
        if args.get not in _GETTABLE:
            raise MergeCheckError(f"unknown key: {args.get}")
        print(getattr(config, args.get))
        return 0
    if args.test_cmd:
        print(render_test_command(config, args.test_cmd, args.files))
        return 0

    parser.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
