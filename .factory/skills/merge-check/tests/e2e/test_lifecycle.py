"""End-to-end /merge-check lifecycle — the whole flow, holistically, in one place.

This is the test to read to understand how the pieces fit together. It builds a
real git repo with reviewer droids, runs the full lifecycle the orchestrator
drives —

    discover roster → plan reviewers → record each APPROVE → write attestation

— and then runs the **actual CI gate** (`scripts/ci/mr_require_quality_gates.py`)
against the attestation, asserting it accepts a legitimate stamp and rejects the
two forgeries the design defends against: reviewer-relevant drift after the
stamp, and a review run against a narrowed `--base`.
"""

from __future__ import annotations

import importlib.util
import subprocess
from pathlib import Path
from types import ModuleType

import pytest
import yaml

from merge_check.attestation import AttestationRequest, write_attestation
from merge_check.core.gitio import current_head, diff_names
from merge_check.models import Verdict
from merge_check.planner import (
    PlanRequest,
    build_plan,
    record_verdict,
)

# Repo root is five parents up from this file: tests/e2e → tests → merge-check →
# skills → .factory → <root>. The CI gate lives outside the skill package.
_GATE_PATH = Path(__file__).resolve().parents[5] / "scripts" / "ci" / "mr_require_quality_gates.py"


