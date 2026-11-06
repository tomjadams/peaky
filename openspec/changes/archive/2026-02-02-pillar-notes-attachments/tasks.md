# Tasks: Pillar Notes & Attachments

## Completed

### TypeScript & API Layer
- [x] Add TypeScript types in `app/models/pillar-notes.ts`
- [x] Add Zod schemas for API validation
- [x] `GET /api/reviews/[reviewId]/pillars/[pillarId]/notes.get.ts`
- [x] `PUT /api/reviews/[reviewId]/pillars/[pillarId]/notes.put.ts`
- [x] `POST /api/reviews/[reviewId]/pillars/[pillarId]/attachments.post.ts`
- [x] `DELETE /api/reviews/[reviewId]/pillars/[pillarId]/attachments/[attachmentId].delete.ts`
- [x] `GET /api/attachments/[id]/download.get.ts`

### Frontend Components
- [x] Create `composables/usePillarNotes.ts`
- [x] Create `components/assessment/PillarNotes.vue`
- [x] Create `components/assessment/AttachmentCard.vue`
- [x] Create `components/assessment/AttachmentUpload.vue`
- [x] Modify `components/assessment/PillarSection.vue`

### Animations & Polish
- [x] Smooth scroll to notes section
- [x] Expand/collapse animation
- [x] Drag-drop visual feedback
- [x] Celebration micro-animation on first save

### Assessment Page Integration
- [x] Single pillar view with tab navigation
- [x] Bidirectional sync with template selector sidebar
- [x] Pass `reviewId` to PillarSection

### Verification
- [x] Run `pnpm lint --fix`
- [x] Run `pnpm test` (unit tests)
- [x] Run `pnpm test:e2e` (functional e2e)

## Deferred to Decision Log

The following items are tracked in `site/docs/maintainers/decisions.md`:

- **TD-010**: Database schema (`pillar_comments`, `pillar_attachments` tables)
- **TD-011**: S3 attachment storage (bucket setup, env vars, MinIO)
- **TD-012**: Pillar notes tests (unit, component, E2E)

See decision log for details on each deferred item.
