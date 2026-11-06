# Python Review Context

## Scope

Python is used only by the CI automation toolkit in `scripts/ci/`. Review it as
shared governance infrastructure maintained by contributors who may not use
Python routinely.

## Project invariants

- Features implement `Feature`, declare `RUNS_ON`, and return a
  `FeatureResult`.
- Features are pure readers that return `AddLabel`, `RemoveLabel`, `SetTitle`,
  `PostComment`, or `AssignUser` actions. The dispatcher applies all actions
  serially only after concurrent feature execution completes.
- Feature failures are collected rather than aborting other checks. Results are
  reported through JUnit XML and one idempotently updated MR comment.
- GitLab access goes through `GitLabClient`; features do not instantiate their
  own external clients or read environment variables directly.
- The dispatcher uses `ThreadPoolExecutor`. Shared client caches are
  lock-protected, network I/O occurs outside cache locks, and new shared state
  requires a concurrent-access test.
- User-facing adapter failures are translated to `CiAutomationError` with the
  original exception chained.

## Project conventions

- Environment parsing belongs in `ci_automation/env.py`; configuration and
  models use strict Pydantic validation.
- Feature modules register themselves under
  `ci_automation/features/<name>.py`; discovery imports the registry
  automatically.
- Consumer-facing APIs and CLI entry points use Numpy-style docstrings with
  applicable `Parameters`, `Returns`, `Raises`, and runnable `Examples`.
  Public orchestration entry points also document their call stack in an ASCII
  `Notes` diagram.
- Tests use `FeatureTestHarness` and GitLab test doubles, with no I/O.

## Deterministic coverage

`scripts/ci/pyproject.toml` configures Ruff (including import order,
100-character lines, complexity 10, security, performance, and Numpy
docstrings), strict mypy for Python 3.12, and pytest. Do not repeat these
mechanical findings unless configuration itself changes.

Run `make check` from `scripts/ci/`.

## References

- `scripts/ci/README.md`
- `scripts/ci/pyproject.toml`
- `scripts/ci/ci_automation/app.py`
- `scripts/ci/tests/helpers.py`
- `scripts/ci/tests/unit/test_gitlab_client.py`
