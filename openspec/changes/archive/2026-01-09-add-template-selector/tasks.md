# Implementation Tasks

## 1. Create Template Selector Component

- [x] 1.1 Create `TemplateSelectorSidebar.vue` component with expand/collapse functionality
- [x] 1.2 Implement template header with name, version, and status badge
- [x] 1.3 Add pillar list with progress indicators
- [x] 1.4 Style active pillar highlighting
- [x] 1.5 Add collapse/expand button with icon transitions
- [x] 1.6 Implement collapsed state showing only template name and status

## 2. Update Question Display

- [x] 2.1 Add question ID display (e.g., SEC-1, SEC-2) to questions in `index.vue`
- [x] 2.2 Position question IDs as badges or prefixes
- [x] 2.3 Ensure IDs are visible but don't clutter the UI
- [x] 2.4 Add anchor tags to questions for future deep linking

## 3. Layout Integration

- [x] 3.1 Update layout structure to accommodate template selector sidebar
- [x] 3.2 Ensure proper spacing and responsive behavior
- [x] 3.3 Maintain existing NavigationSidebar functionality
- [x] 3.4 Test collapse/expand transitions

## 4. Accessibility & UX

- [x] 4.1 Add appropriate ARIA labels to template selector
- [x] 4.2 Ensure keyboard navigation works for pillar links
- [x] 4.3 Add focus states for interactive elements
- [x] 4.4 Test with screen readers

## 5. Mock Data & State Management

- [x] 5.1 Create mock template data structure within the Vue component (template name, version, status, pillars)
- [x] 5.2 Add mock pillar data with completion percentages
- [x] 5.3 Implement collapse state management (localStorage or composable)
- [x] 5.4 Prepare data structure for future backend integration

## 6. Testing & Validation

- [x] 6.1 Test expand/collapse functionality
- [x] 6.2 Verify responsive behavior on different screen sizes
- [x] 6.3 Test dark mode styling
- [x] 6.4 Validate anchor tag structure for future routing
- [x] 6.5 Ensure no regression in existing question display
