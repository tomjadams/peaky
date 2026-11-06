"""Parse YAML frontmatter out of a Markdown file.

Reviewer droids and attestations both carry a ``---``-fenced YAML frontmatter
block. Historically three modules each hand-rolled a partial YAML parser to avoid
a dependency; this module replaces all of them with one PyYAML-backed reader, so
quoting, nesting, block-style lists, and scalar typing behave the same everywhere
and a single fix covers every caller.
"""

from __future__ import annotations

from typing import Any

import yaml

from merge_check.constants import FRONTMATTER_BOUNDARY
from merge_check.errors import MergeCheckError


def _extract_block(text: str) -> str | None:
    """Return the YAML between the first two ``---`` fences, or ``None``.

    Parameters
    ----------
    text : str
        Full Markdown file contents.

    Returns
    -------
    str | None
        The frontmatter body, or ``None`` when the file does not open with a
        fence or the closing fence is missing.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != FRONTMATTER_BOUNDARY:
        return None
    for end in range(1, len(lines)):
        if lines[end].strip() == FRONTMATTER_BOUNDARY:
            return "\n".join(lines[1:end])
    return None


def parse_frontmatter(text: str) -> dict[str, Any]:
    """Parse a Markdown file's frontmatter into a mapping.

    Parameters
    ----------
    text : str
        Full Markdown file contents.

    Returns
    -------
    dict[str, Any]
        The parsed frontmatter, or an empty mapping when the file carries no
        complete frontmatter block (the file simply never auto-routes).

    Raises
    ------
    MergeCheckError
        When the frontmatter is present but not valid YAML, or parses to
        something other than a mapping. Fail-closed: malformed metadata must be a
        loud error, never a silently dormant droid or a skipped attestation check.

    Examples
    --------
    >>> parse_frontmatter("---\\nname: go-reviewer\\n---\\n")["name"]
    'go-reviewer'
    >>> parse_frontmatter("# no frontmatter\\n")
    {}
    """
    block = _extract_block(text)
    if block is None:
        return {}
    try:
        parsed = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        raise MergeCheckError(f"invalid YAML in frontmatter: {exc}") from exc
    if parsed is None:
        return {}
    if not isinstance(parsed, dict):
        raise MergeCheckError(f"frontmatter must be a mapping, got {type(parsed).__name__}")
    # ``yaml.safe_load`` silently keeps the *last* value when mapping keys repeat;
    # a duplicated key in a reviewer-droid or an attestation is almost always an
    # authoring error, not an intent to override, so fail loudly rather than
    # carrying the ambiguity into a fingerprint bound to a quiet mismatch.
    try:
        _stream = yaml.compose(block, Loader=yaml.SafeLoader)
    except yaml.YAMLError as exc:
        raise MergeCheckError(f"invalid YAML in frontmatter: {exc}") from exc
    if _stream is not None:
        duplicates = _collect_duplicate_keys(_stream)
        if duplicates:
            raise MergeCheckError(
                f"frontmatter has duplicate keys: {', '.join(sorted(duplicates))} "
                "(repeated mapping keys are never accepted; merge or rename them)"
            )
    return parsed


def _collect_duplicate_keys(node: Any) -> set[str]:
    """Walk a YAML node tree and return any mapping keys that appear more than once.

    Parameters
    ----------
    node : Any
        A :func:`yaml.compose` node (MappingNode / ScalarNode / SequenceNode).

    Returns
    -------
    set[str]
        The duplicated key names, if any. Empty when every key is unique.
    """
    if not isinstance(node, (yaml.MappingNode, yaml.SequenceNode)):
        return set()
    duplicates: set[str] = set()
    if isinstance(node, yaml.MappingNode):
        seen: set[str] = set()
        for key_node, value_node in node.value:
            if isinstance(key_node, yaml.ScalarNode):
                if key_node.value in seen:
                    duplicates.add(key_node.value)
                else:
                    seen.add(key_node.value)
            duplicates.update(_collect_duplicate_keys(value_node))
    else:  # SequenceNode
        for child_node in node.value:
            duplicates.update(_collect_duplicate_keys(child_node))
    return duplicates
