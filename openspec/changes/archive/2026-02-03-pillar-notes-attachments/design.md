# Design: Pillar Notes & Attachments

## Overview

Extends the Assessment page with per-pillar notes and file attachments, enabling users to capture context during assisted reviews without cluttering the question-answer flow.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Assessment Page                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ PillarSection.vue                                            │    │
│  │  ┌─────────────────────────────────────────────────────────┐ │    │
│  │  │ Header: Name, Progress, [📝] Notes Anchor               │ │    │
│  │  ├─────────────────────────────────────────────────────────┤ │    │
│  │  │ QuestionRow (slot)                                      │ │    │
│  │  │ QuestionRow (slot)                                      │ │    │
│  │  │ ...                                                     │ │    │
│  │  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤ │    │
│  │  │ PillarNotes.vue (NEW)                                   │ │    │
│  │  │  ├─ MarkdownEditor (reuse from Template Studio)         │ │    │
│  │  │  ├─ AttachmentList                                      │ │    │
│  │  │  │   └─ AttachmentCard (per file)                       │ │    │
│  │  │  ├─ AttachmentUpload (drag-drop zone)                   │ │    │
│  │  │  └─ SaveButton                                          │ │    │
│  │  └─────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
┌──────────────┐     GET /pillars/:id/notes      ┌──────────────┐
│              │ ──────────────────────────────▶ │              │
│   Frontend   │                                  │   Backend    │
│              │ ◀────────────────────────────── │              │
│  (Vue/Nuxt)  │     { content, attachments }    │  (Nitro API) │
│              │                                  │              │
│              │     PUT /pillars/:id/notes      │              │
│              │ ──────────────────────────────▶ │              │
│              │     { content }                  │              │
│              │                                  │              │
│              │     POST /attachments           │              │
│              │ ──────────────────────────────▶ │              │
│              │     multipart/form-data         │              │
│              │                                  │              │
│              │ ◀────────────────────────────── │     S3       │
│              │     { id, object_key, ... }    │   Bucket     │
└──────────────┘                                  └──────────────┘
```

## Component Design

### PillarSection.vue (Modified)

Add to existing component:

```vue
<template>
  <!-- Existing header -->
  <div class="pillar-section__header">
    <h2>{{ pillarName }}</h2>
    <div class="pillar-section__actions">
      <span>{{ answeredCount }}/{{ totalCount }}</span>
      <button 
        class="pillar-section__notes-anchor"
        :class="{ 'has-content': hasNotes }"
        @click="scrollToNotes"
        aria-label="Jump to pillar notes"
      >
        <Icon name="lucide:sticky-note" />
        <span v-if="hasNotes" class="indicator-dot" />
      </button>
    </div>
  </div>
  
  <!-- Existing questions slot -->
  <slot />
  
  <!-- NEW: Notes section -->
  <div class="pillar-section__separator" />
  <PillarNotes
    :review-id="reviewId"
    :pillar-id="pillarId"
    :pillar-slug="pillarSlug"
    :collapsed="notesCollapsed"
    @toggle="notesCollapsed = !notesCollapsed"
    @saved="handleNotesSaved"
  />
</template>
```

### PillarNotes.vue (New)

```vue
<script setup lang="ts">
interface Props {
  reviewId: string
  pillarId: string
  pillarSlug: string
  collapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false
})

const emit = defineEmits<{
  toggle: []
  saved: []
}>()

const { notes, attachments, loading, save, uploadAttachment, deleteAttachment } = 
  usePillarNotes(props.reviewId, props.pillarId)

const isFirstSave = ref(true)
const showCelebration = ref(false)

async function handleSave() {
  await save()
  if (isFirstSave.value && notes.value.content) {
    showCelebration.value = true
    isFirstSave.value = false
    setTimeout(() => showCelebration.value = false, 2000)
  }
  emit('saved')
}
</script>
```

### AttachmentCard.vue (New)

```vue
<template>
  <article class="attachment-card">
    <div class="attachment-card__icon" :class="iconClass">
      <Icon :name="iconName" />
    </div>
    <div class="attachment-card__info">
      <p class="attachment-card__name">{{ attachment.filename }}</p>
      <p class="attachment-card__meta">
        {{ formatBytes(attachment.size_bytes) }} · {{ attachment.created_by_name }}
      </p>
    </div>
    <button 
      class="attachment-card__delete"
      @click="$emit('delete')"
      aria-label="Delete attachment"
    >
      <Icon name="lucide:trash-2" />
    </button>
  </article>
</template>
```

### AttachmentUpload.vue (New)

```vue
<template>
  <div 
    class="attachment-upload"
    :class="{ 'attachment-upload--dragover': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave="isDragging = false"
    @drop.prevent="handleDrop"
  >
    <input 
      ref="fileInput"
      type="file"
      :accept="acceptedTypes"
      multiple
      class="sr-only"
      @change="handleFileSelect"
    />
    <div class="attachment-upload__content">
      <Icon name="lucide:cloud-upload" class="attachment-upload__icon" />
      <p>
        <button type="button" @click="fileInput?.click()">Click to upload</button>
        or drag and drop
      </p>
      <p class="attachment-upload__hint">PDF, XLSX, PNG up to 10MB</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const acceptedTypes = '.pdf,.xlsx,.xls,.png,.jpg,.jpeg'
const maxSize = 10 * 1024 * 1024 // 10MB

function validateFile(file: File): string | null {
  if (file.size > maxSize) return 'File exceeds 10MB limit'
  // Additional validation...
  return null
}
</script>
```

## Composable: usePillarNotes

```typescript
// composables/usePillarNotes.ts

interface PillarNote {
  content: string
  updated_at: string
}

