## Why

The `low` severity level provides no actionable differentiation in improvement plans and readiness reviews. When a question is worth tracking, it belongs in `medium`, `high`, or `critical`. The `low` bucket leads template authors to under-classify questions instead of deciding whether they belong in the template at all.

## What Changes

- Remove `low` from the `RiskLevel` enum in schema, model, and template authoring UI.
- Add SQLite migration `0011` to promote existing `low` values to `medium` via table recreation pattern.
- Update migration tests with CHECK constraint assertions and data promotion test.

## Capabilities

### Modified Capabilities

- `templates`: Template question severity no longer supports `low`; existing low-severity data is migrated to `medium` during the `0011_remove_low_severity` migration.
