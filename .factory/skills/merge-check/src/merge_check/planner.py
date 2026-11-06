"""Reviewer planning for /merge-check — decide what runs, what reuses, what skips.

The expensive part of /merge-check is reviewer dispatch. The planner produces a
run/reuse/skip decision per reviewer for a change set: a reviewer's prior
``APPROVE`` is reused only when the inputs it cares about are byte-for-byte
unchanged (a content fingerprint, see :mod:`merge_check.core.fingerprint`). It
plans both *incrementally* (reuse cached approvals during fix loops) and *fully*
(``force_full`` reruns everything for the pre-merge stamp) — hence "planner", not
"incremental".

Persistence is owned by :mod:`merge_check.persistence`; the planner only reads it
for decisions. The one write — :func:`record_verdict` — lives here rather than in
persistence because, by anti-forgery design, it must *re-plan* and recompute the
canonical fingerprint before it will persist anything.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TypedDict

from merge_check.constants import (
    ATTESTATION_PREFIX,
    ATTESTATION_ROOT_KEY,
    CACHE_SCHEMA_VERSION,
    DEFAULT_CACHE_PATH,
    DEFAULT_RUNS_DIR,
    KEY_BRANCH,
    KEY_COMMIT_SHA,
    KEY_ENTRY_FORCE_FULL,
    KEY_PLAN_FINGERPRINTS,
    KEY_PLAN_RELEVANT_FILES,
    KEY_TOOL_USE_COUNT,
)
from merge_check.core.fingerprint import criteria_digest, reviewer_fingerprint
from merge_check.core.frontmatter import parse_frontmatter
from merge_check.core.gitio import (
    branch_slug,
    current_branch,
    current_head,
    diff_names_between,
    is_ancestor,
    repo_toplevel,
)
from merge_check.core.globs import matches_any
from merge_check.core.paths import ensure_repo_relative, non_attestation_paths
from merge_check.errors import MergeCheckError
from merge_check.models import MergeCheckSpec, RosterMode, Verdict
from merge_check.persistence import (
    KEY_DISPATCH_STARTED_AT,
    KEY_ELAPSED_S,
    KEY_ENTRIES,
    KEY_FINGERPRINT,
    KEY_HEAD,
    KEY_RECORDED_AT,
    KEY_REVIEWED_FILES,
    KEY_REVIEWER,
    KEY_ROUNDS,
    KEY_SUMMARY,
    KEY_TIMING,
    KEY_VERDICT,
    MAX_REVIEWER_ROUNDS,
    MAX_ROUND_HISTORY,
    cache_transaction,
    read_cache,
    write_cache,
)
from merge_check.roster import discover, is_verifier_role, load_droids

HEX_SHA_LENGTH = 40
WARN_LARGE_SLICE_FILES = 25

# Plan/run reasons (consumed by the orchestrator and the attestation writer).
REASON_FORCE_FULL = "force-full"
REASON_ATTESTATION_ONLY = "attestation-only-fast-path"
REASON_CACHED_APPROVE = "cached-approve"
REASON_FINGERPRINT_CHANGED = "fingerprint-changed"
REASON_NO_RELEVANT_FILES = "no-relevant-files"
REASON_DOCS_ONLY = "docs-only-fast-path"
REASON_OUTCOME_SKIPPED = "outcome-runner-skipped-by-flag"


def is_stamp_pass(force_full: bool) -> bool:
    """True when this is the force-full stamp pass (full floor, no skips).

    This is the single predicate that encodes "is this the stamp?" semantics.
    Both :func:`reviewer_files` (floor scope) and :func:`can_skip_on_no_relevant_files`
    (skip eligibility) call it, so the floor-vs-iteration decision is expressed once
    rather than scattered across sibling functions that could drift.

    Parameters
    ----------
    force_full : bool
        Whether ``--force-full`` was passed.

    Returns
    -------
    bool
        ``True`` at the stamp (full floor, no skips); ``False`` during iteration.

    Examples
    --------
    >>> is_stamp_pass(True)
    True
    >>> is_stamp_pass(False)
    False
    """
    return force_full


class OutcomeSkip(TypedDict, total=False):
    """Audit record for outcome-runner droids excluded via ``--skip-outcome-runner``.

    ``outcome_skipped`` is always present; the other fields appear only when at
    least one runner was skipped.
    """

    outcome_skipped: bool
    skipped_runners: list[str]
    reason: str


class FocusHint(TypedDict):
    """Advisory attention hint for a RUN-bucket reviewer at the stamp.

    ``focus`` is the subset of the reviewer's relevant files that changed since
    its last cached APPROVE; ``unchanged`` is the rest. The hint is advisory
    (focus, not skip): the reviewer's fingerprint still covers the full
    relevant set, and the verdict still binds to all of it. A droid that
    ignores the hint reviews everything exactly as today.
    """

    focus: list[str]
    unchanged: list[str]


class Plan(TypedDict):
    """The reviewer run/reuse/skip decision, serialised verbatim to JSON.

    The field names ARE the JSON keys the orchestrator and the attestation writer
    read, so renaming one is a wire-format change. Defining the shape as a
    ``TypedDict`` lets mypy check every ``plan["..."]`` access against this list
    while the on-disk/stdout JSON stays byte-identical to a plain dict.
    """

    schema_version: int
    changed_files_count: int
    fast_path: str
    run: list[str]
    reuse: list[str]
    reasons: dict[str, str]
    fingerprints: dict[str, str]
    relevant_files: dict[str, list[str]]
    relevant_file_counts: dict[str, int]
    cached_timing: dict[str, float]
    slowest_cached_reviewer: str
    outcome_skip: OutcomeSkip
    warnings: list[str]
    reviewer_count: int
    force_full: bool
    cache_hits_count: int
    policy: str
    focus_hints: dict[str, FocusHint]
    zero_delta: bool
    branch: str
    run_dir: str
    record_invocation: str


_POLICY = "Only cached APPROVE results are reusable; force_full reruns every selected reviewer."

# Template the orchestrator can fill after dispatching a reviewer. Includes the
# G6/G7 --dispatch-started-at flag so callers cannot forget to pass it.
_RECORD_INVOCATION_TEMPLATE = (
    "merge-check-plan record "
    "--reviewer <reviewer> "
    "--fingerprint <fingerprint> "
    "--verdict <verdict> "
    "--head <head> "
    "--summary '<summary>' "
    "--elapsed-s <elapsed_s> "
    "--dispatch-started-at <dispatch_started_at> "
    "--tool-use-count <tool_use_count>"
)


@dataclass(frozen=True)
class PlanRequest:
    """The roster/cache/criteria inputs that fully determine a plan.

    Parameters
    ----------
    droids_dir : Path
        Directory of reviewer droids.
    cache_path : Path
        Incremental-review cache file.
    criteria : str
        Acceptance criteria text (empty when none resolved).
    with_outcome : bool
        Include verifier-role droids.
    all_ : bool
        Select every non-verifier droid (the ``--all`` roster).
    only : list[str]
        Explicit droid names (the ``--only`` roster).
    force_full : bool
        Rerun every selected reviewer, ignoring cached approvals.
    skip_outcome_runner : list[str]
        Verifier-role droids to exclude from dispatch (explicit, audited).
    """

    droids_dir: Path
    cache_path: Path = Path(DEFAULT_CACHE_PATH)
    criteria: str = ""
    with_outcome: bool = False
    all_: bool = False
    only: list[str] = field(default_factory=list)
    force_full: bool = False
    skip_outcome_runner: list[str] = field(default_factory=list)
    repo_root: Path | None = None


def reviewer_files(
    reviewer: str,
    spec: MergeCheckSpec,
    changed: list[str],
    *,
    with_outcome: bool,
    force_full: bool = False,
) -> list[str]:
    """Return the changed files a reviewer is responsible for.

    Verifier-role droids (when ``with_outcome``) always see every non-attestation
    change. ``always`` droids see the full non-attestation diff when
    ``force_full`` is set (the pre-merge stamp — this is the anti-forgery floor
    that closes the CVE: a file matching no reviewer's triggers must still be
    covered). During iteration (``force_full=False``) an ``always`` droid is
    routed by its own ``triggers`` exactly like a normal reviewer, so a fix
    outside its triggers no longer changes its fingerprint and it reuses its
    cached APPROVE. Trigger-routed droids always see only matching files.

    Parameters
    ----------
    reviewer : str
        Reviewer droid name.
    spec : MergeCheckSpec
        The reviewer's routing.
    changed : list[str]
        All changed files.
    with_outcome : bool
        Whether outcome verification is active.
    force_full : bool, optional
        Whether this is the force-full stamp pass. When ``True`` the ``always``
        floor sees the full non-attestation diff (CVE closed at the stamp).
        When ``False`` the floor is routed by its triggers (iteration scoping).

    Returns
    -------
    list[str]
        The reviewer's relevant files (attestations excluded).

    Examples
    --------
    >>> from merge_check.roster import load_droids
    >>> spec = load_droids(Path(".factory/droids"))["python-reviewer"]
    >>> reviewer_files("python-reviewer", spec, ["pkg/x.py"], with_outcome=False)
    ['pkg/x.py']
    >>> reviewer_files("security-reviewer", spec, ["pkg/x.py"], with_outcome=False, force_full=True)
    ['pkg/x.py']
    """
    non_attestation = non_attestation_paths(changed)
    if is_verifier_role(reviewer) and with_outcome:
        return non_attestation
    # `always` is the non-bypassable floor. At the force-full stamp it MUST see the
    # whole non-attestation diff — never just its trigger subset — so a file matching
    # no reviewer's triggers (e.g. .factory/merge-check.yml) is still covered and the
    # writer refuses APPROVE without it. This matches the CI gate, which floors
    # `always` droids with a `**` catch-all regardless of their triggers.
    # During iteration the floor is routed by its own triggers so a fix outside its
    # triggers no longer changes its fingerprint and it reuses its cached APPROVE —
    # the stamp path is unaffected because is_stamp_pass forces RUN before any
    # skip/reuse strategy fires.
    if spec.always and is_stamp_pass(force_full):
        return non_attestation
    if spec.triggers:
        return [path for path in non_attestation if matches_any(path, spec.triggers)]
    return []


def can_skip_on_no_relevant_files(
    name: str, spec: MergeCheckSpec, *, force_full: bool = False
) -> bool:
    """Return whether a reviewer with no relevant files may be skipped on iteration.

    During iteration (``force_full=False``) an ``always`` droid is skippable like
    any reviewer: if its trigger-routed file set is empty, it may reuse its cached
    APPROVE. At the force-full stamp (``force_full=True``) the floor is never
    skippable — but that path is already handled by ``_strategy_force_full``,
    which forces RUN before any skip/reuse strategy fires, so this function is
    not consulted at the stamp. Verifier-role droids are likewise never
    skippable — they must see every change to map criteria.

    Parameters
    ----------
    name : str
        Reviewer droid name.
    spec : MergeCheckSpec
        The reviewer's routing.
    force_full : bool, optional
        Whether this is the force-full stamp pass. The ``always`` floor is
        skippable during iteration but never at the stamp (though the stamp
        path is already force-run by ``_strategy_force_full``).

    Returns
    -------
    bool
        Whether the reviewer may be skipped this iteration.

    Examples
    --------
    >>> from merge_check.roster import load_droids
    >>> spec = load_droids(Path(".factory/droids"))["security-reviewer"]
    >>> can_skip_on_no_relevant_files("security-reviewer", spec, force_full=False)
    True
    >>> can_skip_on_no_relevant_files("outcome-verifier", spec, force_full=False)
    False
    """
    if is_verifier_role(name):
        return False
    return not (spec.always and is_stamp_pass(force_full))


def validate_attestation_fast_path(changed: list[str], *, root: Path | None = None) -> None:
    """Fail closed unless every changed attestation has valid frontmatter.

    Parameters
    ----------
    changed : list[str]
        The attestation-only changed file paths.
    root : Path | None, optional
        Project root for path validation. Defaults to the current directory.

    Raises
    ------
    MergeCheckError
        When any path traverses out, is a symlink, or lacks a valid
        ``attestation:`` frontmatter with a 40-hex ``commit_sha`` and a valid
        verdict.

    Examples
    --------
    >>> from pathlib import Path
    >>> # With a valid attestation file at attestations/mr-1.md:
    >>> validate_attestation_fast_path(["attestations/mr-1.md"])  # doctest: +SKIP
    >>> # Missing or invalid frontmatter raises MergeCheckError:
    >>> validate_attestation_fast_path(["attestations/broken.md"])  # doctest: +SKIP
    Traceback (most recent call last):
        ...
    merge_check.errors.MergeCheckError: ...
    """
    root = root or Path.cwd()
    valid_verdicts = {v.value for v in Verdict}
    for file_name in changed:
        relative = ensure_repo_relative(file_name, root=root, allow_symlink=False)
        path = root / relative
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise MergeCheckError(
                f"cannot read attestation for fast path {file_name}: {exc}"
            ) from exc
        frontmatter = parse_frontmatter(text)
        attestation = frontmatter.get(ATTESTATION_ROOT_KEY)
        if not isinstance(attestation, dict):
            raise MergeCheckError(f"attestation fast path requires attestation root in {file_name}")
        # The writer emits the SHA under commit_sha (see render_frontmatter); read
        # that single source rather than a cache-vocabulary "head" key.
        commit_sha = str(attestation.get(KEY_COMMIT_SHA) or "")
        verdict = str(attestation.get(KEY_VERDICT, ""))
        if len(commit_sha) != HEX_SHA_LENGTH or any(
            c not in "0123456789abcdef" for c in commit_sha.lower()
        ):
            raise MergeCheckError(
                f"attestation fast path requires 40-char hex commit_sha in {file_name}"
            )
        if verdict not in valid_verdicts:
            raise MergeCheckError(f"attestation fast path requires valid verdict in {file_name}")


def _select_mode(request: PlanRequest) -> RosterMode:
    """Resolve the roster mode from the request's selection flags."""
    if request.all_:
        return RosterMode.ALL
    if request.only:
        return RosterMode.ONLY
    return RosterMode.PATH


