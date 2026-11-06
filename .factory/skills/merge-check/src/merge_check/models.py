"""Typed value objects shared across merge_check modules.

These replace the bare strings and ad-hoc dicts the original scripts passed
around. :class:`Verdict` and :class:`RosterMode` are :class:`~enum.StrEnum`s, so
each member *is* its wire string — ``Verdict.APPROVE == "APPROVE"`` and
``json.dumps(Verdict.APPROVE) == '"APPROVE"'`` — which keeps JSON output and
cache comparisons byte-for-byte identical to the string-literal originals while
giving call sites an exhaustive, ``match``-able type.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from merge_check.errors import MergeCheckError

# Schema key for the override-requested block in frontmatter. The writer, the
# gate, and the CI feature all reference this constant so a rename is caught at
# import time, not at runtime.
#
# P0 re-design: the client records a *request* (reason + optional issue_ref);
# it never resolves a human identity client-side. The gate verifies the override
# via the GitLab API (author-excluded approval or label event) so the identity
# and timestamp come from the forge, not from the contributor's shell environment.
KEY_OVERRIDE_REQUESTED = "override_requested"
KEY_OVERRIDE_REASON = "reason"
KEY_OVERRIDE_ISSUE_REF = "issue_ref"

# Reasonable cap: the override's reason is a human one-or-two-line ack; the
# findings themselves live in the stamp body. A 200-char ceiling keeps the
# reason readable and prevents the frontmatter from absorbing prose.
_MAX_REASON_LEN = 200

# Issue refs are GitLab issue iids (project-local integer). The repo's
# issue iids are bounded by 32-bit signed ints, but we cap conservatively.
_ISSUE_REF_MAX = 2_147_483_647


class Verdict(StrEnum):
    """A reviewer's verdict, and the attestation's verdict enum.

    Only :data:`Verdict.APPROVE` is reusable from the incremental cache; the other
    two always force a rerun and pop any stale cached approval.
    """

    APPROVE = "APPROVE"
    NEEDS_FIX = "NEEDS_FIX"
    BLOCK = "BLOCK"


class RosterMode(StrEnum):
    """How the roster floor is selected for a run.

    ``PATH`` routes by trigger globs, ``ALL`` selects every non-verifier droid,
    and ``ONLY`` selects an explicit list. The non-bypassable ``always`` floor is
    unioned in regardless of mode.
    """

    PATH = "path"
    ALL = "all"
    ONLY = "only"


@dataclass
class MergeCheckSpec:
    """Parsed ``merge_check:`` frontmatter for a single reviewer droid.

    The verifier role is recognised from the droid filename (``-verifier`` suffix)
    rather than a frontmatter key, so it is not stored here.

    Parameters
    ----------
    triggers : list[str]
        Path globs; the droid joins a path-routed run if any changed file matches.
    always : bool
        When ``True`` the droid joins every run (the non-bypassable floor).
    has_block : bool
        Whether the droid declared a ``merge_check:`` block at all — drives the
        ``--audit`` "dormant droid" report.
    """

    triggers: list[str] = field(default_factory=list)
    always: bool = False
    has_block: bool = False


@dataclass(frozen=True)
class OverrideRequest:
    """Override request recorded in the attestation frontmatter.

    Records the contributor's intent to defer pre-existing findings that are
    out of scope for their MR. No human identity is resolved client-side;
    the gate verifies the request by checking the GitLab API for a
    non-author approval or label event so the audit identity comes from the
    forge, not from the contributor's shell environment.

    Parameters
    ----------
    reason : str
        One-line free-text rationale (≤ 200 chars, no backticks). Required.
    issue_ref : int | None
        Optional GitLab issue iid that tracks the deferred work.

    Notes
    -----
    The +1 human approval policy remains the security gateway. The gate
    checks for an author-excluded approval so the MR author cannot self-approve
    the override. See the ``--override-requested`` section in SKILL.md.
    """

    reason: str
    issue_ref: int | None

    @classmethod
    def from_cli_args(
        cls,
        *,
        reason: str | None,
        issue_ref: int | None,
    ) -> OverrideRequest:
        """Build an :class:`OverrideRequest` from the writer's CLI flags.

        Parameters
        ----------
        reason : str | None
            Free-text reason from ``--override-requested``.
        issue_ref : int | None
            Optional iid from ``--override-issue-ref``.

        Returns
        -------
        OverrideRequest
            The validated override request.

        Raises
        ------
        MergeCheckError
            When ``reason`` is empty / too long / contains backticks or
            newlines, or ``issue_ref`` is out of range.
        """
        text = (reason or "").strip()
        if not text:
            raise MergeCheckError("--override-requested requires a non-empty reason.")
        if any(sep in text for sep in ("\n", "\r")):
            raise MergeCheckError(
                "--override-requested reason must be a single line "
                "(no newlines or carriage returns)."
            )
        if "`" in text:
            raise MergeCheckError(
                "--override-requested reason must not contain backticks "
                "(they break Markdown rendering in the governance note)."
            )
        if len(text) > _MAX_REASON_LEN:
            raise MergeCheckError(
                f"--override-requested reason must be <= {_MAX_REASON_LEN} characters "
                f"(got {len(text)})."
            )
        if issue_ref is not None and not (1 <= issue_ref <= _ISSUE_REF_MAX):
            raise MergeCheckError(
                f"--override-issue-ref must be a positive GitLab issue iid (got {issue_ref!r})."
            )
        return cls(reason=text, issue_ref=issue_ref)

    def to_frontmatter(self) -> dict[str, object]:
        """Render the request as a YAML-friendly dict for the frontmatter.

        ``issue_ref`` is omitted when ``None``.

        Returns
        -------
        dict[str, object]
            A mapping with ``reason`` key, plus ``issue_ref`` when set.

        Examples
        --------
        >>> req = OverrideRequest("deferred findings in file X", 97)
        >>> req.to_frontmatter()
        {'reason': 'deferred findings in file X', 'issue_ref': 97}
        >>> req2 = OverrideRequest("deferred", None)
        >>> "issue_ref" in req2.to_frontmatter()
        False
        """
        payload: dict[str, object] = {KEY_OVERRIDE_REASON: self.reason}
        if self.issue_ref is not None:
            payload[KEY_OVERRIDE_ISSUE_REF] = self.issue_ref
        return payload
