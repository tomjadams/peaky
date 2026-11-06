"""Unit tests for atomic JSON persistence and the advisory file lock."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from merge_check.core.jsonio import file_lock, read_json_object, write_json_atomic
from merge_check.errors import MergeCheckError


class TestWriteJsonAtomic:
    def test_roundtrips_and_leaves_no_temp_siblings(self, tmp_path: Path) -> None:
        # GIVEN a payload written atomically
        # WHEN reading the canonical path back
        # THEN it equals the payload and no .tmp siblings remain
        target = tmp_path / "nested" / "cache.json"
        payload = {"schema_version": 1, "entries": {"a": {"fingerprint": "fp"}}}
        write_json_atomic(target, payload)
        assert json.loads(target.read_text()) == payload
        assert list(target.parent.glob(target.name + ".tmp.*")) == []


class TestReadJsonObject:
    def test_reads_a_json_object(self, tmp_path: Path) -> None:
        # GIVEN a file containing a JSON object
        # WHEN reading it
        # THEN the object is returned
        path = tmp_path / "c.json"
        path.write_text('{"k": 1}')
        assert read_json_object(path) == {"k": 1}

    def test_rejects_non_object_json(self, tmp_path: Path) -> None:
        # GIVEN a file containing a JSON array
        # WHEN reading it as an object
        # THEN it fails closed
        path = tmp_path / "c.json"
        path.write_text("[1, 2, 3]")
        with pytest.raises(MergeCheckError, match="JSON object"):
            read_json_object(path)

    def test_rejects_malformed_json(self, tmp_path: Path) -> None:
        # GIVEN a file containing invalid JSON
        # WHEN reading it
        # THEN it fails closed rather than returning a default
        path = tmp_path / "c.json"
        path.write_text("{not json")
        with pytest.raises(MergeCheckError, match="cannot read JSON"):
            read_json_object(path)

    def test_missing_file_fails_closed_with_io_diagnostic(self, tmp_path: Path) -> None:
        # GIVEN a path that does not exist (read attempt triggers ``OSError``)
        # WHEN reading it
        # THEN it fails closed with a diagnostic that names the path (so the
        #      OSError branch in ``read_json_object`` is exercised, not just the
        #      JSONDecodeError branch)
        missing = tmp_path / "absent.json"
        with pytest.raises(MergeCheckError, match="cannot read JSON"):
            read_json_object(missing)


class TestFileLock:
    def test_lock_can_be_reacquired_after_release(self, tmp_path: Path) -> None:
        # GIVEN a target whose lock is taken and released
        # WHEN taking it again in a later block
        # THEN it can be acquired (the lock released cleanly)
        target = tmp_path / "cache.json"
        with file_lock(target):
            pass
        with file_lock(target):
            assert (tmp_path / "cache.json.lock").exists()