_BUCKET_RUN = "run"
_BUCKET_REUSE = "reuse"
_BUCKET_SKIP = "skip"


def _strategy_force_full(*, force_full: bool) -> tuple[str, str] | None:
    """Strategy: a `--force-full` run reruns every reviewer unconditionally.

    Returns :data:`_BUCKET_RUN` + :data:`REASON_FORCE_FULL` when the gate is
    being forced; ``None`` otherwise to let the next strategy decide.
    """
    return (_BUCKET_RUN, REASON_FORCE_FULL) if force_full else None


def _strategy_skip_runner(reviewer: str, *, skip_runners: set[str]) -> tuple[str, str] | None:
    """Strategy: a reviewer explicitly muted by `--skip-outcome-runner` stays out.

    Returns :data:`_BUCKET_SKIP` + :data:`REASON_OUTCOME_SKIPPED` when this
    reviewer is in the skip set; ``None`` otherwise.
    """
    return (_BUCKET_SKIP, REASON_OUTCOME_SKIPPED) if reviewer in skip_runners else None


def _strategy_attestation_only(*, attestation_only: bool) -> tuple[str, str] | None:
    """Strategy: an attestation-only diff is fast-pathed; reviewers reuse.

    Returns :data:`_BUCKET_REUSE` + :data:`REASON_ATTESTATION_ONLY` when the
    diff touched only attestation / cache files; ``None`` otherwise.
    """
    return (_BUCKET_REUSE, REASON_ATTESTATION_ONLY) if attestation_only else None


