# Add Template Studio

## Why
Template authors currently have no way to create, edit, or manage ORR templates within the application. A dedicated Template Studio is needed to enable template authoring with a focused, distraction-free experience. Authors will spend significant time (1+ hours) crafting templates, defining questions, their importance, risk levels, and organizing content by pillars. Templates are stored as Markdown in the backend, requiring a controlled editing experience with limited formatting options.

## What Changes
1. **Templates List Page** (`/templates`)
   - DataTable showing all templates with name, version, status, and review usage count
   - Edit action navigates to Template Studio
   - Create new template action

2. **Template Studio Page** (`/templates/:id/edit`)
   - Full-screen editor focused on template authoring
   - Space-efficient pillar navigation (collapsible sidebar similar to TemplateSelectorSidebar)
   - Question editor with:
     - Question text with limited Markdown (Bold, Italic, List, full Markdown toggle)
     - Risk level dropdown (Critical, High, Medium, Low)
     - Collapsible metadata sections (Why Important, Leading Practices, Helpful Links)
     - Drag-and-drop reordering of questions and practices
     - Dynamic slug ID generation (e.g., REL-1, REL-2)
   - Template header with name, version, status, auto-save indicator
   - Preview mode to see template as it would appear in Assessment view
   - Publish action (no-op backend, validates Markdown safety)

3. **Backend APIs**
   - GET/POST/PUT `/api/templates` - CRUD operations
   - GET `/api/templates/:id` - Template details with questions
   - PUT `/api/templates/:id/questions` - Update questions
   - POST `/api/templates/:id/publish` - Publish template (no-op, validates Markdown)
   - GET `/api/templates/:id/stats` - Usage analytics (reviews count, applications, orgs)

4. **Enhanced Template Data Model**
   - Full question content with Markdown fields
   - Pillar ordering and question ordering within pillars
   - Risk level per question
   - Version management (draft vs published)

## Impact
- **layout spec**: Adds Template List Page and Template Studio requirements
- **backend spec**: Adds Template CRUD and publishing endpoints
- **New pages**: `/templates/index.vue`, `/templates/[id]/edit.vue`
- **New components**: Template editor components, preview modal
- **Models**: Enhanced Template and Question types
- **Navigation**: Add Templates link to main sidebar
