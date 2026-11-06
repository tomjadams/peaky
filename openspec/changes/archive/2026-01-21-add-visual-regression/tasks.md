## 1. Visual Test Configuration

- [x] 1.1 Configure Playwright for visual comparisons
- [x] 1.2 Set up snapshot directory structure
- [x] 1.3 Add snapshot update script to package.json
- [x] 1.4 Document snapshot workflow in AGENTS.md and testing.md

## 2. Page Screenshots

- [x] 2.1 Capture home/dashboard page (light mode)
- [x] 2.2 Capture home/dashboard page (dark mode)
- [x] 2.3 Capture templates list page

## 3. Component Screenshots

- [x] 3.1 Capture DataTable states (with data, with selection)
- [x] 3.2 Capture command palette states (open, with search)
- [x] 3.3 Capture bulk action bar
- [x] 3.4 Capture filter bar states
- [x] 3.5 Capture answer toggle states (survey page)

## 4. Theme Variations

- [x] 4.1 Capture key pages in dark mode

## 5. Validation

- [x] 5.1 Run visual tests, generate baselines
- [x] 5.2 Verify snapshot comparison works
- [x] 5.3 Test snapshot update workflow

## Notes

- Desktop only (no mobile/tablet) - app not designed for smaller viewports
- Baselines stored in `tests/e2e/__snapshots__/`
