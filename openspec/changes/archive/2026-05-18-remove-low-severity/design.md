## Decision: low → medium (not low → null)

Promoting `low` to `medium` was chosen over setting it to `null` because:

- Null severity would require conditional rendering in every consumer (projection, filtering, sorting, display, template authoring)
- `medium` is the correct semantic equivalent: "this needs attention but is lower priority"
- The plan model intentionally does not support null severity to keep types simple

## Decision: Table recreation pattern for SQLite migration

SQLite cannot `ALTER COLUMN` to change a CHECK constraint. The migration recreates `template_questions` and `template_draft_questions` with the new CHECK constraint, copies data with `CASE WHEN risk_level = 'low' THEN 'medium' ELSE risk_level END`, drops the old tables, and renames the new ones. All foreign keys and indexes are preserved.

## Decision: Schema change and migration land together

The schema change (removing `"low"` from the Drizzle enum) and the migration must be in the same deployment. If the schema change lands without the migration, local-first clients with stale CHECK constraints would reject writes for any existing `low`-severity questions.