def _strategy_docs_only(reviewer: str, *, docs_only: bool) -> tuple[str, str] | None:
    """Strategy: in a docs-only MR, only verifier-role droids reuse; others rerun.

    Returns :data:`_BUCKET_REUSE` + :data:`REASON_DOCS_ONLY` if the diff is
    docs-only and the reviewer is in the verifier role; ``None`` otherwise.
    """
    return (_BUCKET_REUSE, REASON_DOCS_ONLY) if docs_only and is_verifier_role(reviewer) else None


def _strategy_no_relevant_files(
    reviewer: str, spec: MergeCheckSpec, *, relevant: list[str], force_full: bool = False
) -> tuple[str, str] | None:
    """Strategy: a reviewer with no relevant files and skippable routing reuses.

    Returns :data:`_BUCKET_REUSE` + :data:`REASON_NO_RELEVANT_FILES` when the
    routing is skippable on empty relevance; ``None`` otherwise so the next
    strategy decides.
    """
    return (
        (_BUCKET_REUSE, REASON_NO_RELEVANT_FILES)
        if not relevant and can_skip_on_no_relevant_files(reviewer, spec, force_full=force_full)
        else None
    )


def _strategy_cached_approve(
    cached: Any, fingerprint: str, *, current_head: str = ""
) -> tuple[str, str] | None:
    """Strategy: a cached APPROVE with a matching reuse-fingerprint is reused.

    G0 lineage proof: the cached entry's ``head`` must be an ancestor of the
    current HEAD (or equal to it).  An orphaned entry (from a rebased or
    force-pushed branch) and any entry with a missing/empty ``head`` are treated
    as a cache miss so the reviewer runs again rather than reusing a stale or
    corrupted approval.

    Returns :data:`_BUCKET_REUSE` + :data:`REASON_CACHED_APPROVE` when the
    reviewer already has a cached APPROVE for exactly this fingerprint and the
    lineage check passes; ``None`` otherwise (so the last-resort fallback
    below re-runs the reviewer).
    """
    if not (
        isinstance(cached, dict)
        and cached.get(KEY_VERDICT) == Verdict.APPROVE
        and cached.get(KEY_FINGERPRINT) == fingerprint
    ):
        return None
    cached_head = cached.get(KEY_HEAD, "")
    if (
        current_head
        and cached_head != current_head
        and not is_ancestor(cached_head, current_head)
    ):
        return None
    return _BUCKET_REUSE, REASON_CACHED_APPROVE


