# Reorganize Specs by Domain - Tasks

Note: This is a documentation/tooling change with no code modifications. 
Archive with `--skip-specs` since we're manually reorganizing spec files.

## 1. Create New Spec Files
- [x] 1.1 Create `openspec/specs/applications/spec.md` with Purpose and Requirements sections
- [x] 1.2 Create `openspec/specs/reviews/spec.md` with Purpose and Requirements sections
- [x] 1.3 Create `openspec/specs/templates/spec.md` with Purpose and Requirements sections
- [x] 1.4 Create `openspec/specs/template-studio/spec.md` with Purpose and Requirements sections
- [x] 1.5 Create `openspec/specs/branding/spec.md` with Purpose and Requirements sections
- [x] 1.6 Create `openspec/specs/command-palette/spec.md` with Purpose and Requirements sections
- [x] 1.7 Create `openspec/specs/common-ui/spec.md` with Purpose and Requirements sections

## 2. Migrate Requirements to `applications` (8 total)
From layout:
- [x] 2.1 Dashboard Home View
- [x] 2.2 Application Status Management
- [x] 2.3 Applications API
- [x] 2.4 Application Details Page
- [x] 2.5 Application Details Navigation

From backend:
- [x] 2.6 Application Details API
- [x] 2.7 Application-Scoped Reviews API
- [x] 2.8 Review-Application Relationship

## 3. Migrate Requirements to `reviews` (9 total)
From layout:
- [x] 3.1 Review Details Page
- [x] 3.2 Assessment Session History
- [x] 3.3 Session Cards
- [x] 3.4 Session Comparison Diff View
- [x] 3.5 Session Creation Policy

From backend:
- [x] 3.6 Review-Centric Architecture
- [x] 3.7 Deep Linking Support
- [x] 3.8 Actions Needed Calculation
- [x] 3.9 Multi-Pillar Support

## 4. Migrate Requirements to `assessment` (8 added to existing 4)
From layout:
- [x] 4.1 Question Information Access
- [x] 4.2 View Mode Navigation
- [x] 4.3 Template Selector Navigation
- [x] 4.4 Question Identification
- [x] 4.5 Pillar Progress Indicators
- [x] 4.6 Not Applicable Answer Option
- [x] 4.7 N/A Reason Selection Modal
- [x] 4.8 N/A Answer Data Model
- [x] 4.9 Update Purpose section

## 5. Migrate Requirements to `templates` (7 total)
From layout:
- [x] 5.1 Template Status Indicators
- [x] 5.2 Template Selection Page
- [x] 5.3 Templates List Page

From backend:
- [x] 5.4 Template Detail API
- [x] 5.5 Template Statistics API
- [x] 5.6 Templates List Enhancement
- [x] 5.7 Templates List Filtering

## 6. Migrate Requirements to `template-studio` (12 total)
From layout:
- [x] 6.1 Template Studio Page
- [x] 6.2 Pillar Navigation Sidebar
- [x] 6.3 Question List View
- [x] 6.4 Question Editor
- [x] 6.5 Template Preview Mode
- [x] 6.6 Auto-Save and State Management
- [x] 6.7 Markdown Export/Import
- [x] 6.8 Template Publishing
- [x] 6.9 Template Studio Navigation Integration

From backend:
- [x] 6.10 Template Update API
- [x] 6.11 Template Creation API
- [x] 6.12 Template Publish API

## 7. Migrate Requirements to `branding` (2 total)
From layout:
- [x] 7.1 Color System
- [x] 7.2 Consistent Application Branding

## 8. Migrate Requirements to `command-palette` (1 total)
From layout:
- [x] 8.1 Command Palette

## 9. Migrate Requirements to `common-ui` (10 total)
From layout:
- [x] 9.1 Semantic HTML Structure
- [x] 9.2 Collapsible Navigation
- [x] 9.3 Consistent Tooltip System
- [x] 9.4 VueUse Composables
- [x] 9.5 Breadcrumb Navigation
- [x] 9.6 Progressive Web App Support
- [x] 9.7 Reusable DataTable Component

From backend:
- [x] 9.8 Nitro Server API
- [x] 9.9 Data Fetching Patterns

New:
- [x] 9.10 Spec Organization by Domain

## 10. Retire Old Specs
- [x] 10.1 Delete `openspec/specs/layout/` directory
- [x] 10.2 Delete `openspec/specs/backend/` directory

## 11. Validation
- [x] 11.1 Run `openspec list --specs` to verify new specs are recognized
- [x] 11.2 Run `openspec validate --specs` to verify all specs are valid
- [x] 11.3 Verify requirement count: 8 + 9 + 12 + 7 + 12 + 2 + 1 + 10 = 61 total
- [x] 11.4 Test `openspec show <spec>` for each new spec