interface PillarAttachment {
  id: string
  filename: string
  content_type: string
  size_bytes: number
  object_key: string // fully qualified path in object storage
  created_by: string
  created_by_name: string
  created_at: string
}

export function usePillarNotes(reviewId: string, pillarId: string) {
  const notes = ref<PillarNote>({ content: '', updated_at: '' })
  const attachments = ref<PillarAttachment[]>([])
  const loading = ref(false)
  const saving = ref(false)

  async function fetch() {
    loading.value = true
    try {
      const data = await $fetch(`/api/reviews/${reviewId}/pillars/${pillarId}/notes`)
      notes.value = data.notes
      attachments.value = data.attachments
    } finally {
      loading.value = false
    }
  }

  async function save() {
    saving.value = true
    try {
      await $fetch(`/api/reviews/${reviewId}/pillars/${pillarId}/notes`, {
        method: 'PUT',
        body: { content: notes.value.content }
      })
    } finally {
      saving.value = false
    }
  }

  async function uploadAttachment(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    
    const attachment = await $fetch(
      `/api/reviews/${reviewId}/pillars/${pillarId}/attachments`,
      { method: 'POST', body: formData }
    )
    attachments.value.push(attachment)
  }

  async function deleteAttachment(attachmentId: string) {
    await $fetch(
      `/api/reviews/${reviewId}/pillars/${pillarId}/attachments/${attachmentId}`,
      { method: 'DELETE' }
    )
    attachments.value = attachments.value.filter(a => a.id !== attachmentId)
  }

  onMounted(fetch)

  return {
    notes,
    attachments,
    loading,
    saving,
    save,
    uploadAttachment,
    deleteAttachment,
    refresh: fetch
  }
}
```

## API Design

### GET /api/reviews/:reviewId/pillars/:pillarId/notes

Response:
```json
{
  "notes": {
    "content": "We use Terraform for all infrastructure...",
    "updated_at": "2026-02-02T14:30:00Z"
  },
  "attachments": [
    {
      "id": "1",
      "filename": "Architecture_Design.pdf",
      "content_type": "application/pdf",
      "size_bytes": 2457600,
      "created_by": "user_456",
      "created_by_name": "Sarah K.",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ]
}
```

### PUT /api/reviews/:reviewId/pillars/:pillarId/notes

Request:
```json
{
  "content": "We use Terraform for all infrastructure..."
}
```

### POST /api/reviews/:reviewId/pillars/:pillarId/attachments

Request: `multipart/form-data` with `file` field

Response:
```json
{
  "id": "2",
  "filename": "Load_Test_Results.xlsx",
  "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size_bytes": 862208,
  "object_key": "reviews/1/pillars/INFRA/2.xlsx",
  "created_by": "user_456",
  "created_by_name": "Sarah K.",
  "created_at": "2026-02-02T15:00:00Z"
}
```

## S3 Storage Structure

```
bucket/
└── reviews/
    └── {review_id}/
        └── pillars/
            └── {pillar_slug}/
                ├── 1.pdf
                ├── 2.xlsx
                └── 3.png
```

## Animation Specifications

### Scroll to Notes

```css
.pillar-notes {
  scroll-margin-top: 6rem; /* Account for sticky header */
}

/* Smooth scroll behavior */
html {
  scroll-behavior: smooth;
}
```

### Expand/Collapse

```css
.pillar-notes__content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 300ms ease-out;
}

.pillar-notes__content--expanded {
  grid-template-rows: 1fr;
}

.pillar-notes__content > div {
  overflow: hidden;
}
```

### Drag-Drop Feedback

```css
.attachment-upload {
  transition: border-color 150ms, transform 150ms, background-color 150ms;
}

.attachment-upload--dragover {
  border-color: var(--color-primary);
  background-color: rgba(59, 130, 246, 0.05);
  transform: scale(1.01);
}
```

### Celebration Animation

Using a lightweight confetti library or CSS animation. Example animation definition:

- Scale from 0 to 1.2 to 1 over 1.5s
- Rotate 360 degrees
- Fade opacity from 1 to 0
- Apply `ease-out` timing function

## Database Migration

```sql
-- migrations/XXXX_add_pillar_notes.sql

-- +goose Up
CREATE TABLE pillar_comments (
    review_id   BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    pillar_id   BIGINT NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (review_id, pillar_id)
);

CREATE TABLE pillar_attachments (
    id           BIGSERIAL PRIMARY KEY,
    review_id    BIGINT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    pillar_id    BIGINT NOT NULL REFERENCES pillars(id) ON DELETE CASCADE,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes   INTEGER NOT NULL,
    object_key  TEXT NOT NULL, -- fully qualified path in object storage
    created_by   BIGINT REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pillar_attachments_review_pillar_idx 
    ON pillar_attachments(review_id, pillar_id);

-- +goose Down
DROP TABLE IF EXISTS pillar_attachments;
DROP TABLE IF EXISTS pillar_comments;
```

## Error Handling

| Scenario | User Feedback |
|----------|---------------|
| File too large | Toast: "File exceeds 10MB limit" |
| Invalid file type | Toast: "Only PDF, XLSX, and PNG files are supported" |
| Upload failed | Toast: "Upload failed. Please try again." + retry button |
| Save failed | Toast: "Could not save notes. Please try again." |
| Delete failed | Toast: "Could not delete file. Please try again." |

## Accessibility

- Notes section has `role="region"` with `aria-label="Pillar notes for {pillarName}"`
- Collapse/expand button has `aria-expanded` state
- Upload zone is keyboard accessible with Enter/Space to trigger file picker
- File delete confirms with accessible dialog
- Screen reader announces upload progress and completion