def _classify_reviewer(
    reviewer: str,
    spec: MergeCheckSpec,
    relevant: list[str],
    cached: Any,
    fingerprint: str,
    *,
    force_full: bool,
    skip_runners: set[str],
    attestation_only: bool,
    docs_only: bool,
    head: str = "",
) -> tuple[str, str]:
    """Decide whether a reviewer should run, reuse a cached approval, or be skipped.

    Composition of strategy callees ordered by precedence (force-full wins,
    then explicit skip, attestation-only fast-path, docs-only verifier reuse,
    no-relevant-files reuse, cached-approve reuse, and finally rerun). The
    strategy helpers each return ``None`` to defer to the next strategy, so
    this body is a literal composition loop rather than a 7-branch if/elif.

    Parameters
    ----------
    reviewer : str
        Reviewer droid name.
    spec : MergeCheckSpec
        The reviewer's routing.
    relevant : list[str]
        The reviewer's relevant changed files.
    cached : Any
        The reviewer's cache entry, if any.
    fingerprint : str
        The reviewer's freshly computed fingerprint.
    force_full : bool
        Whether the full gate is being forced.
    skip_runners : set[str]
        Outcome runners explicitly skipped by flag.
    attestation_only : bool
        Whether the diff is attestation-only.
    docs_only : bool
        Whether the non-attestation diff is docs-only.
    head : str, optional
        Current HEAD SHA, used for the G0 lineage proof when deciding whether
        a cached APPROVE entry is still an ancestor.

    Returns
    -------
    tuple[str, str]
        ``(bucket, reason)`` where bucket is one of :data:`_BUCKET_RUN`,
        :data:`_BUCKET_REUSE`, or :data:`_BUCKET_SKIP`.
    """
    for decision in (
        _strategy_force_full(force_full=force_full),
        _strategy_skip_runner(reviewer, skip_runners=skip_runners),
        _strategy_attestation_only(attestation_only=attestation_only),
        _strategy_docs_only(reviewer, docs_only=docs_only),
        _strategy_no_relevant_files(reviewer, spec, relevant=relevant, force_full=force_full),
        _strategy_cached_approve(cached, fingerprint, current_head=head),
    ):
        if decision is not None:
            return decision
    return _BUCKET_RUN, REASON_FINGERPRINT_CHANGED


def _validate_skip_runners(
    request: PlanRequest, droids: dict[str, MergeCheckSpec]
) -> set[str]:
    """Validate ``--skip-outcome-runner`` flags and return the skip set.

    Rejects non-verifier names and the ``force_full`` + ``skip_outcome_runner``
    combination (the final gate is non-skippable), matching the attestation
    writer's own gate so the planner and writer agree.

    Parameters
    ----------
    request : PlanRequest
        The plan request carrying the skip flags.
    droids : dict[str, MergeCheckSpec]
        Loaded droid specs (for the verifier-role check).

    Returns
    -------
    set[str]
        The validated set of runner names to skip.

    Raises
    ------
    MergeCheckError
        When a non-verifier droid is named, or ``force_full`` is combined with
        a non-empty skip set.
    """
    skip_runners = set(request.skip_outcome_runner)
    non_outcome_skips = sorted(
        name for name in skip_runners if name in droids and not is_verifier_role(name)
    )
    if non_outcome_skips:
        raise MergeCheckError(
            f"--skip-outcome-runner only accepts outcome droids; "
            f"non-outcomes rejected: {', '.join(non_outcome_skips)}"
        )
    if request.force_full and skip_runners:
        raise MergeCheckError(
            "--force-full cannot be combined with --skip-outcome-runner "
            "(the final gate is non-skippable)"
        )
    return skip_runners


