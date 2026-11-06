## 1. Data Model

- [x] 1.1 Create `AssessmentSession` interface in `app/models/session.ts`
- [x] 1.2 Export session types from `app/models/index.ts`
- [x] 1.3 Create mock session data in `server/data/sessions.ts`

## 2. API Endpoints

- [x] 2.1 Create `GET /api/reviews/:reviewId/sessions` endpoint
- [x] 2.2 Create `GET /api/reviews/:reviewId/sessions/:sessionId` endpoint
- [x] 2.4 Create composable `useReviewSessions` for data fetching

## 3. Timeline Component

- [x] 3.1 Create `SessionTimeline.vue` component
- [x] 3.2 Implement horizontal timeline with session nodes
- [x] 3.3 Add progress percentage labels below nodes
- [x] 3.4 Add delta indicators between nodes (+N answers)
- [x] 3.5 Highlight current/latest session

## 4. Session Card Component

- [x] 4.1 Create `SessionCard.vue` component
- [x] 4.2 Implement collapsed state (date, author, summary)
- [x] 4.3 Implement expanded state with pillar deltas
- [x] 4.4 Add optional session note display
- [x] 4.5 Add "Compare" button (UI only, diff view deferred)

## 5. Diff View Component (Deferred to future iteration)

- [ ] 5.1 Create `SessionDiff.vue` component
- [ ] 5.2 Implement session selection UI (compare A vs B)
- [ ] 5.3 Implement question-level diff rendering
- [ ] 5.4 Add pillar grouping with progress delta badges
- [ ] 5.5 Style added/removed content (green/red)

> Note: Diff view was scoped as Phase 3 in the design and deferred per "Complexity" risk mitigation.

## 6. Integration

- [x] 6.1 Replace History placeholder in Review Details page
- [x] 6.2 Add timeline above session cards
- [x] 6.3 Wire up session card expansion
- [x] 6.5 Add loading and empty states

## 7. Polish

- [x] 7.1 Add CSS transitions for timeline interactions
- [x] 7.2 Add CSS transitions for card expand/collapse
- [x] 7.3 Ensure responsive design for mobile

## 8. Testing & Validation

- [x] 8.1 Run `pnpm run lint`
- [x] 8.2 Run `pnpm run typecheck`
- [x] 8.3 Manual testing of all interactions
