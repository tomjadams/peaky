# Reorganize Specs by Domain - Design

## Current State

| Spec | Requirements | Lines | Issues |
|------|--------------|-------|--------|
| `layout` | 40 | 1184 | Mixed concerns: UI, pages, patterns, navigation |
| `backend` | 16 | 347 | Mixed: APIs for different domains |
| `assessment` | 4 | 76 | Good - focused on shared components |

## Target State

| Spec | Purpose | Source Requirements |
|------|---------|---------------------|
| `applications` | Application listing, details, status, navigation + APIs | layout (5) + backend (3) |
| `reviews` | Review details, sessions, history, diff + APIs | layout (5) + backend (5) |
| `assessment` | Assessment UI, answers, N/A flow, shared components | layout (8) + existing (4) |
| `templates` | Template listing, selection, status + APIs | layout (3) + backend (3) |
| `template-studio` | Template authoring, editor, preview, publishing + APIs | layout (9) + backend (4) |
| `branding` | Color system, application branding | layout (2) |
| `command-palette` | Command palette functionality | layout (1) |
| `common-ui` | Shared UI patterns, accessibility, tooltips, PWA, DataTable | layout (7) + backend (2) |

## Migration Approach

Since OpenSpec doesn't have a built-in "move requirement" command, we'll:

1. **Create new spec files** with proper Purpose sections
2. **Copy requirements** from `layout` and `backend` to appropriate new specs
3. **Delete old spec files** (`layout/`, `backend/`)
4. **Update assessment spec** Purpose section and add migrated requirements

This is a **tooling-only change** - no code modifications required.

## Requirement Mapping

### To `applications` (8 requirements)
From layout:
- Dashboard Home View
- Application Status Management
- Applications API
- Application Details Page
- Application Details Navigation

From backend:
- Application Details API
- Application-Scoped Reviews API
- Review-Application Relationship

### To `reviews` (10 requirements)
From layout:
- Review Details Page
- Assessment Session History
- Session Cards
- Session Comparison Diff View
- Session Creation Policy

From backend:
- Review-Centric Architecture
- Deep Linking Support
- Actions Needed Calculation
- Multi-Pillar Support
- (pillar data endpoints are review-scoped)

### To `assessment` (8 requirements added, 4 existing)
From layout:
- Question Information Access
- View Mode Navigation
- Template Selector Navigation
- Question Identification
- Pillar Progress Indicators
- Not Applicable Answer Option
- N/A Reason Selection Modal
- N/A Answer Data Model

### To `templates` (6 requirements)
From layout:
- Template Status Indicators
- Template Selection Page
- Templates List Page

From backend:
- Template Detail API
- Template Statistics API
- Templates List Enhancement
- Templates List Filtering

### To `template-studio` (13 requirements)
From layout:
- Template Studio Page
- Pillar Navigation Sidebar
- Question List View
- Question Editor
- Template Preview Mode
- Auto-Save and State Management
- Markdown Export/Import
- Template Publishing
- Template Studio Navigation Integration

From backend:
- Template Update API
- Template Creation API
- Template Publish API

### To `branding` (2 requirements)
From layout:
- Color System
- Consistent Application Branding

### To `command-palette` (1 requirement)
From layout:
- Command Palette

### To `common-ui` (9 requirements)
From layout:
- Semantic HTML Structure
- Collapsible Navigation
- Consistent Tooltip System
- VueUse Composables
- Breadcrumb Navigation
- Progressive Web App Support
- Reusable DataTable Component

From backend:
- Nitro Server API
- Data Fetching Patterns

## Validation

After migration:
- Total requirements: 8 + 10 + 12 + 6 + 13 + 2 + 1 + 9 = 61 (was 40 + 16 + 4 = 60, +1 for split)
- All specs pass `openspec validate --specs`
- `openspec show <spec>` works for each new spec