def build_plan(request: PlanRequest, changed: list[str]) -> Plan:
    """Build the reviewer run/reuse plan for the current change set.

    Parameters
    ----------
    request : PlanRequest
        Roster, cache, criteria, and force-full inputs.
    changed : list[str]
        Repo-relative changed files (usually ``git diff --name-only``).

    Returns
    -------
    Plan
        JSON-ready plan: reviewers to run, cached approvals to reuse, per-reviewer
        reasons, fingerprints, slice sizes, and timing hints.

    Raises
    ------
    MergeCheckError
        When the droids directory is missing, a non-verifier droid is passed to
        ``skip_outcome_runner``, or an attestation-only fast path is invalid.

    Notes
    -----
    Call stack and data flow::

        build_plan
        ├── load_droids
        ├── discover (roster floor)
        ├── read_cache
        ├── validate_attestation_fast_path (attestation-only path)
        ├── reviewer_fingerprint (per reviewer)
        ├── _strategy_force_full / _strategy_cached_approve / _strategy_no_relevant_files
        └── _compute_focus_hints

    The plan is a pure function of (droids, changed files, cache, request).

    Examples
    --------
    >>> from pathlib import Path
    >>> from merge_check.planner import PlanRequest, build_plan
    >>> request = PlanRequest(
    ...     droids_dir=Path(".factory/droids"),
    ...     criteria="issue 81",
    ...     with_outcome=True,
    ... )  # doctest: +SKIP
    >>> plan = build_plan(request, ["src/merge_check/planner.py"])  # doctest: +SKIP
    >>> plan["run"]  # doctest: +SKIP
    ['python-reviewer', ...]
    """
    droids_dir = request.droids_dir
    if not droids_dir.is_dir():
        raise MergeCheckError(f"droids dir not found: {droids_dir}")
    droids = load_droids(droids_dir)
    mode = _select_mode(request)
    roster = sorted(
        discover(droids, changed, mode=mode, only=request.only, with_outcome=request.with_outcome)
    )
    cache = read_cache(request.cache_path)
    # G0: branch-scope guard — treat entries from a different branch as a full
    # cache miss so run artifacts from one MR never contaminate another.
    branch = current_branch()
    cache_branch = cache.get(KEY_BRANCH) or ""
    same_branch = not cache_branch or cache_branch == branch
    entries: dict[str, Any] = cache[KEY_ENTRIES] if same_branch else {}
    criteria = criteria_digest(request.criteria or "")
    repo_root = request.repo_root or repo_toplevel()

    skip_runners = _validate_skip_runners(request, droids)
    unknown = sorted(name for name in roster if name not in droids)
    if unknown:
        raise MergeCheckError(f"unknown reviewer names: {', '.join(unknown)}")

    attestation_only = bool(changed) and all(p.startswith(ATTESTATION_PREFIX) for p in changed)
    if attestation_only and not request.force_full:
        validate_attestation_fast_path(changed)
    non_attestation_changed = non_attestation_paths(changed)
    docs_only = bool(non_attestation_changed) and all(
        p.endswith(".md") for p in non_attestation_changed
    )

    # Compute HEAD once for lineage proof in _strategy_cached_approve (G0).
    # At force_full the strategy never fires, so skip the git call.
    head_for_lineage = "" if request.force_full is True else current_head()

    run: list[str] = []
    reuse: list[str] = []
    reasons: dict[str, str] = {}
    fingerprints: dict[str, str] = {}
    relevant_by_reviewer: dict[str, list[str]] = {}
    cached_timing: dict[str, float] = {}

    for reviewer in roster:
        spec = droids[reviewer]
        relevant = reviewer_files(
            reviewer,
            spec,
            changed,
            with_outcome=request.with_outcome,
            force_full=request.force_full,
        )
        relevant_by_reviewer[reviewer] = relevant
        fingerprint = reviewer_fingerprint(
            reviewer,
            spec,
            droids_dir,
            relevant,
            criteria=criteria,
            is_verifier=is_verifier_role(reviewer),
            repo_root=repo_root,
        )
        fingerprints[reviewer] = fingerprint
        cached = entries.get(reviewer)
        if isinstance(cached, dict):
            timing = cached.get(KEY_TIMING)
            if isinstance(timing, dict) and isinstance(timing.get(KEY_ELAPSED_S), (int, float)):
                cached_timing[reviewer] = float(timing[KEY_ELAPSED_S])
        bucket, reason = _classify_reviewer(
            reviewer,
            spec,
            relevant,
            cached,
            fingerprint,
            force_full=request.force_full,
            skip_runners=skip_runners,
            attestation_only=attestation_only,
            docs_only=docs_only,
            head=head_for_lineage,
        )
        reasons[reviewer] = reason
        if bucket == _BUCKET_RUN:
            run.append(reviewer)
        elif bucket == _BUCKET_REUSE:
            reuse.append(reviewer)

    warnings = [
        f"{name}: {len(files)} relevant files (>{WARN_LARGE_SLICE_FILES}); "
        "consider per-reviewer diff slicing to reduce context."
        for name, files in relevant_by_reviewer.items()
        if len(files) > WARN_LARGE_SLICE_FILES
    ]
    outcome_skip = _outcome_skip_summary(skip_runners, droids, warnings)

    # Focus hints: for each RUN-bucket reviewer, compute which of its relevant
    # files changed since its last cached APPROVE. The hint is advisory (focus,
    # not skip) — the fingerprint still covers the full relevant set. No prior
    # APPROVE → focus = all relevant files. Reuse-bucket reviewers don't need
    # a hint (they aren't being dispatched).
    focus_hints = _compute_focus_hints(run, entries, relevant_by_reviewer)

    slowest = max(cached_timing, key=cached_timing.__getitem__) if cached_timing else ""

    # Zero-delta detection: when every cached entry was recorded at the current
    # HEAD and nothing is in the RUN bucket (all reuse), the re-run is a no-op.
    # This prevents wasted dispatches like MR !111 round 3b, where all 5
    # reviewers were re-dispatched without any fixes applied.
    zero_delta = False
    if not request.force_full and not run:
        commit_sha = current_head()
        cached_heads = {
            c.get(KEY_HEAD)
            for c in entries.values()
            if isinstance(c, dict) and c.get(KEY_HEAD)
        }
        zero_delta = len(cached_heads) == 1 and commit_sha in cached_heads

    slug = branch_slug(branch)
    run_dir = str(repo_root / DEFAULT_RUNS_DIR / slug)
    return Plan(
        schema_version=CACHE_SCHEMA_VERSION,
        changed_files_count=len(changed),
        fast_path="attestation-only" if attestation_only and not request.force_full else "",
        run=run,
        reuse=reuse,
        reasons=reasons,
        fingerprints=fingerprints,
        relevant_files=relevant_by_reviewer,
        relevant_file_counts={name: len(files) for name, files in relevant_by_reviewer.items()},
        cached_timing=cached_timing,
        slowest_cached_reviewer=slowest,
        outcome_skip=outcome_skip,
        warnings=warnings,
        reviewer_count=len(roster),
        force_full=bool(request.force_full),
        cache_hits_count=len(reuse),
        policy=_POLICY,
        focus_hints=focus_hints,
        zero_delta=zero_delta,
        branch=branch,
        run_dir=run_dir,
        record_invocation=_RECORD_INVOCATION_TEMPLATE,
    )


