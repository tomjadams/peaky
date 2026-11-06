"""Shared literals used across more than one merge_check module.

Anything consumed by humans or downstream code as a key — frontmatter markers,
config keys, verdict tokens, cache schema versions — lives here once, so a rename
is a single edit and a typo cannot drift two copies apart.
"""

from __future__ import annotations

# --- Markdown frontmatter --------------------------------------------------
FRONTMATTER_BOUNDARY = "---"
MERGE_CHECK_KEY = "merge_check"
KEY_TRIGGERS = "triggers"
KEY_ALWAYS = "always"

# A droid whose filename stem ends with this suffix is an outcome/verifier-role
# reviewer, recognised by convention rather than a frontmatter key.
VERIFIER_NAME_SUFFIX = "verifier"

# --- Config (.factory/merge-check.yml) -------------------------------------
DEFAULT_CONFIG_PATH = ".factory/merge-check.yml"
KEY_SCHEMA_VERSION = "schema_version"
KEY_DROIDS_DIR = "droids_dir"
KEY_ATTESTATION_DIR = "attestation_dir"
KEY_TEST = "test"
# The server-side policy subtree, read by the CI gate from the target branch (never
# the client). Everything the gate reads lives under this one key — today
# `attestation_exempt`, tomorrow e.g. a reviewer-label override — so the client can
# recognise-and-ignore the whole subtree without enumerating each gate-only key, and
# adding gate policy never touches the client loader. Declared here only so
# load_config's unknown-key rejection tolerates it.
KEY_GATE = "gate"
DEFAULT_DROIDS_DIR = ".factory/droids"
DEFAULT_ATTESTATION_DIR = "attestations"
CONFIG_SCHEMA_VERSION = 1

# --- Incremental-review cache ----------------------------------------------
DEFAULT_CACHE_PATH = ".factory/merge-check-cache.json"
# V2: cache entries keyed by branch scope; entries carry tool_use_count + force_full.
# Old V1 caches are rejected on read — clear with: rm .factory/merge-check-cache.json
CACHE_SCHEMA_VERSION = 2

# Cache-entry keys added in V2 (G1).
KEY_TOOL_USE_COUNT = "tool_use_count"
KEY_ENTRY_FORCE_FULL = "force_full"

# Top-level cache scope key added in V2 (G0).
KEY_BRANCH = "branch"

# Branch-scope classification-done flag (G3).
KEY_CLASSIFY_DONE = "classify_done"
KEY_CLASSIFY_SKIP_REASON = "classify_skip_reason"

# Per-reviewer cumulative findings, written by the attestation writer from the
# branch cache so META_JSON adversarial_counts cannot be used for cumulative.
KEY_CUMULATIVE_FINDINGS = "cumulative_findings"

DEFAULT_RUNS_DIR = ".factory/merge-check-runs"

# Default base ref when the caller does not specify one (CI gates can override).
DEFAULT_BASE = "main"

# --- Verdict tokens (also the attestation enum) ----------------------------
VERDICT_APPROVE = "APPROVE"
VERDICT_NEEDS_FIX = "NEEDS_FIX"
VERDICT_BLOCK = "BLOCK"

# --- Discrimination-sensor JSON spec ---------------------------------------
# Wire keys for the JSON read on the sensor's stdin. Centralised so the
# parser and the documenting dataclass cannot drift from the on-disk shape.
KEY_SPEC_TEST_CMD = "test_cmd"
KEY_SPEC_MUTATIONS = "mutations"
KEY_SPEC_FILE = "file"
KEY_SPEC_FIND = "find"
KEY_SPEC_REPLACE = "replace"
KEY_SPEC_RATIONALE = "rationale"
KEY_SPEC_BASE_REF = "base_ref"
KEY_SPEC_TIMEOUT = "timeout"
KEY_SPEC_LINK = "link"

# --- Plan wire format ------------------------------------------------------
# Keys the planner TypedDict :data:`Plan` and the attestation writer share.
# Defining them here keeps the dictionary shape and the access sites
# synchronised — rename one and a literal reference cannot silently keep the
# old name.
KEY_PLAN_FINGERPRINTS = "fingerprints"
KEY_PLAN_RELEVANT_FILES = "relevant_files"

# --- Attestation frontmatter contract --------------------------------------
# Shared by the writer (merge_check.attestation) and the fast-path reader
# (merge_check.planner) so the two ends of the contract cannot drift apart.
ATTESTATION_ROOT_KEY = "attestation"
KEY_COMMIT_SHA = "commit_sha"
# The merge-base the reviewers diffed against — the start of the reviewed surface.
# The CI gate checks this covers the MR's full diff (anti-narrowed-base forgery).
KEY_REVIEWED_BASE = "reviewed_base"

# Changed-file paths under this prefix are attestations, not reviewable source.
ATTESTATION_PREFIX = "attestations/"
