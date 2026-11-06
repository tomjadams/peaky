# Implementation Tasks

## 1. Data Model Updates
- [x] 1.1 Update `QuestionAnswer` type to include `'na'` option in `app/models/question.ts`
- [x] 1.2 Create `NotApplicableReason` interface with `reason` (required) and `comment` (optional) fields
- [x] 1.3 Update `Question` interface to include `naReason?: NotApplicableReason`
- [x] 1.4 Update local answer state structure to handle N/A with reason

## 2. Modal Component
- [x] 2.1 Create `NAReasonModal.vue` component in `app/components/`
- [x] 2.2 Implement modal backdrop with blur effect
- [x] 2.3 Add modal header with question text display
- [x] 2.4 Implement predefined reason buttons (square design with selection state)
- [x] 2.5 Add optional textarea for additional details with character counter (0/200)
- [x] 2.6 Implement Cancel and Confirm buttons
- [x] 2.7 Add fade-in scale animation for modal appearance
- [x] 2.8 Handle keyboard accessibility (Escape to close, focus management)

## 3. Answer Button Updates
- [x] 3.1 Add N/A button to answer toggle in `app/pages/index.vue`
- [x] 3.2 Add N/A link option in `app/pages/survey.vue`
- [x] 3.3 Style N/A button with gray theme (distinct from Yes/No)
- [x] 3.4 Add active state styling for N/A button (ring effect as shown in prototype)
- [x] 3.5 Implement click handler to open N/A modal

## 4. State Management
- [x] 4.1 Create composable `useNAModal()` for modal state management
- [x] 4.2 Track currently selected question for N/A modal
- [x] 4.3 Handle modal open/close state
- [x] 4.4 Store N/A reason and comment in local answers state
- [x] 4.5 Update `toggleAnswer` logic to handle N/A selection

## 5. Progress Calculation Updates
- [x] 5.1 Update `updatePillarProgress()` to count N/A as answered
- [x] 5.2 Ensure N/A questions contribute to completion percentage
- [x] 5.3 Verify progress bar reflects N/A answers correctly

## 6. Visual Feedback
- [x] 6.1 Add visual indication for questions marked as N/A (subtle opacity/grayscale as in prototype)
- [x] 6.2 Ensure N/A button shows selected state with ring styling
- [x] 6.3 Test dark mode styling for all N/A components

## 7. Accessibility
- [x] 7.1 Add proper ARIA labels to N/A button
- [x] 7.2 Implement focus trap in modal
- [x] 7.3 Add screen reader announcements for modal open/close
- [x] 7.4 Ensure keyboard navigation works for reason selection

## 8. Save/Persistence
- [x] 8.1 Update `saveProgress()` to include N/A answers with reasons
- [x] 8.2 Prepare payload structure for API endpoint (future backend work)
- [x] 8.3 Test that N/A state persists in local state during session
