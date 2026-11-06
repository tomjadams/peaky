<!-- PEAKY TASK GUIDELINES -->

<!-- For UI:
  - Reference Component Map from design.md for exact NuxtUI props
  - Load `nuxt-ui` skill for any task implementing NuxtUI components
  - Load `vue-flow` skill for any task implementing or improving a canvas functionality
-->

<!-- Adversarial Reviews - INLINE with each domain:

  After each task group that creates/modifies files in a domain, add:
  - [ ] X.Y Run `<domain>-reviewer` subagent on new/modified files
  - [ ] X.Z Address review findings (if any)

  Domain mapping:
  - TypeScript files (.ts) → ts-reviewer (frontend + backend)
  - Vue files (.vue) → vue-reviewer (structure, reactivity, extraction)
  - Vue files with styling → ui-review (semantic colors, visual design)
  - Test files (.test.ts, .spec.ts) → test-reviewer
  - User-facing features → ux-reviewer (run on feature-complete group)

  Example:
  ## 3. Vue Components
  - [ ] 3.1 Implement RuleSetEditor.vue
  - [ ] 3.2 Implement ConditionList.vue
  - [ ] 3.3 Run `vue-reviewer` on new components
  - [ ] 3.4 Run `ui-review` on new components (visual design check)
  - [ ] 3.5 Address review findings
-->

<!-- For all tasks:
  - Ensure we follow red/green/refactor approach where tests guide implementation
-->


<!-- MUST have task group -->
## Prerequisites

<!-- Gitlab issue URL once created -->
> Issue: https://gitlab.is.adyen.com/heitorl/orr/-/issues/19
<!-- Gitlab MR URL once created -->
> MR: https://gitlab.is.adyen.com/heitorl/orr/-/merge_requests/46

- [x] 0.1 Load `glab` skill before tackling any task with GitLab
- [x] 0.2 Create GitLab issue in a RFC style using `glab` CLI describing the problem and how we intend to approach this from `design.md`
- [x] 0.3 Create feature branch named after the proposed change
- [x] 0.4 Create MR using conventional commit + template .gitlab/merge_request_templates/default.md

## 1. Data Layer — Model & Backstage Mock Data

> dependencies: none (isolated)

- [x] 1.1 Update `app/models/product.ts` — add `origin: ProductOrigin`, `isExternal: boolean`, productManagerRef, engineeringLeadRef?, teamRefs, componentRefs, roadmapUrl?, documentationUrl?, supportChannel?
- [x] 1.2 Update `server/data/products.ts` — updated with new fields, seed data added (product-001 with realistic data)
- [x] 1.3 Mock Backstage data embedded in client-side composables (`useBackstageUserSearch.ts`, `useBackstageGroupSearch.ts`, `useBackstageComponentSearch.ts`) — no server data file needed
- [x] 1.4 Run `ts-reviewer` on new/modified data layer files
- [x] 1.5 Address review findings

## 2. API Layer — New & Updated Endpoints

> dependencies: 1 (Data Layer)

- [x] 2.1 Update `server/api/products/index.post.ts` — accepts origin, isExternal, productManagerRef, engineeringLeadRef, teamRefs, componentRefs, roadmapUrl, documentationUrl, supportChannel via zod schema
- [x] 2.2 Create `server/api/products/[id].patch.ts` — PATCH endpoint for partial product updates
- [x] 2.3 No `server/api/backstage/` routes needed — Backstage resolution is entirely client-side
- [x] 2.4 (see 2.3)
- [x] 2.5 (see 2.3)
- [x] 2.6 (see 2.3)
- [x] 2.7 (see 2.3)
- [x] 2.8 (see 2.3)
- [x] 2.9 Run `ts-reviewer` on new API files
- [x] 2.10 Address review findings

## 3. Composables — New

> dependencies: 2 (API Layer)

- [x] 3.1 Create `app/products/useProductCreation.ts` — form state and submission for create/edit
- [x] 3.2 Create `app/composables/useBackstageSearch.ts` (generic) + `useBackstageUserSearch.ts`, `useBackstageGroupSearch.ts`, `useBackstageComponentSearch.ts` (specific) — Nuxt auto-import, no barrel needed
- [x] 3.3 Entity resolution via `resolveBackstageUser` / group / component helpers in the specific composables; graceful degradation (raw ID fallback) implemented inline
- [x] 3.4 No barrel export needed — Nuxt auto-imports `app/composables/`
- [x] 3.5 Update `app/products/useProductFilters.ts` — origin filter (bespoke/open-source/vendor)
- [x] 3.6 Run `ts-reviewer` on new composable files
- [x] 3.7 Address review findings

## 4. UI — Product Creation Page

> dependencies: 2, 3 (API Layer, Composables)

- [x] 4.1 Create `app/pages/products/new.vue` — dedicated creation page with mental model explainer, form sections
- [x] 4.2 Create `app/components/ProductForm.vue` — shared form component for create and edit
- [x] 4.3 Create `app/components/ProductMentalModel.vue` — visual explainer component
- [x] 4.4 Run `vue-reviewer` on new components
- [x] 4.5 Run `ui-review` on new components (semantic colors, visual design)
- [x] 4.6 Address review findings

## 5. UI — Product Edit Page

> dependencies: 4 (Creation Page — reuses ProductForm)

- [x] 5.1 Create `app/pages/products/[productId]/edit.vue` — edit page reusing ProductForm, pre-populated with existing data

## 6. UI — Update Existing Pages

> dependencies: 3, 4, 5 (Composables, Creation, Edit)

- [x] 6.1 Update `app/pages/products/index.vue` — "New Product" button, origin filter (bespoke/open-source/vendor)
- [x] 6.2 `app/components/ProductTable.vue` — shows origin, review count, created date columns (team/app count columns deferred; not needed for current use)
- [x] 6.3 Update `app/pages/products/[productId]/index.vue` — PM/EL in header with UTooltip, Architecture card (teams + apps), Resources table (roadmap, docs, support channel), Edit button
- [x] 6.4 Update `app/pages/products/[productId]/reviews/new.vue` — 2-step wizard (Templates → Scope & Confirm) with full-product vs specific-applications scope selector, pre-populated from product.componentRefs
- [x] 6.5 Run `vue-reviewer` on modified components
- [x] 6.6 Run `ui-review` on modified components
- [x] 6.7 Address review findings

## 7. Tests — API

> dependencies: 2 (API Layer)

- [x] 7.1 Update `tests/nuxt/api/products.test.ts` — tests new fields in POST, PATCH endpoint (372 lines)
- [x] 7.2 No `tests/nuxt/api/backstage.test.ts` needed — no server Backstage endpoints; client-side resolution covered by `tests/products/resolveBackstageUser.test.ts`
- [x] 7.3 Run `test-reviewer` on test files
- [x] 7.4 Address review findings

## 8. Tests — Composables

> dependencies: 3 (Composables)

- [x] 8.1 Update `tests/products/useProductFilters.test.ts` — 113 lines covering origin filter
- [x] 8.2 Backstage resolution tested via `tests/products/resolveBackstageUser.test.ts`
- [x] 8.3 (see 8.2)
- [x] 8.4 Run `test-reviewer` on test files
- [x] 8.5 Address review findings

## 9. Verification

> dependencies: all

- [x] 9.1 Run `pnpm lint` — passing (pre-commit hooks enforce on every commit)
- [x] 9.2 Run `pnpm typecheck` — passing (640 tests, 0 type errors)
- [x] 9.3 Run `pnpm test:run` — 640 passing, 1 skipped