def _load_gate() -> ModuleType:
    """Load the standalone CI gate script as a module by path."""
    import sys

    spec = importlib.util.spec_from_file_location("merge_gate_e2e", _GATE_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    # Register before exec_module so `@dataclass` decorations can resolve the
    # module via `sys.modules.get(cls.__module__)` and the CI gate's CIMergeRequestEnv
    # dataclass can decorate cleanly.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


# The CI gate lives outside the skill bundle, so a ported skill may not ship it.
# Skip this cross-component e2e cleanly rather than breaking collection.
pytestmark = pytest.mark.skipif(
    not _GATE_PATH.exists(), reason="CI gate (scripts/ci/mr_require_quality_gates.py) not present"
)
gate = _load_gate() if _GATE_PATH.exists() else None


def _git(repo: Path, *args: str) -> str:
    """Run a git command in ``repo`` and return stripped stdout."""
    return subprocess.run(
        ["git", *args], cwd=str(repo), capture_output=True, text=True, check=True
    ).stdout.strip()


def _commit(repo: Path, name: str, content: str) -> str:
    """Write, add, and commit a file; return the new commit SHA."""
    (repo / name).parent.mkdir(parents=True, exist_ok=True)
    (repo / name).write_text(content, encoding="utf-8")
    _git(repo, "add", name)
    _git(repo, "commit", "-q", "-m", name)
    return _git(repo, "rev-parse", "HEAD")


@pytest.fixture
def mr_repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A repo with reviewer droids and a `main` target, cwd set inside it."""
    repo = tmp_path / "mr"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Test")
    droids = repo / ".factory" / "droids"
    droids.mkdir(parents=True)
    (droids / "security-reviewer.md").write_text(
        "---\nname: security-reviewer\nmerge_check:\n  always: true\n---\n# security\n"
    )
    (droids / "python-reviewer.md").write_text(
        "---\nname: python-reviewer\nmerge_check:\n  triggers: ['**/*.py']\n---\n# python\n"
    )
    # Commit both the seed file and the droid files to `main` so the target branch
    # the gate reads from actually carries the security floor. A real CI pipeline
    # always diffs against a target branch that already has the droid files.
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "seed and droids")
    # Work on a feature branch so `main` stays the merge target the gate diffs against.
    _git(repo, "checkout", "-q", "-b", "feature")
    monkeypatch.chdir(repo)
    return repo


def _cache(repo: Path) -> Path:
    return repo / ".factory" / "merge-check-cache.json"


def _stamp(repo: Path, base: str) -> None:
    """Run the full lifecycle: plan → record every reviewer's APPROVE → write the stamp.

    Mirrors what the /merge-check orchestrator drives, against the diff at ``base``.
    The plan uses ``force_full=True`` so the always-floor is in the ``run`` list
    (not reused) and its fingerprint covers the full diff — matching the stamp.
    """
    droids_dir = repo / ".factory" / "droids"
    cache_path = _cache(repo)
    changed = diff_names(base)
    plan_request = PlanRequest(droids_dir=droids_dir, cache_path=cache_path, force_full=True)
    plan = build_plan(plan_request, changed)
    head = current_head()
    for reviewer in plan["run"]:
        record_verdict(
            plan_request,
            changed,
            reviewer=reviewer,
            fingerprint=plan["fingerprints"][reviewer],
            verdict=Verdict.APPROVE,
            head=head,
            tool_use_count=5,
            dispatch_started_at="2026-01-01T00:00:00Z",
        )
    write_attestation(
        AttestationRequest(
            out_path="attestations/mr-1.md",
            base=base,
            droids_dir=str(droids_dir),
            force_full=True,
        ),
        "# /merge-check report",
        cache_path=cache_path,
        root=repo,
        generated_at="2026-01-01T00:00:00Z",
    )


def _run_gate(monkeypatch: pytest.MonkeyPatch, target_sha: str) -> int:
    """Invoke the real CI gate for MR iid 1 with the target branch pinned via env.

    The gate ships with ``GATE_DISABLED = True`` as a temporary production disable
    (until /merge-check v2). E2e tests must exercise the actual gate logic, so we
    force-enable it here via monkeypatch — the production constant is restored
    when the test exits.
    """
    monkeypatch.setenv("CI_MERGE_REQUEST_TARGET_BRANCH_SHA", target_sha)
    monkeypatch.delenv("MR_HEAD_SHA", raising=False)
    monkeypatch.setattr(gate, "GATE_DISABLED", False)
    return gate._main(["1"])


def test_legitimate_full_review_is_accepted_by_the_gate(
    mr_repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # GIVEN a feature branch reviewed against the real merge target (main)
    # WHEN the full lifecycle stamps an attestation and the CI gate runs
    # THEN the gate accepts it (force_full + commit_sha + no drift + base covers the diff)
    target = _git(mr_repo, "rev-parse", "main")
    _commit(mr_repo, "pkg/feature.py", "value = 1\n")
    _stamp(mr_repo, base="main")

    written = (mr_repo / "attestations" / "mr-1.md").read_text()
    frontmatter = yaml.safe_load(written.split("---\n", 2)[1])
    assert frontmatter["attestation"]["schema_version"] == 6
    # C08: cumulative_findings is derived from the cache, not META_JSON.
    cumulative = frontmatter["attestation"].get("cumulative_findings", {})
    assert cumulative == {
        "python-reviewer": {"rounds": 1, "by_verdict": {"APPROVE": 1}},
        "security-reviewer": {"rounds": 1, "by_verdict": {"APPROVE": 1}},
    }, f"unexpected cumulative_findings: {cumulative!r}"
    assert _run_gate(monkeypatch, target) == 0


def test_gate_rejects_reviewer_relevant_drift_after_the_stamp(
    mr_repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # GIVEN a legitimate stamp
    # WHEN a reviewer-relevant file is edited AFTER the stamp (HEAD moves on)
    # THEN the gate rejects the now-stale attestation
    target = _git(mr_repo, "rev-parse", "main")
    _commit(mr_repo, "pkg/feature.py", "value = 1\n")
    _stamp(mr_repo, base="main")
    _commit(mr_repo, "pkg/feature.py", "value = 999  # changed after the stamp\n")

    assert _run_gate(monkeypatch, target) == 1


def test_gate_rejects_a_review_run_against_a_narrowed_base(
    mr_repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # GIVEN a feature branch with two commits (a.py then b.py) off main
    # WHEN the stamp is produced against a narrowed base (the first feature commit),
    #      so only b.py was reviewed and a.py was skipped
    # THEN the gate rejects it: reviewed_base does not cover the MR's full diff vs main
    target = _git(mr_repo, "rev-parse", "main")
    first = _commit(mr_repo, "pkg/a.py", "a = 1\n")
    _commit(mr_repo, "pkg/b.py", "b = 1\n")
    _stamp(mr_repo, base=first)  # narrowed: reviews only b.py, skipping a.py

    exit_code = _run_gate(monkeypatch, target)
    assert exit_code == 1


def test_expected_review_base_resolves_from_the_merge_ref_parents(mr_repo: Path) -> None:
    # GIVEN HEAD is a real merge commit (the shape of the GitLab MR merge ref that
    #       production CI runs against), built by merging a source branch into an
    #       independently-advanced target
    # WHEN the gate resolves the expected review base
    # THEN it uses the two parents' merge-base — the true diff base — exercising the
    #      len(parents) > 2 path the CI_MERGE_REQUEST_TARGET_BRANCH_SHA fallback tests miss
    branch_point = _git(mr_repo, "merge-base", "main", "HEAD")  # feature diverged from main here
    source = _commit(mr_repo, "pkg/a.py", "a = 1\n")  # advance the source (feature) branch
    _git(mr_repo, "checkout", "-q", "main")
    target = _commit(mr_repo, "pkg/b.py", "b = 1\n")  # advance the target independently
    _git(mr_repo, "merge", "--no-ff", "-m", "merge source", source)  # 2-parent merge ref
    merged = _git(mr_repo, "rev-parse", "HEAD")

    # Construct the CI environment snapshot explicitly from the test's git state
    # rather than calling ``read_ci_env`` (which reads the live ``os.environ``);
    # an e2e test must never depend on the host's CI variables.
    ci_env = gate.CIMergeRequestEnv(
        target_branch_sha=_git(mr_repo, "rev-parse", "main"),
        target_branch_name="main",
        source_branch_sha=source,
        source_branch_name="feature",
        title="merge request",
        project_url="",
        iid="0",
        mr_head_sha=merged,
    )
    resolved = gate._expected_review_base(merged, ci_env)
    assert resolved == _git(mr_repo, "merge-base", target, source)
    assert resolved == branch_point


def test_reviewed_base_derives_from_merge_base_not_ref_tip(
    mr_repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # GIVEN main has commits beyond the branch point (ref tip != merge-base)
    # WHEN the full lifecycle stamps an attestation
    # THEN the reviewed_base frontmatter field is the merge-base SHA, not the
    #      ref tip (G8 — the writer derives reviewed_base from git merge-base)
    _commit(mr_repo, "pkg/feature.py", "value = 1\n")
    # Advance main so the ref tip diverges from the merge-base
    _git(mr_repo, "checkout", "-q", "main")
    _commit(mr_repo, "pkg/main_only.py", "m = 1\n")
    _git(mr_repo, "checkout", "-q", "feature")
    _stamp(mr_repo, base="main")

    mb = _git(mr_repo, "merge-base", "main", "HEAD")
    ref_tip = _git(mr_repo, "rev-parse", "main")
    written = (mr_repo / "attestations" / "mr-1.md").read_text()
    frontmatter = yaml.safe_load(written.split("---\n", 2)[1])

    assert frontmatter["attestation"]["reviewed_base"] == mb, (
        f"reviewed_base must be the merge-base ({mb}), not the ref tip ({ref_tip})"
    )
    assert frontmatter["attestation"]["reviewed_base"] != ref_tip, (
        "reviewed_base must not be the ref tip"
    )


def test_cumulative_findings_reflect_multi_round_history(
    mr_repo: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # GIVEN a reviewer recorded two rounds (NEEDS_FIX then APPROVE)
    # WHEN the attestation writer computes cumulative_findings
    # THEN it reflects BOTH rounds from the cache, not just the last one (C08)
    from merge_check.planner import record_verdict

    _commit(mr_repo, "pkg/feature.py", "value = 1\n")
    droids_dir = mr_repo / ".factory" / "droids"
    cache_path = _cache(mr_repo)
    changed = diff_names("main")
    plan_request = PlanRequest(droids_dir=droids_dir, cache_path=cache_path, force_full=True)
    plan = build_plan(plan_request, changed)
    head = current_head()

    # Round 1: python-reviewer returns NEEDS_FIX
    record_verdict(
        plan_request, changed,
        reviewer="python-reviewer",
        fingerprint=plan["fingerprints"]["python-reviewer"],
        verdict=Verdict.NEEDS_FIX,
        head=head,
        tool_use_count=3,
        dispatch_started_at="2026-01-01T00:00:00Z",
    )
    # Round 2: python-reviewer returns APPROVE after fixes
    record_verdict(
        plan_request, changed,
        reviewer="python-reviewer",
        fingerprint=plan["fingerprints"]["python-reviewer"],
        verdict=Verdict.APPROVE,
        head=head,
        tool_use_count=5,
        dispatch_started_at="2026-01-01T00:01:00Z",
    )
    # Record security-reviewer APPROVE (the always-floor)
    for rev in plan["run"]:
        if rev == "python-reviewer":
            continue
        record_verdict(
            plan_request, changed,
            reviewer=rev,
            fingerprint=plan["fingerprints"][rev],
            verdict=Verdict.APPROVE,
            head=head,
            tool_use_count=5,
            dispatch_started_at="2026-01-01T00:00:00Z",
        )

    write_attestation(
        AttestationRequest(
            out_path="attestations/mr-1.md",
            base="main",
            droids_dir=str(droids_dir),
            force_full=True,
        ),
        "# /merge-check report",
        cache_path=cache_path,
        root=mr_repo,
        generated_at="2026-01-01T00:00:00Z",
    )

    written = (mr_repo / "attestations" / "mr-1.md").read_text()
    frontmatter = yaml.safe_load(written.split("---\n", 2)[1])
    cumulative = frontmatter["attestation"]["cumulative_findings"]
    # python-reviewer has 2 rounds: 1 NEEDS_FIX + 1 APPROVE
    assert cumulative["python-reviewer"]["rounds"] == 2, (
        f"expected 2 rounds for python-reviewer, got {cumulative['python-reviewer']}"
    )
    assert cumulative["python-reviewer"]["by_verdict"] == {
        "NEEDS_FIX": 1,
        "APPROVE": 1,
    }, f"unexpected by_verdict: {cumulative['python-reviewer']['by_verdict']}"
