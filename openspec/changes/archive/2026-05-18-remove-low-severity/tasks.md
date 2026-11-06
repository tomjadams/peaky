# Tasks: remove-low-severity

## 1. Schema, model, and validation

- [x] 1.1 Remove `"low"` from `riskLevel` array in `shared/db/schema/template.ts`
- [x] 1.2 Remove `"low"` from `riskLevel` enum in `shared/db/schema/local.ts`
- [x] 1.3 Remove `"low"` from `RiskLevel` type in `app/models/template.ts`
- [x] 1.4 Remove "Low" option from `RiskLevelDropdown.vue` in template-studio
- [x] 1.5 Remove `low` entry from `RISK_LEVEL_CONFIG` in `RulesQuestionSidebar.vue`
- [x] 1.6 Remove `low` entry from `RISK_LEVEL_CONFIG` in `RuleSetNode.vue`; change fallback from `"low"` to `"medium"`

## 2. SQLite migration

- [x] 2.1 Add `shared/db/migrations/sqlite/0011_remove_low_severity.sql`
- [x] 2.2 Register migration in `shared/db/migrations/index.ts`
- [x] 2.3 Embed migration SQL in `shared/db/migrations/sqlite-content.ts`

## 3. Tests

- [x] 3.1 Extend `tests/integration/migrations.test.ts`:
  - Add `0011_remove_low_severity` to migration ID list assertions
  - Add CHECK constraint tests for both question tables
  - Add data promotion test (low rows become medium)

## 4. Documentation

- [x] 4.1 Add "Removed low risk severity level" section to `site/docs/changelog.md`
- [x] 4.2 Add `remove-low-severity` row to `site/docs/development/decisions.md`
