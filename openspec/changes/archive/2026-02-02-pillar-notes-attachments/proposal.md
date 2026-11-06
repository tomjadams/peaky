## Why

During assisted reviews with advisors or team reviews, users need a way to capture context, observations, and follow-up notes for each pillar. Currently, there's no place to add narrative context beyond yes/no answers. This makes it difficult to:

- Share reasoning behind answers during collaborative review sessions
- Attach supporting materials (architecture diagrams, runbooks, etc.)
- Provide context for future reviewers examining the same pillar

Additionally, with checklist-type questions planned for the future, having comments per-question would create an inconsistent experience where yes/no questions don't need comments while checklists do. Per-pillar notes solve this by treating notes as a narrative area rather than per-question annotations.

## What Changes

- Add a **Pillar Notes** section at the bottom of each pillar on the Assessment page
- Support **markdown** content with a rich text editor (reuse Template Studio editor)
- Allow **file attachments** (PDF, XLSX, PNG up to 10MB) with S3-compatible storage
- Add **collapsible UI** with header anchor to balance visibility vs. focus on questions
- Add **celebration micro-animation** on first note save to encourage detailed reviews
- Include **smooth CSS transitions** for scroll-to-notes, expand/collapse, and drag-drop

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Notes per pillar, not per question | Cohesive narrative; works with future checklist questions |
| Markdown with inline links | Simpler than structured resource list; links stay contextual |
| Collapsible with header anchor | Balances discoverability vs. not distracting from questions |
| Celebration animation only | No scores/badges that could cause anxiety or be weaponized |
| `created_by` on attachments only | Basic authorship without full threading complexity |

## Capabilities

### New Capabilities
- `pillar-notes`: Markdown notes per review-pillar with collapsible UI
- `pillar-attachments`: File upload/download with S3-compatible storage

### Modified Capabilities
- `assessment`: Extended with notes section at bottom of each pillar
- `assessment`: Save button relocated to end of pillar notes section

## Impact

### Database

New tables:

```sql
pillar_comments
───────────────────
review_id      FK → reviews
pillar_id      FK → pillars
content        text (markdown)
created_at     timestamptz
updated_at     timestamptz
PRIMARY KEY (review_id, pillar_id)

pillar_attachments
───────────────────
id             bigserial PRIMARY KEY
review_id      FK → reviews
pillar_id      FK → pillars
filename       text NOT NULL
content_type   text NOT NULL
size_bytes     int NOT NULL
object_key    text NOT NULL -- fully qualified path in object storage
created_by     FK → users
created_at     timestamptz NOT NULL
```

### Frontend Components

| Component | Change |
|-----------|--------|
| `PillarSection.vue` | Add notes anchor badge in header, dashed separator, collapsible notes section |
| `PillarNotes.vue` | New - markdown editor, attachments list, upload zone, save button |
| `AttachmentCard.vue` | New - file icon, name, size, uploader, delete action |
| `AttachmentUpload.vue` | New - drag-drop zone, file type validation |

### Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reviews/:id/pillars/:pillarId/notes` | GET | Get pillar notes and attachments |
| `/api/reviews/:id/pillars/:pillarId/notes` | PUT | Save/update pillar notes |
| `/api/reviews/:id/pillars/:pillarId/attachments` | POST | Upload attachment (multipart) |
| `/api/reviews/:id/pillars/:pillarId/attachments/:attachmentId` | DELETE | Remove attachment |
| `/api/attachments/:id/download` | GET | Presigned URL redirect for download |

### Infrastructure

- S3-compatible storage bucket for attachments
- Environment variables: `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

## UX Details

### Visual Treatment

```
┌─ Infrastructure ──────────────────── 3/3 ─ 100% ─ [📝] ──┐
│                                                    ↑      │
│  Q1 [YES] [NO] [N/A]                     badge w/ dot if  │
│  Q2 [YES] [NO] [N/A]                     notes have       │
│  Q3 [YES] [NO] [N/A]                     content          │
│                                                           │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                                           │
│  📝 Notes                                          [▾/▴]  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ [B] [I] [•] [🔗]                                      │ │
│  │ ───────────────────────────────────────────────────── │ │
│  │ Add context, observations, or follow-up notes...     │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  Attachments                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ 📕 Architecture.pdf │  │ 📗 Results.xlsx     │        │
│  │ 2.4 MB · Sarah K.   │  │ 842 KB · Mike R.    │        │
│  └─────────────────────┘  └─────────────────────┘        │
│                                                           │
│                                     [💾 Save Progress]    │
└───────────────────────────────────────────────────────────┘
```

### Animations & Transitions

| Interaction | Animation |
|-------------|-----------|
| Click header [📝] anchor | Smooth scroll to notes section + expand if collapsed |
| Expand/collapse notes | CSS transition with height animation |
| Drag file over upload zone | Border highlight, scale-up feedback |
| First note saved | Confetti/sparkle micro-animation + subtle toast |
| File upload progress | Progress bar within attachment card |

### Language (No-Blame Culture)

- Use "Notes" and "Attachments" (not "Evidence")
- Remove "SYSTEM ONLINE / Autosaved" status indicators
- Remove "Collaborative Session Active" badge
- Placeholder: "Add context, observations, or follow-up notes for this pillar..."

## Out of Scope

- Real-time collaboration / threading on notes
- Application-level resource library (future: Application details page)
- Review quality scores or completion badges
- Full audit trail of note edits (just `updated_at` for now)
