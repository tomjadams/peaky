# Change: Add E2E Tests with Playwright

## Status: IMPLEMENTED

## Why

No E2E tests exist. Critical user journeys should be tested end-to-end to:
- Verify full-stack integration (UI → API → Data)
- Catch integration issues before production
- Document how UI and server work together (valuable for backend refactor)
- Provide confidence for major refactoring efforts

## What Changes

- Install and configure Playwright for Nuxt
- Create E2E tests for critical user journeys
- Set up test fixtures for consistent test data (using existing mock API data)
- Configure CI-ready test execution with environment variable support

**Critical user journeys tested:**

1. **Assessment Flow**
   - Navigate to application → Select review → Answer questions → See progress update
   - Mark question as N/A → Select reason → Confirm

2. **Survey Mode**
   - Toggle survey mode → Navigate to dedicated survey page
   - Answer questions one at a time → Navigate between questions
   - Fixed-width card prevents layout shift between questions

3. **Template Studio Flow**
   - Navigate to template list → Open template editor
   - Pillar tab switching → Question editing

4. **Navigation & Search (Command Palette)**
   - Open command palette (Cmd+K / Ctrl+K) → Search → Execute command
   - Global commands available on all pages (Dashboard, Dark mode, Applications)
   - In-page commands scoped to current page context
   - Lifecycle command cleanup on navigation (prevents stale commands)

5. **Command Palette In-Page Actions** (per page):
   - **Application Details**: Start new review, Navigate to reviews (deduplicated by name)
   - **Review Details**: Go to Assessment, Switch templates (when review uses multiple), Expand/collapse history sessions
   - **Assessment Page**: Pillar navigation (scroll), Save progress, Survey mode toggle, Template selector toggle
   - **Templates Page**: Create new template, Edit existing templates
   - **Template Editor**: Pillar navigation, Add question

6. **Data Table Interactions**
   - Table rendering with data
   - Row click navigation

**Terminology note:** A **template** is a set of predefined questions and pillars/categories. A **review** uses one or more templates to assess an application's operational readiness.

## Implementation Details

### Playwright Configuration
- `PLAYWRIGHT_BASE_URL` env var for CI stages (defaults to `http://localhost:3000`)
- When `PLAYWRIGHT_BASE_URL` is set, webServer is disabled (tests run against deployed stage)
- When not set, starts local dev server automatically

### Bug Fixes During Implementation
1. **Duplicate review commands**: Reviews with same name (different templates) now show only one command
2. **Pillar navigation on review details**: Removed confusing pillar commands that navigated away
3. **Stale lifecycle commands**: Added route watcher to clean up commands on navigation
4. **Survey mode layout shift**: Fixed width (840px) prevents card resizing between questions

## Impact

- Affected specs: All domains (E2E crosses boundaries)
- New files: `tests/e2e/*.spec.ts`, `playwright.config.ts`
- New dev dependency: `@playwright/test`
- Production fixes: Command palette cleanup, survey mode styling
