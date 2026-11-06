"""Immutable environment snapshot for the merge_check library.

Library code must never read :data:`os.environ` directly — that pulls a global
mutable into a hot path, makes tests non-deterministic, and hides the contract
between the CLI adapter and the call sites that need particular env keys. This
module owns that contract: the CLI adapter builds an :class:`Env` from
``os.environ`` once and threads it into every consumer, every consumer declares
the keys it needs in its type sig, and tests construct an :class:`Env` from a
plain mapping.

The dataclass is frozen so a refactor cannot accidentally mutate the snapshot
mid-pipeline. New env keys belong here, not at the call site.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

# The single escape hatch for the MR-IID resolver; declared here so the field's
# string key lives next to its consumer.
MR_IID_ENV = "MERGE_CHECK_MR_IID"


@dataclass(frozen=True)
class Env:
    """Parsed environment snapshot passed to library functions.

    Parameters
    ----------
    mr_iid_override : str | None
        Value of :data:`MR_IID_ENV` (``MERGE_CHECK_MR_IID``); ``None`` when
        unset. The CLI uses this to skip ``glab`` lookup.
    data : Mapping[str, str]
        The full environment mapping the snapshot was built from. Exposed so
        consumers that have not (yet) declared a typed field can still read
        non-modelled keys (e.g. ``PATH``) without bypassing the Env contract.
        Treat as read-only.
    """

    mr_iid_override: str | None
    data: Mapping[str, str]

    def get(self, key: str) -> str | None:
        """Return ``data[key]`` or ``None`` when unset.

        Parameters
        ----------
        key : str
            Environment variable name.

        Returns
        -------
        str | None
            The variable value, or ``None`` when unset.

        Examples
        --------
        >>> env = env_from_mapping({"PATH": "/bin"})
        >>> env.get("PATH")
        '/bin'
        >>> env.get("MISSING") is None
        True
        """
        return self.data.get(key)


def env_from_mapping(data: Mapping[str, str]) -> Env:
    """Build an :class:`Env` snapshot from a mapping.

    Parameters
    ----------
    data : Mapping[str, str]
        The environment mapping to snapshot (typically ``os.environ``).

    Returns
    -------
    Env
        The parsed snapshot, with typed fields populated and ``data`` exposed
        for unmodelled reads.
    """
    return Env(mr_iid_override=data.get(MR_IID_ENV) or None, data=data)


def env_from_environ() -> Env:
    """Build an :class:`Env` snapshot from the live process environment.

    The only place in the library that is permitted to call :func:`os.environ`.
    The CLI adapter calls this once at startup and threads the snapshot into
    every consumer.

    Examples
    --------
    >>> env = env_from_environ()  # doctest: +SKIP
    >>> env.get("PATH")  # doctest: +SKIP
    '/usr/local/bin:...'
    """
    return env_from_mapping(os.environ)
