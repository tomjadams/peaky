"""CLI: resolve the current branch's open MR IID via glab.

Usage::

    python -m merge_check.cli.resolve_mr_iid
    MERGE_CHECK_MR_IID=72 python -m merge_check.cli.resolve_mr_iid
"""

from __future__ import annotations

from merge_check.cli._io import report_error
from merge_check.env import env_from_environ
from merge_check.errors import MergeCheckError
from merge_check.resolve_iid import resolve_mr_iid

LOG_PREFIX = "[resolve-mr-iid]"


def main(argv: list[str] | None = None) -> int:
    """Print the resolved MR IID, or fail loudly with a recovery hint.

    Parameters
    ----------
    argv : list[str] | None
        Unused; present for a uniform ``main`` signature.

    Returns
    -------
    int
        ``0`` when an IID is printed; ``2`` for missing tooling, auth failure,
        detached HEAD, or no open MR.

    Notes
    -----
    Call stack::

        main
          └─ env_from_environ (single snapshot of live process env)
                 └─ resolve_mr_iid (uses Env snapshot, prefers MR_IID override)
                        └─ glab auth → git branch → glab mr list → first opened IID
          └─ on MergeCheckError: report_error(LOG_PREFIX, exc) → exit 2

    Examples
    --------
    >>> main()  # doctest: +SKIP
    0
    """
    try:
        print(resolve_mr_iid(env=env_from_environ()))
        return 0
    except MergeCheckError as exc:
        return report_error(LOG_PREFIX, exc)


if __name__ == "__main__":
    raise SystemExit(main())