def _compute_focus_hints(
    run_reviewers: list[str],
    entries: dict[str, Any],
    relevant_by_reviewer: dict[str, list[str]],
) -> dict[str, FocusHint]:
    """Compute advisory focus hints for RUN-bucket reviewers.

    For each reviewer in ``run_reviewers``, look up its last cached APPROVE
    commit SHA (``KEY_HEAD`` in the cache entry). If found, compute the set of
    files that changed between that commit and HEAD, intersect with the
    reviewer's relevant files, and split into ``focus`` (changed) and
    ``unchanged``. If no prior APPROVE exists, ``focus`` = all relevant files
    and ``unchanged`` = [].

    The hint is computed AFTER the fingerprint, so it never enters the
    fingerprint input — the stamp fingerprint is identical with or without the
    hint. A git failure (e.g. the prior commit is unreachable) degrades
    gracefully to ``focus = all relevant``.

    Parameters
    ----------
    run_reviewers : list[str]
        Reviewer names in the RUN bucket (being dispatched this round).
    entries : dict[str, Any]
        The cache entries (read by the caller).
    relevant_by_reviewer : dict[str, list[str]]
        The relevant files per reviewer.

    Returns
    -------
    dict[str, FocusHint]
        Per-reviewer focus/unchanged split. Only RUN-bucket reviewers appear.
    """
    hints: dict[str, FocusHint] = {}
    for reviewer in run_reviewers:
        relevant = relevant_by_reviewer.get(reviewer, [])
        cached = entries.get(reviewer)
        last_head = (
            cached.get(KEY_HEAD)
            if isinstance(cached, dict) and cached.get(KEY_VERDICT) == Verdict.APPROVE
            else None
        )
        if not last_head or not isinstance(last_head, str) or len(last_head) != HEX_SHA_LENGTH:
            # No prior APPROVE or invalid SHA → focus on everything
            hints[reviewer] = FocusHint(focus=list(relevant), unchanged=[])
            continue
        try:
            changed_since = set(diff_names_between(last_head, "HEAD"))
        except MergeCheckError:
            # Prior commit unreachable → focus on everything (worst case == today)
            hints[reviewer] = FocusHint(focus=list(relevant), unchanged=[])
            continue
        relevant_set = set(relevant)
        focus = sorted(relevant_set & changed_since)
        unchanged = sorted(relevant_set - changed_since)
        hints[reviewer] = FocusHint(focus=focus, unchanged=unchanged)
    return hints


def _outcome_skip_summary(
    skip_runners: set[str],
    droids: dict[str, MergeCheckSpec],
    warnings: list[str],
) -> OutcomeSkip:
    """Summarise outcome-runner skips and append a warning for unknown names.

    Parameters
    ----------
    skip_runners : set[str]
        Names passed via ``--skip-outcome-runner``.
    droids : dict[str, MergeCheckSpec]
        Loaded droid roster.
    warnings : list[str]
        Mutable warning list; unknown names are appended here.

    Returns
    -------
    OutcomeSkip
        Audit record indicating whether any outcome runner was skipped and
        which known runners were disabled.
    """
    if not skip_runners:
        return OutcomeSkip(outcome_skipped=False)
    known = sorted(name for name in skip_runners if name in droids)
    unknown = sorted(name for name in skip_runners if name not in droids)
    if unknown:
        warnings.append(f"--skip-outcome-runner names not in droid roster: {', '.join(unknown)}")
    return OutcomeSkip(
        outcome_skipped=True,
        skipped_runners=known,
        reason="runner-disabled-by-flag",
    )


def _append_round_snapshot(
    cache: dict[str, Any], head: str, recorded_at: str, reviewer: str, verdict: Verdict
) -> None:
    """Append a round snapshot to the cache history, bounded to MAX_ROUND_HISTORY.

    Parameters
    ----------
    cache : dict[str, Any]
        The planner cache; mutated in place.
    head : str
        Current git HEAD at the time of recording.
    recorded_at : str
        ISO-8601 UTC timestamp of the record call.
    reviewer : str
        Reviewer name that produced a verdict this round.
    verdict : Verdict
        Verdict returned by the reviewer this round.

    Returns
    -------
    None
    """
    rounds: list[dict[str, str]] = cache.setdefault(KEY_ROUNDS, [])
    rounds.append({
        KEY_HEAD: head,
        KEY_RECORDED_AT: recorded_at,
        KEY_REVIEWER: reviewer,
        KEY_VERDICT: str(verdict),
    })
    if len(rounds) > MAX_ROUND_HISTORY:
        cache[KEY_ROUNDS] = rounds[-MAX_ROUND_HISTORY:]


