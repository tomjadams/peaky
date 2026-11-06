# Python Test Review Context

## Scope

Review only the Python CI automation toolkit in `scripts/ci/`. Its test suite is
`scripts/ci/tests/`, discovered as `test_*.py` under the configured `tests`
root. These are unit tests with doubles and must not perform network or other
real I/O.

## Project invariants and risk matrices

The following are mandatory Peaky toolkit invariants, not examples:

| Changed behavior | Mandatory coverage |
| --- | --- |
| Feature enablement | Missing blocks, missing `enabled`, explicit booleans, and truthy non-booleans such as `1` or `"true"` |
| Collections and dispatch | Empty input as well as populated input |
| Configuration loading | Valid, missing, null, and invalid configuration |
| GitLab adapter errors | `GitlabError` is translated to `CiAutomationError` |
| Environment loading | Explicit environment mapping, missing values, and invalid values |
| Feature execution | Observable `FeatureResult`, actions, notes, and pass/fail detail |

Every new production branch needs a matching edge case. Features are pure:
tests assert returned actions rather than internal GitLab client call order.

## Project conventions

- Every test body contains `# GIVEN`, `# WHEN`, and `# THEN` comments.
- Test names describe observable behavior. Names containing implementation
  verbs such as `calls_`, `loops_`, `invokes_`, `uses_`, or `initializes_` are
  not accepted.
- Use `tests/helpers.py::FeatureTestHarness` for feature tests. Prefer its exact
  action-multiset and result helpers (`assert_actions`, `assert_no_actions`,
  `assert_passed`, `assert_failed`, and note helpers) over collaborator-call
  assertions.
- Use `tests/helpers.py::make_diff_change` for raw GitLab diff payloads.
- Shared fixtures live in `tests/conftest.py`. A helper or fixture should serve
  at least three tests unless it injects a test double.
- Consolidate cases that share setup and expected behavior with cohesive
  assertions or `pytest.mark.parametrize`.
- Assert exact values when known. Substring assertions are reserved for
  inherently variable output.
- Ruff owns import sorting, unused imports, line length (100), and basic
  undefined-name checks. Test files intentionally ignore `S101`, `S105`,
  `S106`, `S311`, and `S314`.

## Deterministic coverage

- Do not read `os.environ` directly in tests. Pass an explicit mapping or use
  `monkeypatch`.
- Do not use the real clock (`datetime.now`, `datetime.utcnow`, or equivalent)
  or the `random` module.
- Unit tests must not make real GitLab API calls or filesystem writes outside
  pytest-managed temporary paths.
- Run from `scripts/ci/`: `uv sync --extra dev && make check`. This executes
  `uv run pytest -v`, `uv run ruff check .`, and
  `uv run mypy ci_automation`.
- CI runs that same `make check` gate when `scripts/ci/**/*`,
  `.gitlab/ci-automation.yaml`, or `.gitlab-ci.yml` changes.

## References

- `scripts/ci/pyproject.toml`
- `scripts/ci/Makefile`
- `scripts/ci/README.md`
- `scripts/ci/tests/conftest.py`
- `scripts/ci/tests/helpers.py`
- `scripts/ci/tests/unit/test_config.py`
- `.gitlab-ci.yml`
