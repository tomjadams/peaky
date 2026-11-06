"""Write /merge-check's consolidated report to an attestation file.

The attestation is one Markdown file per MR. Its YAML frontmatter is the contract
a CI gate validates: ``commit_sha`` records the reviewed code commit, ``verdict``
drives the merge labels, and ``force_full`` proves the full reviewer floor was
dispatched and approved at the stamped commit.

**Anti-forgery.** The writer never accepts ``commit_sha`` or ``verdict`` from the
caller. It derives ``commit_sha`` from ``git rev-parse HEAD`` and sets ``verdict``
to ``APPROVE`` only when every reviewer in the plan has a cached APPROVE whose
fingerprint matches the current diff at that HEAD. If any reviewer is missing, it
REFUSES to write — the agent must actually dispatch the reviewer and record its
verdict first. The cache path is fixed by the caller's config, and the fingerprint
is computed from real file contents, so an agent cannot fabricate an attestation
by hand-supplying a SHA and verdict.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import yaml

from merge_check.constants import (
    ATTESTATION_ROOT_KEY,
    DEFAULT_BASE,
    DEFAULT_CACHE_PATH,
    DEFAULT_DROIDS_DIR,
    KEY_BRANCH,
    KEY_CLASSIFY_DONE,
    KEY_CLASSIFY_SKIP_REASON,
    KEY_COMMIT_SHA,
    KEY_CUMULATIVE_FINDINGS,
    KEY_ENTRY_FORCE_FULL,
    KEY_PLAN_FINGERPRINTS,
    KEY_REVIEWED_BASE,
    KEY_TOOL_USE_COUNT,
)
from merge_check.core.gitio import (
    current_branch,
    current_head,
    diff_names,
    merge_base,
    repo_toplevel,
)
from merge_check.core.paths import ensure_repo_relative, non_attestation_paths
from merge_check.errors import MergeCheckError
from merge_check.models import KEY_OVERRIDE_REQUESTED, MergeCheckSpec, OverrideRequest, Verdict
from merge_check.persistence import (
    KEY_DISPATCH_STARTED_AT,
    KEY_ENTRIES,
    KEY_FINGERPRINT,
    KEY_HEAD,
    KEY_REVIEWER,
    KEY_ROUNDS,
    KEY_TIMING,
    KEY_VERDICT,
    read_cache,
)
from merge_check.planner import (
    REASON_DOCS_ONLY,
    REASON_NO_RELEVANT_FILES,
    REASON_OUTCOME_SKIPPED,
    PlanRequest,
    build_plan,
)
from merge_check.roster import load_droids, load_droids_at_ref

# schema_version 6 replaces the v5 `override:` block (which included client-
# resolved applied_by / applied_at — a forgery vector) with `override_requested:`
# (reason + optional issue_ref only). The gate verifies the request via the
# GitLab API (author-excluded approval or label event) so identity comes from
# the forge, not from the contributor's shell. See P0 in the mission brief.
SCHEMA_VERSION = 6
MAX_BODY_BYTES = 10_000_000

KEY_SCHEMA_VERSION = "schema_version"
KEY_GENERATED_AT = "generated_at"
KEY_FORCE_FULL = "force_full"
ROOT_KEY = ATTESTATION_ROOT_KEY
# Owned by this writer; an agent cannot override them via META_JSON.
RESERVED = frozenset(
    {
        KEY_SCHEMA_VERSION,
        KEY_COMMIT_SHA,
        KEY_REVIEWED_BASE,
        KEY_VERDICT,
        KEY_GENERATED_AT,
        KEY_FORCE_FULL,
        KEY_OVERRIDE_REQUESTED,
        KEY_CUMULATIVE_FINDINGS,
        KEY_CLASSIFY_SKIP_REASON,
    }
)
# Reviewers excluded from the cache check: they have no domain to verify against.
_UNVERIFIABLE_REASONS = frozenset(
    {REASON_NO_RELEVANT_FILES, REASON_OUTCOME_SKIPPED, REASON_DOCS_ONLY}
)


@dataclass(frozen=True)
class AttestationRequest:
    """Inputs that determine the attestation's plan and frontmatter.

    Parameters
    ----------
    out_path : str
        Where to write the attestation (e.g. ``attestations/mr-72.md``).
    base : str
        Git base ref for the diff.
    droids_dir : str
        Reviewer droids directory.
    criteria : str
        Acceptance criteria text; must come with ``with_outcome``.
    with_outcome : bool
        Include outcome verifiers in the plan.
    skip_outcome_runner : tuple[str, ...]
        Outcome runners to exclude (forbidden with ``force_full``).
    all_ : bool
        Select all droids (plan parity with the dispatch run).
    only : tuple[str, ...]
        Explicit droid names (forbidden with ``force_full``).
    force_full : bool
        Mark this as the verified-final pre-merge stamp.
    override_requested : OverrideRequest | None
        Optional override request. When set and reviewers are missing, the
        writer records the request with an honest (NEEDS_FIX) verdict instead
        of refusing. The gate verifies the request via GitLab API (author-
        excluded approval) before accepting.
    """

    out_path: str
    base: str = DEFAULT_BASE
    droids_dir: str = DEFAULT_DROIDS_DIR
    criteria: str = ""
    with_outcome: bool = False
    skip_outcome_runner: tuple[str, ...] = ()
    all_: bool = False
    only: tuple[str, ...] = ()
    force_full: bool = False
    override_requested: OverrideRequest | None = None


@dataclass(frozen=True)
class VerifyResult:
    """The outcome of verifying the planner cache before a stamp.

    Parameters
    ----------
    commit_sha : str
        HEAD at verification time.
    reviewed_base : str
        The merge-base of the requested base and HEAD — the start of the surface
        the reviewers actually diffed. Recorded so the gate can verify coverage.
    missing : list[str]
        Reviewers lacking a matching cached APPROVE (empty means stamp is legit).
    checked : int
        Number of reviewers actually checked (excluding unverifiable skips).
    """

    commit_sha: str
    reviewed_base: str
    missing: list[str]
    checked: int


def _plan_request(request: AttestationRequest, cache_path: Path) -> PlanRequest:
    """Build the planner request that mirrors the dispatch run."""
    return PlanRequest(
        droids_dir=Path(request.droids_dir),
        cache_path=cache_path,
        criteria=request.criteria,
        with_outcome=request.with_outcome,
        all_=request.all_,
        only=list(request.only),
        force_full=request.force_full,
        skip_outcome_runner=list(request.skip_outcome_runner),
    )


def verify_cache(request: AttestationRequest, *, cache_path: Path) -> VerifyResult:
    """Verify the planner cache has a matching APPROVE for every plan reviewer.

    Parameters
    ----------
    request : AttestationRequest
        The stamp request.
    cache_path : Path
        Incremental-review cache file.

    Returns
    -------
    VerifyResult
        HEAD, the missing reviewers, and the number checked.

    Raises
    ------
    MergeCheckError
        When the diff has no reviewable (non-attestation) files, or the plan
        resolves to an empty roster — either would let a stamp cover nothing.
        Also raised when a ``--force-full`` stamp entry fails the G1 guardrails
        (always-floor re-record or positive ``tool_use_count``), or when the
        G3 classify requirement for an override request is unmet.

    Notes
    -----
    Call stack::

        verify_cache
          ├─ current_head
          ├─ diff_names ── merge_base
          ├─ build_plan
          │     └─ read_cache ── check every reviewer fingerprint + head + APPROVE
          ├─ load_droids
          ├─ _check_stamp_entry (force_full only) ── G1 guardrails
          └─ _check_g3_override (override_requested only) ── G3 classification

    Examples
    --------
    >>> from pathlib import Path
    >>> from merge_check.attestation import AttestationRequest, verify_cache
    >>> result = verify_cache(
    ...     AttestationRequest("attestations/mr-1.md", base="main"),
    ...     cache_path=Path(".factory/merge-check-cache.json"),
    ... )  # doctest: +SKIP
    >>> result.commit_sha  # doctest: +SKIP
    'abc123...'
    """
    commit_sha = current_head()
    changed = diff_names(request.base)

    # Fail closed on an empty / attestation-only review surface. With no reviewable
    # files the roster collapses to the content-independent `always` floor and the
    # reviewer fingerprints bind to nothing — an APPROVE stamp over zero reviewed
    # files is never legitimate, and a narrowed `--base` is the cleanest way to
    # reach this state. (The residual trust in `--base` choosing the surface is a
    # design concern flagged separately; this guard closes the empty-diff case.)
    reviewable = non_attestation_paths(changed)
    if not reviewable:
        raise MergeCheckError(
            f"refusing to stamp: the diff at base {request.base!r} has no reviewable "
            "(non-attestation) files. An APPROVE attestation must cover real reviewed "
            "changes; check the --base ref points at the merge target."
        )

    # Record the merge-base the reviewers actually diffed against (diff_names uses
    # `<base>...HEAD`, i.e. merge-base..HEAD). The CI gate recomputes the merge-base
    # against the real merge target and refuses a stamp whose recorded base does not
    # cover the MR's full diff — closing the narrowed-`--base` forgery.
    reviewed_base = merge_base(request.base, "HEAD")

    plan = build_plan(_plan_request(request, cache_path), changed)

    fingerprints = plan[KEY_PLAN_FINGERPRINTS]  # type: ignore[literal-required]
    if not fingerprints:
        raise MergeCheckError(
            "no reviewers in plan — cannot stamp an empty roster. Ensure droids have "
            "merge_check: blocks and the diff matches at least one trigger."
        )
    full_cache = read_cache(cache_path)
    entries = full_cache[KEY_ENTRIES]
    reasons = plan["reasons"]
    droids = load_droids(Path(request.droids_dir))

    missing: list[str] = []
    checked = 0
    for reviewer, fingerprint in sorted(fingerprints.items()):
        if reasons.get(reviewer, "") in _UNVERIFIABLE_REASONS:
            continue
        checked += 1
        entry = entries.get(reviewer)
        if (
            not isinstance(entry, dict)
            or entry.get(KEY_VERDICT) != Verdict.APPROVE
            or entry.get(KEY_FINGERPRINT) != fingerprint
            or entry.get(KEY_HEAD) != commit_sha
        ):
            missing.append(reviewer)
            continue
        if request.force_full:
            _check_stamp_entry(reviewer, entry, droids)

    _check_floor_pinning(request, droids, reviewed_base)
    _check_g3_override(request, full_cache)
    return VerifyResult(
        commit_sha=commit_sha, reviewed_base=reviewed_base, missing=missing, checked=checked
    )


def _check_floor_pinning(
    request: AttestationRequest,
    current_droids: dict[str, MergeCheckSpec],
    reviewed_base: str,
) -> None:
    """Prevent an MR from redefining the ``always`` floor in the same commit.

    The non-bypassable floor is only trustworthy if its membership cannot be
    removed or narrowed between the merge base and the stamp. An MR that edits
    ``.factory/droids/rtf-security-reviewer.md`` to drop ``always: true`` while also
    changing code could bypass the floor entirely. This check refuses the stamp
    unless every ``always`` droid at the merge base is still ``always`` in the
    current droid roster.
    """
    if not request.force_full:
        # Iteration allows trigger-scoped floor reuse; pinning is only enforced
        # at the final pre-merge stamp.
        return
    root = repo_toplevel()
    droids_dir = Path(request.droids_dir)
    if not (root / droids_dir).resolve().is_relative_to(root):
        # Droids directory is outside the repo (e.g. test fixtures); skip pinning
        # in those environments.
        return
    base_droids = load_droids_at_ref(droids_dir, reviewed_base)
    base_always = {name for name, spec in base_droids.items() if spec.always}
    current_always = {name for name, spec in current_droids.items() if spec.always}
    missing_floor = base_always - current_always
    if missing_floor:
        raise MergeCheckError(
            f"refusing --force-full stamp: the always-floor droid(s) {sorted(missing_floor)!r} "
            "were present at the merge base but are no longer marked `always`. "
            "The non-bypassable floor cannot be removed in the same MR that changes the code "
            "it protects. Restore `always: true` or split the droid change into a separate MR."
        )


def _check_stamp_entry(
    reviewer: str, entry: dict[str, Any], droids: dict[str, MergeCheckSpec]
) -> None:
    """Raise when a cache entry fails the --force-full stamp guardrails.

    Verifies three invariants at the stamp window:

    1. G1: ``always`` droid entries must have been recorded with ``force_full=True``.
    2. G1: ``tool_use_count`` must be a positive integer (not ``None`` or ``bool``).
    3. G6/G7: ``dispatch_started_at`` must be a non-empty string.

    Parameters
    ----------
    reviewer : str
        Reviewer name being checked.
    entry : dict[str, Any]
        The reviewer's cache entry.
    droids : dict[str, MergeCheckSpec]
        Loaded droid roster, used to identify ``always`` droids.
    """
    # G1: always-droid entries must have been recorded with force_full=True.
    spec = droids.get(reviewer, MergeCheckSpec())
    if spec.always is True and entry.get(KEY_ENTRY_FORCE_FULL) is not True:
        raise MergeCheckError(
            f"reviewer {reviewer!r} is an always-floor droid but its cache entry "
            "was recorded without --force-full. Re-record with "
            "`merge-check-plan record --force-full` to bind the fingerprint to "
            "the full diff before stamping."
        )
    # G1: tool_use_count must be a positive integer in the entry at stamp.
    tuc = entry.get(KEY_TOOL_USE_COUNT)
    if not isinstance(tuc, int) or isinstance(tuc, bool) or tuc <= 0:
        raise MergeCheckError(
            f"reviewer {reviewer!r} cache entry is missing a positive tool_use_count "
            "at the --force-full stamp. Re-dispatch the reviewer and record with "
            "--tool-use-count <N> before stamping."
        )
    # G6+G7: dispatch_started_at must be a non-empty string at stamp.
    timing = entry.get(KEY_TIMING)
    dispatch_ts = timing.get(KEY_DISPATCH_STARTED_AT, "") if isinstance(timing, dict) else ""
    if not isinstance(dispatch_ts, str) or dispatch_ts == "":
        raise MergeCheckError(
            f"reviewer {reviewer!r} cache entry is missing dispatch_started_at "
            "at the --force-full stamp. Re-record with "
            "--dispatch-started-at <ISO-timestamp> before stamping."
        )


def _check_g3_override(request: AttestationRequest, full_cache: dict[str, Any]) -> None:
    """G3: refuse --force-full override stamp when classification is missing or stale.

    Two independent failure modes are checked:

    1. No classification result in the cache at all.
       ``--override-requested`` requires an explicit classification pass so the
       in-diff vs pre-existing determination is grounded in real diff data, not
       orchestrator self-report.
    2. Classification result recorded on a different branch.
       The ``classify_done`` flag is branch-scoped; a stale classification from
       another branch must not satisfy the override guard for the current MR.
    """
    cache_branch = full_cache.get(KEY_BRANCH) or ""
    classify_done = full_cache.get(KEY_CLASSIFY_DONE) is True
    if request.override_requested is None:
        return
    current = current_branch()
    if not classify_done:
        raise MergeCheckError(
            "refusing override stamp: no classification result found in the "
            "cache. Run `merge-check-plan classify` to determine which findings are "
            "in-diff vs pre-existing before requesting an override.\n"
            "To skip classification (accepted risk): "
            "merge-check-plan classify --skip-reason '<reason>'"
        )
    if cache_branch != current:
        raise MergeCheckError(
            f"refusing override stamp: classification result was recorded on "
            f"branch {cache_branch!r}, but the current branch is {current!r}. Re-run "
            "`merge-check-plan classify` on the current branch before requesting an override.\n"
            "To skip classification (accepted risk): "
            "merge-check-plan classify --skip-reason '<reason>'"
        )


def _extra_metadata(meta_json: str) -> dict[str, Any]:
    """Parse META_JSON into the extra frontmatter map, dropping reserved keys."""
    if not meta_json.strip():
        return {}
    try:
        parsed = json.loads(meta_json)
    except json.JSONDecodeError as exc:
        raise MergeCheckError(f"META_JSON is not valid JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise MergeCheckError("META_JSON must be a JSON object")
    return {key: value for key, value in parsed.items() if key not in RESERVED}


def _compute_cumulative_findings(cache: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """C08: accumulate per-reviewer round history from the branch cache.

    The attestation writer derives this from the global ``KEY_ROUNDS`` list in
    the cache, so an agent cannot fabricate cumulative findings by stuffing a
    favourable value into META_JSON. ``adversarial_counts`` from META_JSON is
    ignored for this field. The global list includes all verdicts (APPROVE,
    NEEDS_FIX, BLOCK), not just APPROVE — per-reviewer entry rounds only
    survive when the verdict is APPROVE, so the global list is the complete
    audit trail.

    Returns
    -------
    dict[str, dict[str, Any]]
        Per-reviewer summary: ``{"rounds": N, "by_verdict": {...}}``.
    """
    history = cache.get(KEY_ROUNDS, [])
    if not isinstance(history, list):
        return {}
    cumulative: dict[str, dict[str, Any]] = {}
    for rnd in history:
        if not isinstance(rnd, dict):
            continue
        reviewer = rnd.get(KEY_REVIEWER, "UNKNOWN")
        verdict = rnd.get(KEY_VERDICT, "UNKNOWN")
        cumulative.setdefault(reviewer, {"rounds": 0, "by_verdict": {}})
        cumulative[reviewer]["rounds"] += 1
        cumulative[reviewer]["by_verdict"][verdict] = (
            cumulative[reviewer]["by_verdict"].get(verdict, 0) + 1
        )
    return cumulative


def render_frontmatter(
    commit_sha: str,
    verdict: Verdict,
    *,
    reviewed_base: str,
    force_full: bool,
    generated_at: str,
    extra: dict[str, Any],
    cumulative_findings: dict[str, dict[str, Any]],
    override_requested: OverrideRequest | None = None,
) -> str:
    """Render the attestation YAML frontmatter block.

    Parameters
    ----------
    commit_sha : str
        Reviewed commit SHA (derived from git, never the caller).
    verdict : Verdict
        Derived verdict.
    reviewed_base : str
        The merge-base the reviewers diffed against (derived from git).
    force_full : bool
        Whether this is the verified-final stamp.
    generated_at : str
        ISO-8601 UTC timestamp.
    extra : dict[str, Any]
        Audit metadata nested under the ``attestation:`` root.
    cumulative_findings : dict[str, dict[str, Any]]
        Per-reviewer round history accumulated from the branch cache (C08).
    override_requested : OverrideRequest | None, optional
        Override request — recorded as ``override_requested:`` next to the
        regular stamp fields. No identity is stored here; the gate derives
        the approver from the GitLab API.

    Returns
    -------
    str
        The complete ``---``-fenced frontmatter, trailing blank line included.

    Raises
    ------
    MergeCheckError
        When ``yaml.safe_dump`` cannot serialize the frontmatter payload.

    Examples
    --------
    >>> from merge_check.attestation import render_frontmatter
    >>> from merge_check.models import Verdict
    >>> render_frontmatter("0"*40, Verdict.APPROVE, reviewed_base="1"*40,
    ...                     force_full=True, generated_at="2026-01-01T00:00:00Z",
    ...                     extra={}, cumulative_findings={}).startswith("---")
    True
    """
    payload: dict[str, Any] = {
        KEY_SCHEMA_VERSION: SCHEMA_VERSION,
        KEY_COMMIT_SHA: commit_sha,
        KEY_REVIEWED_BASE: reviewed_base,
        KEY_VERDICT: str(verdict),
        KEY_GENERATED_AT: generated_at,
        KEY_FORCE_FULL: force_full,
        KEY_CUMULATIVE_FINDINGS: cumulative_findings,
        **extra,
    }
    if override_requested is not None:
        payload[KEY_OVERRIDE_REQUESTED] = override_requested.to_frontmatter()
    document = {ROOT_KEY: payload}
    try:
        body = yaml.safe_dump(document, sort_keys=False, default_flow_style=False).rstrip("\n")
    except yaml.YAMLError as exc:
        raise MergeCheckError(f"cannot render attestation frontmatter: {exc}") from exc
    return f"---\n{body}\n---\n\n"


def _raise_floor_refusal(result: VerifyResult, request: AttestationRequest) -> None:
    """Raise :exc:`MergeCheckError` with named remedies when reviewers are missing."""
    droids = load_droids(Path(request.droids_dir))
    always_missing = sorted(
        name for name in result.missing
        if droids.get(name, MergeCheckSpec()).always
    )
    remedy_lines = ["Dispatch each reviewer and record its verdict before stamping."]
    if always_missing:
        remedy_lines.append(
            f"Always-floor reviewer(s) ({', '.join(always_missing)}): "
            "re-record with `merge-check-plan record --force-full` to expand "
            "the fingerprint to the full diff — the stamp writer computes the "
            "expanded fingerprint for always droids, so the record must match."
        )
    remedy_lines.append(
        "Or pass --override-requested with a reason to file an override request "
        "(the gate will verify it via GitLab API, not accept it from this client)."
    )
    raise MergeCheckError(
        f"REFUSED: {len(result.missing)} reviewer(s) missing cached APPROVE at HEAD "
        f"{result.commit_sha}:\n"
        + "\n".join(f"  - {name}" for name in result.missing)
        + "\n\n" + "\n".join(remedy_lines)
    )


def _enrich_extra_with_cache_audit(
    extra: dict[str, Any], cache_path: Path,
) -> dict[str, dict[str, Any]]:
    """Read the cache and enrich extra with cumulative findings + skip reason.

    Returns the cumulative findings dict for the caller's use.
    """
    full_cache = read_cache(cache_path)
    cumulative_findings = _compute_cumulative_findings(full_cache)
    # Surface classify_skip_reason in the frontmatter audit trail (G3).
    skip_reason = full_cache.get(KEY_CLASSIFY_SKIP_REASON)
    if skip_reason:
        extra["classify_skip_reason"] = skip_reason
    return cumulative_findings


def write_attestation(
    request: AttestationRequest,
    body: str,
    meta_json: str = "",
    *,
    cache_path: str | Path = DEFAULT_CACHE_PATH,
    root: Path | None = None,
    generated_at: str | None = None,
) -> VerifyResult:
    """Verify the cache, derive the verdict, and write the attestation.

    Parameters
    ----------
    request : AttestationRequest
        Stamp inputs.
    body : str
        The consolidated report body appended after the frontmatter.
    meta_json : str, optional
        Optional JSON object of extra frontmatter fields (reserved keys ignored).
    cache_path : str | Path, optional
        Incremental-review cache file.
    root : Path | None, optional
        Project root for path validation. Defaults to the current directory.
    generated_at : str | None, optional
        Override the UTC timestamp (used by tests for determinism).

    Returns
    -------
    VerifyResult
        The verification result for the run (``missing`` is empty on success).

    Raises
    ------
    MergeCheckError
        On any anti-forgery violation: missing OUT_PATH, criteria without
        ``with_outcome``, roster-limiting flags with ``force_full``, an empty
        roster, missing cached approvals, ``APPROVE`` without ``force_full``,
        invalid META_JSON, an oversized body, or an unwritable target.

    Notes
    -----
    Call stack::

        write_attestation
          ├─ policy gates (criteria/outcome, force_full vs only/skip)
          ├─ verify_cache: current_head + diff_names + build_plan + cache check
          │    └─ REFUSE on empty roster or any missing cached APPROVE
          ├─ derive verdict=APPROVE; REFUSE if APPROVE without force_full
          ├─ render_frontmatter(extra from META_JSON)
          └─ write frontmatter + body to OUT_PATH

    Examples
    --------
    >>> write_attestation(AttestationRequest("attestations/mr-1.md", force_full=True),
    ...                   "# report")  # doctest: +SKIP
    VerifyResult(commit_sha='...', missing=[], checked=3)  # doctest: +SKIP
    """
    root = root or Path.cwd()
    cache_path = Path(cache_path)
    if not request.out_path:
        raise MergeCheckError("missing OUT_PATH")
    if request.criteria.strip() and not request.with_outcome:
        raise MergeCheckError(
            "--criteria is set but --with-outcome is not. Criteria require outcome "
            "verification — pass --with-outcome or clear --criteria."
        )
    if request.force_full and request.only:
        raise MergeCheckError("--force-full cannot be combined with --only (roster restriction)")
    if request.force_full and request.skip_outcome_runner:
        raise MergeCheckError(
            "--force-full cannot be combined with --skip-outcome-runner "
            "(the final gate is non-skippable)"
        )
    if len(body.encode("utf-8")) > MAX_BODY_BYTES:
        raise MergeCheckError(f"body must be <= {MAX_BODY_BYTES} bytes")

    # Validate the output path early — before the expensive cache verification —
    # so a bad path (traversal, symlink) fails closed without touching the cache.
    relative = ensure_repo_relative(request.out_path, root=root, allow_symlink=False)
    out = root / relative

    result = verify_cache(request, cache_path=cache_path)
    if result.missing and request.override_requested is None:
        _raise_floor_refusal(result, request)

    # With missing reviewers + an override request: honest NEEDS_FIX verdict.
    # The gate verifies via GitLab API before accepting; the client records
    # the request, not the decision.
    if result.missing and request.override_requested is not None:
        verdict = Verdict.NEEDS_FIX
    else:
        verdict = Verdict.APPROVE
        if not request.force_full:
            raise MergeCheckError(
                "APPROVE verdict requires --force-full on the attestation write. "
                "Cache reuse during iteration is fine; the stamp before "
                "squash-merge must be the verified-final pass."
            )

    extra = _extra_metadata(meta_json)
    stamp = generated_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        cumulative_findings = _enrich_extra_with_cache_audit(extra, cache_path)
        frontmatter = render_frontmatter(
            result.commit_sha,
            verdict,
            reviewed_base=result.reviewed_base,
            force_full=request.force_full,
            generated_at=stamp,
            extra=extra,
            cumulative_findings=cumulative_findings,
            override_requested=request.override_requested,
        )
        out.write_text(frontmatter + body, encoding="utf-8")
    except OSError as exc:
        raise MergeCheckError(f"cannot write attestation to {request.out_path}: {exc}") from exc
    return result