def _compute_elapsed(dispatch_started_at: str | None, fallback: float) -> float:
    """Compute real wall-clock from dispatch start to now, falling back to estimate.

    Parameters
    ----------
    dispatch_started_at : str | None
        ISO-8601 UTC timestamp of reviewer dispatch. ``Z`` suffix is normalised
        to ``+00:00`` before parsing.
    fallback : float
        Value to return when the timestamp is missing or unparseable.

    Returns
    -------
    float
        Elapsed seconds since dispatch, rounded to one decimal place, or the
        fallback value when no valid timestamp is available.
    """
    if not dispatch_started_at:
        return fallback
    try:
        dispatch_ts = datetime.fromisoformat(dispatch_started_at.replace("Z", "+00:00"))
        return round((datetime.now(UTC) - dispatch_ts).total_seconds(), 1)
    except (ValueError, TypeError):
        return fallback


def record_verdict(
    request: PlanRequest,
    changed: list[str],
    *,
    reviewer: str,
    fingerprint: str,
    verdict: Verdict,
    head: str,
    summary: str = "",
    elapsed_s: float = 0.0,
    tool_use_count: int | None = None,
    dispatch_started_at: str | None = None,
) -> None:
    """Write one reviewer's verdict into the shared cache under both locks.

    The fingerprint is recomputed from the live plan and the caller's value must
    match it, ``head`` must equal the current git HEAD, and only ``APPROVE`` is
    stored — any other verdict pops the reviewer so a later verifier sees the
    failure rather than a stale approval. This re-plan-before-persist is why the
    one cache *write* lives in the planner, not in :mod:`merge_check.persistence`.

    **Hollow-APPROVE guard.** An ``APPROVE`` with ``tool_use_count <= 0`` is
    always rejected as a hollow approval — a reviewer that made no tool calls
    (no file reads, no command execution) cannot have inspected the diff, so its
    APPROVE is treated as :data:`REVIEWER_FAILURE` and the cache entry is not
    written. At the ``--force-full`` stamp, ``tool_use_count`` is **mandatory**:
    ``None`` is rejected because absence itself fails closed at the stamp. During
    iteration (``force_full=False``), ``None`` is tolerated for backward
    compatibility. Non-APPROVE verdicts are unaffected (a BLOCK with zero tool
    uses is still a BLOCK).

    The count MUST be the reviewer subagent's real, observed tool-call total
    from its execution result — not a number the orchestrator invents. A
    fabricated count defeats the guard; if the harness cannot surface a real
    count for a given reviewer, that reviewer must be re-dispatched, not
    recorded with a guessed value.

    Parameters
    ----------
    request : PlanRequest
        Same roster/criteria inputs used to dispatch (so the fingerprint matches).
    changed : list[str]
        The changed files for the current plan.
    reviewer : str
        Reviewer whose verdict is being recorded.
    fingerprint : str
        Caller's fingerprint; must equal the freshly computed one.
    verdict : Verdict
        The reviewer's verdict.
    head : str
        Caller's HEAD SHA; must equal ``git rev-parse HEAD``.
    summary : str, optional
        One-line reviewer summary.
    elapsed_s : float, optional
        Reviewer wall-clock seconds, stored for tuning. When ``dispatch_started_at``
        is also provided, the real wall-clock from dispatch to record replaces any
        caller-supplied estimate — ``elapsed_s`` then serves only as a fallback.
    dispatch_started_at : str | None, optional
        ISO-8601 UTC timestamp of the dispatch start. When provided, the planner
        computes real wall-clock from this timestamp to now and stores it as the
        authoritative ``elapsed_s``, replacing any caller estimate. The raw
        dispatch start time is also stored for audit.
    tool_use_count : int | None, optional
        Number of tool calls the reviewer made (file reads, greps, commands),
        sourced from the subagent's execution result. When ``<= 0``, an APPROVE
        is rejected as hollow. At the ``--force-full`` stamp (``request.force_full
        = True``), ``None`` is also rejected — the stamp requires a real,
        positive count. During iteration, ``None`` is tolerated for backward
        compatibility.

    Raises
    ------
    MergeCheckError
        When HEAD does not match, the reviewer is not in the plan, the
        fingerprint does not match, an APPROVE is recorded with zero or negative
        tool uses (hollow approval), or an APPROVE is recorded without a
        tool-use count at the --force-full stamp (mandatory at the stamp).

    Notes
    -----
    Call stack::

        record_verdict
          └─ cache_transaction (both locks)
                └─ read_cache ── current_head (validate) ── build_plan (re-derive
                     fingerprint) ── hollow-APPROVE guard ── current_branch
                     ── write_cache
                       └─ entry carries fingerprint, verdict, head, elapsed_s,
                          dispatch_started_at, tool_use_count, force_full

    Examples
    --------
    >>> from merge_check.models import Verdict
    >>> record_verdict(
    ...     PlanRequest(droids_dir=Path(".factory/droids")),  # doctest: +SKIP
    ...     ["src/merge_check/planner.py"],
    ...     reviewer="python-reviewer",
    ...     fingerprint="abc123...",
    ...     verdict=Verdict.APPROVE,
    ...     head="abc123...",
    ...     summary="APPROVE — 0 findings",
    ...     elapsed_s=12.3,
    ...     tool_use_count=5,
    ... )  # doctest: +SKIP
    """
    with cache_transaction(request.cache_path):
        cache = read_cache(request.cache_path)
        if head != current_head():
            raise MergeCheckError("--head must equal current git HEAD")
        plan = build_plan(request, changed)
        expected = plan[KEY_PLAN_FINGERPRINTS].get(reviewer)  # type: ignore[literal-required]
        if not expected:
            raise MergeCheckError(f"reviewer {reviewer!r} is not in the current plan")
        if fingerprint != expected:
            raise MergeCheckError("--fingerprint does not match the current reviewer fingerprint")
        if verdict == Verdict.APPROVE:
            if tool_use_count is None:
                if request.force_full:
                    raise MergeCheckError(
                        f"reviewer {reviewer!r} returned APPROVE at the --force-full stamp "
                        "without --tool-use-count. The stamp requires a real, positive "
                        "tool-use count from the reviewer's execution result. "
                        "Re-dispatch the reviewer and pass its observed tool-call total."
                    )
                # Iteration: None tolerated for backward compatibility
            elif tool_use_count <= 0:
                raise MergeCheckError(
                    f"reviewer {reviewer!r} returned APPROVE with {tool_use_count} tool uses — "
                    "a hollow approval (no evidence of work) is rejected as REVIEWER_FAILURE. "
                    "Re-dispatch the reviewer and ensure it reads the diff before approving."
                )
        # Compute real wall-clock when dispatch_started_at is provided.
        # Planner-measured timing replaces orchestrator-supplied estimates,
        # giving reliable per-reviewer duration for tuning (P5/MR !111 finding 5).
        recorded_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        real_elapsed_s = _compute_elapsed(dispatch_started_at, elapsed_s)

        # G0: stamp the branch on the cache so cross-branch reads are rejected.
        # If the cache was previously written on a different branch, discard its
        # entries before writing — the planner would reject them anyway, but leaving
        # them risks relabeling stale approvals as current-branch if the top-level
        # key is overwritten.
        current = current_branch()
        if cache.get(KEY_BRANCH) != current:
            cache[KEY_ENTRIES] = {}
            cache[KEY_ROUNDS] = []
        cache[KEY_BRANCH] = current

        if verdict != Verdict.APPROVE:
            cache[KEY_ENTRIES].pop(reviewer, None)
        else:
            old_entry = cache[KEY_ENTRIES].get(reviewer, {})
            old_rounds = old_entry.get(KEY_ROUNDS, []) if isinstance(old_entry, dict) else []
            entry = {
                KEY_FINGERPRINT: expected,
                KEY_VERDICT: str(verdict),
                KEY_HEAD: head,
                KEY_REVIEWED_FILES: plan[KEY_PLAN_RELEVANT_FILES].get(reviewer, []),  # type: ignore[literal-required]
                KEY_RECORDED_AT: recorded_at,
                KEY_SUMMARY: summary,
                KEY_TIMING: {
                    KEY_ELAPSED_S: real_elapsed_s,
                    KEY_DISPATCH_STARTED_AT: dispatch_started_at or "",
                },
                # G1: persist tool_use_count and force_full in the entry so the
                # writer can verify them at stamp time without trusting META_JSON.
                KEY_TOOL_USE_COUNT: tool_use_count,
                KEY_ENTRY_FORCE_FULL: request.force_full,
                # C08: per-reviewer bounded round history for cumulative findings.
                KEY_ROUNDS: [*old_rounds, {
                    KEY_VERDICT: str(verdict),
                    KEY_SUMMARY: summary,
                    KEY_RECORDED_AT: recorded_at,
                    KEY_HEAD: head,
                    KEY_ELAPSED_S: real_elapsed_s,
                    KEY_DISPATCH_STARTED_AT: dispatch_started_at or "",
                    KEY_TOOL_USE_COUNT: tool_use_count,
                    KEY_ENTRY_FORCE_FULL: request.force_full,
                }][-MAX_REVIEWER_ROUNDS:],
            }
            cache[KEY_ENTRIES][reviewer] = entry

        # Append a round snapshot to the history (bounded to last N rounds)
        _append_round_snapshot(cache, head, recorded_at, reviewer, verdict)
        write_cache(request.cache_path, cache)


