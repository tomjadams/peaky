"""Domain error type for the /merge-check toolkit.

Every public entry point translates lower-level library failures (``OSError``,
``yaml.YAMLError``, ``subprocess.CalledProcessError``, …) into a
:class:`MergeCheckError` so a caller never has to catch a third-party exception
to react to a merge-check failure. The CLI layer is the single place that turns a
:class:`MergeCheckError` into a stderr message plus a process exit code; the
library code raises and never calls :func:`sys.exit`. This keeps the library
importable and testable without a subprocess.
"""

from __future__ import annotations

# Fail-closed default: an unclassified merge-check failure exits non-zero so a
# gate never reads a crash as a pass.
DEFAULT_EXIT_CODE = 2
# A language whose sensor command is unconfigured is a skip, not a failure; the
# config CLI signals it with this distinct code so the orchestrator can record it.
SKIP_EXIT_CODE = 3


class MergeCheckError(Exception):
    """A /merge-check operation failed in a way the caller must surface.

    Parameters
    ----------
    message : str
        Human-readable, fail-closed explanation written to stderr by the CLI.
    exit_code : int, optional
        Process exit code the CLI should return. Defaults to
        :data:`DEFAULT_EXIT_CODE` (``2``).

    Examples
    --------
    >>> raise MergeCheckError("droids dir not found")  # doctest: +SKIP
    Traceback (most recent call last):
    merge_check.errors.MergeCheckError: droids dir not found
    """

    def __init__(self, message: str, *, exit_code: int = DEFAULT_EXIT_CODE) -> None:
        super().__init__(message)
        self.exit_code = exit_code


class SkipLanguageError(MergeCheckError):
    """A sensor language has no configured test command — skip it, do not fail.

    Carries :data:`SKIP_EXIT_CODE` (``3``) so the orchestrator records an explicit
    skip rather than treating the missing command as a failed gate.

    Parameters
    ----------
    reason : str
        Skip marker payload, e.g. ``"no-command-for-rs"``.
    """

    def __init__(self, reason: str) -> None:
        super().__init__(reason, exit_code=SKIP_EXIT_CODE)
        self.reason = reason
