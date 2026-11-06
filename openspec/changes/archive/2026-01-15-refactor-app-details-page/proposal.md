# Refactor Application Details Page

## Why
The current card-based layout for reviews doesn't scale well as more data is added (snapshots, reviewers, etc.). Cards lack common UX patterns like filtering, search, and sorting that users expect for managing collections of items.

## What
- Replace review cards with a data table supporting search, filtering, and sorting
- Enhance metric cards with subtle gradient borders for visual distinction
- Establish a repeatable section pattern for future additions (e.g., Reports section)
- Prepare the page structure to accommodate future data like snapshots and reviewers

## Impact
- **layout spec**: Modifies Application Details Page and Review Card requirements
- **app/pages/applications/[id].vue**: Refactored layout with table
- **app/components/**: New or modified table components for reviews
