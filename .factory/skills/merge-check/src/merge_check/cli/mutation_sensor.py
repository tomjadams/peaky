"""CLI: the discrimination sensor. Reads a JSON spec on stdin, prints a summary.

Usage::

    printf '%s' '{"test_cmd":"pytest -q","mutations":[...]}' \\
        | python -m merge_check.cli.mutation_sensor

Exit: 0 all mutations killed, 1 at least one survived, 2 operational error.
"""

from __future__ import annotations

import json
import sys

from merge_check.env import env_from_environ
from merge_check.errors import MergeCheckError
from merge_check.sensor import MAX_STDIN_BYTES, parse_spec, run_sensor, summary_exit_code

LOG_PREFIX = "[sensor]"


def _log(message: str) -> None:
    """Write a progress line to stderr — the sensor's only is-it-alive signal."""
    print(f"{LOG_PREFIX} {message}", file=sys.stderr, flush=True)


def _read_spec() -> str:
    """Read the JSON spec from stdin, failing closed on an I/O or decode error."""
    try:
        return sys.stdin.read(MAX_STDIN_BYTES + 1)
    except (OSError, UnicodeDecodeError) as exc:
        raise MergeCheckError(f"cannot read sensor spec from stdin: {exc}") from exc


def main(argv: list[str] | None = None) -> int:
    """Run the discrimination sensor from a stdin JSON spec.

    Parameters
    ----------
    argv : list[str] | None
        Unused; the sensor takes its input on stdin. Present for a uniform
        ``main`` signature.

    Returns
    -------
    int
        ``0`` all killed, ``1`` at least one survived, ``2`` operational error.

    Examples
    --------
    >>> main()  # doctest: +SKIP
    0

    Notes
    -----
    Call stack (each step on its own line; failure path noted in parentheses)::

        stdin ─▶ _read_spec ─▶ parse_spec ─▶ run_sensor ─▶ summary_exit_code ─▶ stdout
                                              │
                                              └─ MergeCheckError ─▶ print(json.dumps({error}))
                                                                   ─▶ _log(str(exc))
                                                                   ─▶ return exc.exit_code
    """
    try:
        payload = _read_spec()
        spec = parse_spec(payload)
        summary = run_sensor(spec, log=_log, env=env_from_environ())
    except MergeCheckError as exc:
        print(json.dumps({"ran": False, "error": str(exc)}))
        _log(str(exc))
        return exc.exit_code
    print(json.dumps(summary, indent=2))
    return summary_exit_code(summary)


if __name__ == "__main__":
    raise SystemExit(main())
