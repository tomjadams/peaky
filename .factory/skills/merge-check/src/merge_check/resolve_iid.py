"""Resolve the current branch's open merge-request IID via the ``glab`` CLI.

``glab`` auto-detects the repo from the git remote. ``MERGE_CHECK_MR_IID`` is the
one escape hatch: set it to skip ``glab`` entirely (CI, no glab, detached HEAD, or
testing). Every failure is a fail-loud :class:`MergeCheckError` whose message says
how to recover.

The library does not read :data:`os.environ` directly; the CLI adapter builds an
:class:`~merge_check.env.Env` snapshot and threads it into :func:`resolve_mr_iid`.
That keeps the env contract in one place and tests deterministic.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from collections.abc import Mapping

from merge_check.core.gitio import run_git
from merge_check.env import MR_IID_ENV, Env, env_from_mapping
from merge_check.errors import MergeCheckError

GITLAB_TOKEN_ENV = "GITLAB_TOKEN"  # noqa: S105 — env var NAME, not a secret value
GLAB = "glab"
DETACHED_HEAD = "HEAD"
MR_STATE_OPENED = "opened"


def _resolve_branch() -> str:
    """Return the current branch name, raising on detached HEAD."""
    branch = run_git(["rev-parse", "--abbrev-ref", DETACHED_HEAD], timeout=15).stdout.strip()
    if not branch or branch == DETACHED_HEAD:
        raise MergeCheckError(f"detached HEAD; cannot resolve MR by branch. Set {MR_IID_ENV}.")
    return branch


def _glab_opened_mrs(branch: str, env: Mapping[str, str]) -> list[dict[str, object]]:
    """Return the open merge requests glab reports for ``branch``.

    Parameters
    ----------
    branch : str
        Source branch name.
    env : Mapping[str, str]
        Environment to pass to ``glab`` so GitLab auth (``GITLAB_TOKEN`` /
        ``GITLAB_HOST``) and the ``PATH`` for the ``glab`` binary lookup come
        from the supplied snapshot rather than the live :data:`os.environ` —
        matching the env contract of the rest of the package.

    Returns
    -------
    list[dict[str, object]]
        The merge requests whose ``state`` is ``opened``.

    Raises
    ------
    MergeCheckError
        On auth failure, a glab error, a timeout, a missing CLI, or invalid JSON.
    """
    try:
        auth = subprocess.run(  # noqa: S603
            [GLAB, "auth", "status"],
            capture_output=True,
            timeout=15,
            env=dict(env),
        )
        if auth.returncode != 0:
            raise MergeCheckError(
                f"glab auth failed. Run 'glab auth login' or set {GITLAB_TOKEN_ENV}."
            )
        listed = subprocess.run(  # noqa: S603
            [GLAB, "mr", "list", "--source-branch", branch, "--output", "json"],
            capture_output=True,
            text=True,
            timeout=30,
            env=dict(env),
        )
        if listed.returncode != 0:
            raise MergeCheckError(f"glab mr list failed for branch '{branch}'. Set {MR_IID_ENV}.")
    except subprocess.TimeoutExpired as exc:
        raise MergeCheckError(f"timed out resolving MR IID. Set {MR_IID_ENV}.") from exc
    except FileNotFoundError as exc:
        raise MergeCheckError(f"a required CLI was not on PATH ({exc}). Set {MR_IID_ENV}.") from exc
    try:
        merge_requests = json.loads(listed.stdout or "[]")
    except json.JSONDecodeError as exc:
        raise MergeCheckError(f"glab returned invalid JSON. Set {MR_IID_ENV}.") from exc
    return [mr for mr in merge_requests if mr.get("state") == MR_STATE_OPENED]


def resolve_mr_iid(*, env: Env | Mapping[str, str]) -> str:
    """Resolve and return the current branch's GitLab MR IID.

    Parameters
    ----------
    env : Env | Mapping[str, str]
        Environment to read the override from. ``Mapping`` is accepted for test
        ergonomics (built via :func:`merge_check.env.env_from_mapping`); the CLI
        passes an :class:`~merge_check.env.Env` built from the live process
        environment exactly once.

    Returns
    -------
    str
        The merge-request IID.

    Raises
    ------
    MergeCheckError
        When ``glab``/``git`` is missing, auth fails, HEAD is detached, no open MR
        exists, or ``glab`` returns invalid JSON — each with a recovery hint.

    Notes
    -----
    Flow::

        env override ─▶ return IID
        otherwise    ─▶ glab auth ─▶ git branch ─▶ glab mr list ─▶ first opened IID
            (each subprocess.run receives the env snapshot, not the live environ)

    Examples
    --------
    >>> from merge_check.env import env_from_mapping
    >>> resolve_mr_iid(env=env_from_mapping({"MERGE_CHECK_MR_IID": "72"}))
    '72'
    """
    snapshot = _coerce_env(env)
    if snapshot.mr_iid_override:
        return snapshot.mr_iid_override

    if shutil.which(GLAB, path=snapshot.data.get("PATH")) is None:
        raise MergeCheckError(f"{GLAB} not on PATH. Install glab or set {MR_IID_ENV}.")

    branch = _resolve_branch()
    opened = _glab_opened_mrs(branch, snapshot.data)
    if not opened:
        raise MergeCheckError(f"no open MR for branch '{branch}'. Set {MR_IID_ENV}.")
    iid = opened[0].get("iid")
    if not iid:
        raise MergeCheckError(f"glab returned an MR with no iid. Set {MR_IID_ENV}.")
    return str(iid)


def _coerce_env(env: Env | Mapping[str, str]) -> Env:
    """Build an :class:`Env` from the argument or a mapping shape.

    Accepts a pre-built :class:`Env` (CLI path) or a raw mapping (test path).
    Library consumers never see the raw mapping after this coercion — every
    consumer reads the same typed surface.
    """
    if isinstance(env, Env):
        return env
    return env_from_mapping(env)
