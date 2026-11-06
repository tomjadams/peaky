"""CLI: write a /merge-check attestation with anti-forgery cache verification.

Usage::

    python -m merge_check.cli.write_attestation OUT_PATH [META_JSON] [--force-full] \\
        [--base BASE] [--droids-dir DIR] [--criteria STR] [--with-outcome] \\
        [--skip-outcome-runner NAME] [--all] [--only NAMES] \\
        [--override-requested REASON] [--override-issue-ref IID] < body.md

``commit_sha`` and ``verdict`` are derived from git + the planner cache, never
accepted from the caller. The cache path is fixed (not overridable) so an agent
cannot point the writer at a fabricated cache.

``--override-requested`` records an override *request* (reason + optional issue
ref) in the frontmatter with an honest NEEDS_FIX verdict. No human identity is
resolved client-side. The gate verifies the request via the GitLab API
(author-excluded approval or label event) before accepting.
"""

from __future__ import annotations

import argparse
import sys

from merge_check.attestation import (
    MAX_BODY_BYTES,
    SCHEMA_VERSION,
    AttestationRequest,
    write_attestation,
)
from merge_check.cli._io import parse_only, report_error
from merge_check.constants import DEFAULT_BASE, DEFAULT_DROIDS_DIR
from merge_check.errors import MergeCheckError
from merge_check.models import OverrideRequest, Verdict

LOG_PREFIX = "[write-attestation]"


def main(argv: list[str] | None = None) -> int:
    """Write one schema-versioned attestation after verifying the cache.

    Parameters
    ----------
    argv : list[str] | None
        Optional argument vector for tests. ``None`` uses ``sys.argv[1:]``.

    Returns
    -------
    int
        ``0`` after writing; ``2`` on any anti-forgery violation or write error.

    Notes
    -----
    Call stack (single line per step; failure branch in parentheses)::

        argv → argparse → AttestationRequest
                    → _read_body (stdin)
                    → write_attestation(request, body, meta_json)
                            ├─ verify_cache  ── render_frontmatter
                            └─ write out_path  (writes frontmatter + body)
                    → stderr line (cache verified & reviewers stamped)
            (on MergeCheckError) → report_error(LOG_PREFIX, exc) → exit 2

    Examples
    --------
    >>> main(["attestations/mr-1.md", "--force-full"])  # doctest: +SKIP
    0  # doctest: +SKIP
    """
    parser = argparse.ArgumentParser(
        description="Write a /merge-check attestation with cache verification."
    )
    parser.add_argument("out_path", help="attestation output path (e.g. attestations/mr-72.md)")
    parser.add_argument(
        "meta_json", nargs="?", default="", help="optional JSON object of extra fields"
    )
    parser.add_argument("--force-full", action="store_true", dest="force_full")
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--droids-dir", default=DEFAULT_DROIDS_DIR)
    parser.add_argument("--criteria", default="")
    parser.add_argument("--with-outcome", action="store_true", dest="with_outcome")
    parser.add_argument(
        "--skip-outcome-runner", action="append", default=[], dest="skip_outcome_runner"
    )
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--only")
    parser.add_argument(
        "--override-requested",
        default=None,
        dest="override_requested",
        help=(
            "File an override request: records reason + optional issue_ref in the "
            "frontmatter with an honest NEEDS_FIX verdict. No identity is resolved "
            "client-side; the gate verifies via GitLab API (author-excluded approval)."
        ),
    )
    parser.add_argument(
        "--override-issue-ref",
        type=int,
        default=None,
        help="Optional GitLab issue iid that tracks the deferred work.",
    )
    args = parser.parse_args(argv)
    try:
        only = parse_only(args.only)
        if only.present and not only.names:
            raise MergeCheckError(
                "--only was passed but parsed to no droid names; either list names or omit --only"
            )
        if args.override_requested is None and args.override_issue_ref is not None:
            raise MergeCheckError(
                "--override-issue-ref requires --override-requested <reason>."
            )
        override_requested = (
            OverrideRequest.from_cli_args(
                reason=args.override_requested,
                issue_ref=args.override_issue_ref,
            )
            if args.override_requested is not None
            else None
        )
        request = AttestationRequest(
            out_path=args.out_path,
            base=args.base,
            droids_dir=args.droids_dir,
            criteria=args.criteria,
            with_outcome=args.with_outcome,
            skip_outcome_runner=tuple(args.skip_outcome_runner),
            all_=args.all,
            only=tuple(only.names),
            force_full=args.force_full,
            override_requested=override_requested,
        )
        body = _read_body()
        result = write_attestation(request, body, args.meta_json)
    except MergeCheckError as exc:
        return report_error(LOG_PREFIX, exc)
    if request.override_requested is not None:
        issue_part = (
            f" issue_ref={request.override_requested.issue_ref}"
            if request.override_requested.issue_ref is not None
            else ""
        )
        print(
            f"{LOG_PREFIX} OVERRIDE-REQUESTED: "
            f"reason={request.override_requested.reason!r}{issue_part} "
            f"(gate will verify via GitLab API before accepting)",
            file=sys.stderr,
        )
    verdict_str = str(Verdict.NEEDS_FIX if result.missing else Verdict.APPROVE)
    print(
        f"{LOG_PREFIX} wrote schema_version {SCHEMA_VERSION} + verdict '{verdict_str}' + "
        f"force_full={request.force_full} to {args.out_path} "
        f"(cache verified: {result.checked - len(result.missing)}/{result.checked} reviewers"
        + (f", {len(result.missing)} pending override-gate" if result.missing else "")
        + ")",
        file=sys.stderr,
    )
    return 0


def _read_body() -> str:
    """Read the report body from stdin, failing closed on an I/O or decode error.

    Reads raw bytes first and rejects when the unbounded payload exceeds
    :data:`MAX_BODY_BYTES` on the wire (UTF-8 multi-byte chars can otherwise push
    the decoded text under the cap while the encoded size sails past it). Then
    decodes the accepted payload into a string for the writer.

    Falls back to :data:`sys.stdin.read()` when :data:`sys.stdin.buffer` is not
    available (e.g. when callers inject a raw :class:`io.BytesIO` for testing).
    """
    buffer = getattr(sys.stdin, "buffer", None)
    try:
        if buffer is None:
            raw_text = sys.stdin.read(MAX_BODY_BYTES + 1)
            raw = raw_text.encode("utf-8") if isinstance(raw_text, str) else raw_text
        else:
            raw = buffer.read(MAX_BODY_BYTES + 1)
    except OSError as exc:
        raise MergeCheckError(f"cannot read attestation body from stdin: {exc}") from exc
    if len(raw) > MAX_BODY_BYTES:
        raise MergeCheckError(f"body must be <= {MAX_BODY_BYTES} bytes")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise MergeCheckError(f"cannot decode attestation body from stdin: {exc}") from exc


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
