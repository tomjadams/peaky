"""Unit tests for the incremental-review cache persistence layer."""

from __future__ import annotations

import json
import threading
from pathlib import Path

import pytest

from merge_check.errors import MergeCheckError
from merge_check.persistence import (
    KEY_ENTRIES,
    cache_transaction,
    read_cache,
    status_report,
    write_cache,
)


class TestReadCache:
    def test_missing_file_yields_empty_skeleton(self, tmp_path: Path) -> None:
        # GIVEN no cache file
        # WHEN reading it
        # THEN an empty, schema-versioned V2 skeleton is returned
        from merge_check.constants import CACHE_SCHEMA_VERSION
        cache = read_cache(tmp_path / "missing.json")
        assert cache["schema_version"] == CACHE_SCHEMA_VERSION
        assert cache["entries"] == {}
        assert cache["rounds"] == []
        assert cache["branch"] == ""

    def test_rejects_wrong_schema_version(self, tmp_path: Path) -> None:
        # GIVEN a cache with an unexpected schema version (too high)
        # WHEN reading it
        # THEN it fails closed
        path = tmp_path / "cache.json"
        path.write_text(json.dumps({"schema_version": 99, "entries": {}}))
        with pytest.raises(MergeCheckError, match="schema_version must be"):
            read_cache(path)

    def test_rejects_v1_cache_with_migration_hint(self, tmp_path: Path) -> None:
        # GIVEN a V1 cache (schema_version: 1, the old format)
        # WHEN reading it
        # THEN it fails closed with a helpful migration message (G0 schema bump)
        path = tmp_path / "cache.json"
        path.write_text(json.dumps({"schema_version": 1, "entries": {}}))
        with pytest.raises(MergeCheckError, match="schema_version 1"):
            read_cache(path)

    def test_rejects_entries_that_are_not_object(self, tmp_path: Path) -> None:
        # GIVEN a cache whose `entries` field is not a JSON object (it carries a list)
        # WHEN reading it
        # THEN it fails closed so a corrupt cache cannot silently masquerade as empty
        from merge_check.constants import CACHE_SCHEMA_VERSION
        path = tmp_path / "cache.json"
        path.write_text(json.dumps({"schema_version": CACHE_SCHEMA_VERSION, "entries": []}))
        with pytest.raises(MergeCheckError, match="entries must be an object"):
            read_cache(path)


class TestWriteCache:
    def test_write_then_read_roundtrips(self, tmp_path: Path) -> None:
        # GIVEN a V2 cache object persisted via the write capability
        # WHEN reading it back
        # THEN the persisted entries survive the roundtrip
        from merge_check.constants import CACHE_SCHEMA_VERSION
        path = tmp_path / "cache.json"
        payload = {
            "schema_version": CACHE_SCHEMA_VERSION,
            "branch": "main",
            "entries": {"security-reviewer": {"fingerprint": "fp"}},
        }
        write_cache(path, payload)
        assert read_cache(path)[KEY_ENTRIES] == {"security-reviewer": {"fingerprint": "fp"}}


class TestCacheTransaction:
    def test_serialises_a_read_modify_write(self, tmp_path: Path) -> None:
        # GIVEN the cache transaction (both locks)
        # WHEN reading, modifying, and writing inside it
        # THEN the change is persisted and the lock releases cleanly for the next caller
        path = tmp_path / "cache.json"
        with cache_transaction(path):
            cache = read_cache(path)
            cache[KEY_ENTRIES]["a"] = {"fingerprint": "fp-a"}
            write_cache(path, cache)
        with cache_transaction(path):  # reacquire to prove it released
            assert read_cache(path)[KEY_ENTRIES]["a"] == {"fingerprint": "fp-a"}

    def test_concurrent_threads_round_trip_without_lost_updates(self, tmp_path: Path) -> None:
        # GIVEN two threads racing through cache_transaction with disjoint keys
        # WHEN both complete
        # THEN both entries survive (no lost updates) and the run finishes without deadlock
        path = tmp_path / "cache.json"
        errors: list[BaseException] = []

        def add_entry(name: str) -> None:
            try:
                with cache_transaction(path):
                    cache = read_cache(path)
                    cache[KEY_ENTRIES][name] = {"fingerprint": f"fp-{name}"}
                    write_cache(path, cache)
            except BaseException as exc:
                errors.append(exc)

        t_a = threading.Thread(target=add_entry, args=("a",))
        t_b = threading.Thread(target=add_entry, args=("b",))
        t_a.start()
        t_b.start()
        t_a.join(timeout=10)
        t_b.join(timeout=10)
        assert not (t_a.is_alive() or t_b.is_alive()), "threads deadlocked"
        assert errors == [], f"concurrent writers raised: {errors}"
        # Both writes landed; the cross-process file_lock plus the in-process
        # threading.Lock ensure the read-modify-write never drops a key.
        assert sorted(read_cache(path)[KEY_ENTRIES].keys()) == ["a", "b"]


class TestStatusReport:
    def test_empty_cache_reports_no_timings(self, tmp_path: Path) -> None:
        # GIVEN no cache file yet (empty skeleton)
        # WHEN rendering the status report
        # THEN it reports the cache is empty rather than erroring
        assert status_report(tmp_path / "missing.json") == [
            "merge-check cache is empty (no recorded timings yet)."
        ]

    def test_stale_entry_is_flagged_with_timing_and_slice(self, tmp_path: Path) -> None:
        # GIVEN a V2 cache with one entry recorded far in the past
        # WHEN rendering the status report with a 7-day stale threshold
        # THEN the entry is flagged stale and its timing and slice size are reported
        from merge_check.constants import CACHE_SCHEMA_VERSION
        path = tmp_path / "cache.json"
        path.write_text(
            json.dumps(
                {
                    "schema_version": CACHE_SCHEMA_VERSION,
                    "branch": "main",
                    "entries": {
                        "security-reviewer": {
                            "fingerprint": "fp",
                            "verdict": "APPROVE",
                            "recorded_at": "2000-01-01T00:00:00Z",
                            "reviewed_files": ["a.py", "b.py"],
                            "timing": {"elapsed_s": 12.5},
                        }
                    },
                }
            )
        )
        report = "\n".join(status_report(path, stale_days=7))
        assert "1 entries" in report
        assert "stale (>7 days): 1" in report
        assert "12.5s  security-reviewer" in report
        assert "2 files  security-reviewer" in report
