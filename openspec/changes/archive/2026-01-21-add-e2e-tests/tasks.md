## 1. Playwright Setup

- [x] 1.1 Install `@playwright/test` and configure for Nuxt
- [x] 1.2 Create `playwright.config.ts` with CI support (`PLAYWRIGHT_BASE_URL` env var)
- [x] 1.3 Add `test:e2e` script to package.json
- [x] 1.4 Use existing mock API data as test fixtures

## 2. Command Palette Tests (`command-palette.spec.ts`)

- [x] 2.1 Test opening with Cmd+K and Ctrl+K
- [x] 2.2 Test closing with Escape
- [x] 2.3 Test search functionality
- [x] 2.4 Test keyboard navigation (arrow keys)

## 3. Command Palette In-Page Actions Tests (`command-palette-in-page.spec.ts`)

- [x] 3.1 **Application Details Page**
  - [x] Start new review action
  - [x] Review navigation commands
  - [x] Deduplication of reviews with same name (different templates)
  - [x] Navigation to review on command execution

- [x] 3.2 **Review Details Page**
  - [x] Go to Assessment action
  - [x] NO pillar navigation (would navigate away - intentional)
  - [x] Template switching commands (when review uses multiple templates)
  - [x] History expand/collapse commands
  - [x] Individual session toggle commands

- [x] 3.3 **Assessment Page**
  - [x] Pillar navigation commands (in-page scroll)
  - [x] Save progress action
  - [x] Survey mode toggle action
  - [x] Template selector toggle action
  - [x] Pillar scroll to section

- [x] 3.4 **Templates Page**
  - [x] Create new template action
  - [x] Template navigation commands
  - [x] Navigation to template editor

- [x] 3.5 **Template Editor Page**
  - [x] Pillar navigation commands
  - [x] Add question action

- [x] 3.6 **Command Cleanup on Navigation**
  - [x] Lifecycle commands removed when navigating away
  - [x] New page commands available immediately
  - [x] Assessment pillar commands cleaned up on review details

- [x] 3.7 **Global Commands**
  - [x] Dashboard navigation available everywhere
  - [x] Dark mode toggle available everywhere
  - [x] Application search source available globally

## 4. Survey Mode Tests (`survey-mode.spec.ts`)

- [x] 4.1 Test Survey Mode toggle navigation
- [x] 4.2 Test single question display
- [x] 4.3 Test question navigation (Previous/Next)
- [x] 4.4 Test Survey Mode button active state
- [x] 4.5 Test return to assessment from survey
- [x] 4.6 Test N/A modal in survey
- [x] 4.7 Test answer selection state

## 5. Other E2E Tests

- [x] 5.1 Home page tests (`home.spec.ts`)
- [x] 5.2 Navigation tests (`navigation.spec.ts`)
- [x] 5.3 Templates page tests (`templates.spec.ts`)
- [x] 5.4 Data table tests (`data-table.spec.ts`)

## 6. Bug Fixes (discovered during E2E implementation)

- [x] 6.1 Fix duplicate review commands (deduplicate by name)
- [x] 6.2 Remove pillar navigation from review details (confusing UX)
- [x] 6.3 Add route watcher to clean up lifecycle commands
- [x] 6.4 Add in-page actions for templates page
- [x] 6.5 Add in-page actions for review details (template switch, history)
- [x] 6.6 Fix survey mode layout shift (fixed 840px width)

## 7. Validation

- [x] 7.1 All E2E tests pass (36 command palette tests + others)
- [x] 7.2 Tests work in headless mode
- [x] 7.3 CI-ready with `PLAYWRIGHT_BASE_URL` env var support