def slice_files(
    droids_dir: Path,
    reviewer: str,
    changed: list[str],
    *,
    with_outcome: bool,
    force_full: bool = False,
) -> list[str]:
    """Return the per-reviewer relevant file list for diff scoping.

    Parameters
    ----------
    droids_dir : Path
        Directory of reviewer droids.
    reviewer : str
        Reviewer to slice for.
    changed : list[str]
        All changed files.
    with_outcome : bool
        Whether outcome verification is active.
    force_full : bool, optional
        Whether this is the force-full stamp pass. Defaults to ``False``
        (iteration scoping), so the ``always`` floor is routed by its triggers
        during incremental fix loops.

    Returns
    -------
    list[str]
        The reviewer's relevant files. An empty list means the reviewer has no
        trigger-matched files (for non-``always`` droids, or for ``always`` droids
        during iteration when no file matches their triggers). At
        ``force_full=True`` the ``always`` floor returns the full non-attestation
        diff, never an empty list.

    Raises
    ------
    MergeCheckError
        When the droids directory is missing or the reviewer is not registered.

    Notes
    -----
    Call stack::

        slice_files -> load_droids -> reviewer_files

    The returned list is the exact set of files the reviewer should see in its
    scoped diff. The planner uses the same rule when building fingerprints, so
    a sliced dispatch stays consistent with the plan.

    Examples
    --------
    >>> from pathlib import Path
    >>> slice_files(
    ...     Path(".factory/droids"),
    ...     "python-reviewer",
    ...     ["src/merge_check/planner.py", "README.md"],
    ...     with_outcome=False,
    ... )  # doctest: +SKIP
    ['src/merge_check/planner.py']
    """
    if not droids_dir.is_dir():
        raise MergeCheckError(f"droids dir not found: {droids_dir}")
    droids = load_droids(droids_dir)
    if reviewer not in droids:
        raise MergeCheckError(f"reviewer {reviewer!r} is not registered")
    return reviewer_files(
        reviewer, droids[reviewer], changed, with_outcome=with_outcome, force_full=force_full
    )
