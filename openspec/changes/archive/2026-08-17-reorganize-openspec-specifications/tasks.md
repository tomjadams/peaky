## Prerequisites

> Issue: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/work_items/22>
> MR: <https://gitlab.is.adyen.com/containers/rtf/peaky/-/merge_requests/294>

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Use the existing RFC-style GitLab work item describing the spec landscape and cleanup approach
- [x] 0.3 Create feature branch `22-openspec-spec-cleanup`
- [x] 0.4 Create MR from the feature branch using the server-side default template and link work item #22

## 1. Transfer CI Automation Ownership

> Can proceed in parallel in `/Users/heitorl/DEV/ci-automation`.

- [x] 1.1 Create `docs/adopt-openspec` from the CI Automation repository's `origin/main`
- [x] 1.2 Establish target-native `rtf-workflow` configuration and schema
- [x] 1.3 Extract current CI Automation bounded contexts into valid live specs
- [x] 1.4 Copy and reconcile Peaky's live CI Automation requirements in the target repository (ci-automation REQ-001–REQ-010)
- [x] 1.5 Copy the complete `2026-06-23-ci-automation-event-actions` archive and migrate its schema metadata to `rtf-workflow`
- [x] 1.6 Strictly validate the target specs and run its relevant docs and quality checks
- [x] 1.7 Only after 1.1–1.6 pass, remove the Peaky `ci-automation` live spec and migrated archive (ci-automation REQ-001–REQ-010)

## 2. Remove Invalid Capability Stubs

- [x] 2.1 Delete `branding`; retain visual-design ownership in `DESIGN.md` and `site/docs`
- [x] 2.2 Delete `checklist-questions`; retain normalized runtime behavior in Assessment and authoring behavior in Template Studio
- [x] 2.3 Delete `documentation`; retain documentation ownership in `site/docs`
- [x] 2.4 Delete `scoring-rules` while keeping `maturity-score` as the future weighted-readiness capability
- [x] 2.5 Confirm no active change delta targets a deleted stub

## 3. Extract Maintained Product Capabilities

- [x] 3.1 Create the live `recent-changes` spec for review-scoped history and current/history separation (recent-changes REQ-001–REQ-002, AC-001–AC-004)
- [x] 3.2 Specify burst grouping and answer-type-aware diffs (recent-changes REQ-003–REQ-004, AC-005–AC-009)
- [x] 3.3 Specify enrichment, overridden status, reactive refresh, pagination, and bounded-retention semantics (recent-changes REQ-005–REQ-008, AC-010–AC-017)
- [x] 3.4 Create the live `system-diagnostics` spec for access, status, activity, recovery, education, and security exclusions (system-diagnostics REQ-001–REQ-006, AC-001–AC-014)
- [x] 3.5 Remove the six moved `/system` requirements from `local-first` after preserving their behavior in `system-diagnostics` (local-first REQ-001–REQ-006)

## 4. Normalize Hidden Delta Sections

- [x] 4.1 Collapse Assessment's extra delta and Question Types headings into its single `## Requirements` section
- [x] 4.2 Consolidate duplicate checklist runtime requirements around the canonical `{ checked, na }` answer shape and current text/count limits
- [x] 4.3 Collapse Template Studio's extra delta headings into its single `## Requirements` section
- [x] 4.4 Preserve local-first draft authoring, structured collaboration, import/export, question-type, and checklist-editor requirements as parser-visible requirements
- [x] 4.5 Remove stale no-op API wording, retired Low severity, and contradictory publish-authority text without changing runtime behavior
- [x] 4.6 Confirm OpenSpec reports every normalized Assessment and Template Studio requirement

## 5. Correct Capability Ownership

- [x] 5.1 Move product plan and exact product-rollup behavior from Products to Improvement Plans (improvement-plans REQ-001–REQ-002, AC-001–AC-005; products REQ-001–REQ-002)
- [x] 5.2 Remove Nitro mock API, generic remote fetching, and spec-process requirements from Common UI (common-ui REQ-001–REQ-003)
- [x] 5.3 Remove retired visual-regression requirements and update maintained Make targets (testing REQ-001–REQ-004, AC-001–AC-004)
- [x] 5.4 Preserve `maturity-score` and document current rules as transitional to the planned weighted system

## 6. Reconcile Current Architecture

- [x] 6.1 Add sync push authorization requirements (authorization REQ-001, AC-001–AC-003)
- [x] 6.2 Add query-level pull authorization and fail-closed empty scope (authorization REQ-002, AC-004–AC-005)
- [x] 6.3 Add entitlement-derived SSE subscription authorization (authorization REQ-003, AC-006–AC-007)
- [x] 6.4 Update stale Purpose and prototype wording in Authorization and Auditing against the canonical threat model
- [x] 6.5 Remove false application review-ownership claims while preserving implemented compatibility routes
- [x] 6.6 Reconcile Teams, Products, Reviews, Templates, and Template Studio wording with the canonical subject and local-first models
- [x] 6.7 Leave Sync Engine requirement headers targeted by active changes untouched; record the required archive ordering

## 7. Enforce OpenSpec Validation

- [x] 7.1 Add a Make target for strict live-spec validation
- [x] 7.2 Enumerate active changes and strictly validate each by name because bulk custom-workflow discovery currently returns zero changes
- [x] 7.3 Include the validation target in the repository quality gate
- [x] 7.4 Run strict validation and confirm there are no zero-requirement live capability stubs

## 8. Documentation

- [x] 8.1 Update `site/docs/development/decisions.md` with capability ownership, CI Automation transfer, Maturity Score retention, and active-change sequencing
- [x] 8.2 Correct retired `layout` and `backend` domain guidance
- [x] 8.3 Update `site/docs/development/changelog.md`
- [x] 8.4 Keep `DESIGN.md` Recent Changes terminology aligned with bounded operational history rather than permanent audit evidence

## 9. CodeRabbit Review

- [x] 9.1 Correct factual quality-gate, testing-layer, navigation, and retained-history documentation drift
- [x] 9.2 Clarify checklist N/A, event-status lifecycle, retention, subject-route, and template-version contracts
- [x] 9.3 Harden active-change enumeration so OpenSpec or `jq` failures cannot pass the quality gate
- [x] 9.4 Validate the fixes and classify every CodeRabbit thread before the bounded review loop ends

## Housekeeping

- [x] Run `openspec validate reorganize-openspec-specifications --type change --strict`
- [x] Run `make mr` and fix all in-scope failures
- [x] Update the GitLab work item with task completion status

## Manual tasks

- [x] Review the resulting capability list for discoverability and bounded-context cohesion
- [x] Confirm CI Automation's target copy is usable before Peaky's source copy is removed
- [x] Confirm Maturity Score remains discoverable as the future weighted-readiness capability
