# Change: Add History/Lineage Feature to Review Details

## Why

Reviews are rarely completed in one session. Teams work on assessments over days or weeks, and advisors need visibility into progress over time. Currently there's no way to see:
- When progress was made and by whom
- What changed between sessions
- How the assessment evolved toward completion

This makes it hard for advisors to provide targeted guidance and for teams to understand their journey toward operational readiness.

## What Changes

- Add assessment session tracking (snapshots of progress at save points)
- Add timeline visualization showing progress over time
- Add session cards showing who made changes and what changed
- Add diff view to compare any two sessions
- Extend data model with `AssessmentSession` entity

## Impact

- Affected specs: `layout` (Review Details page)
- Affected code: 
  - `app/pages/applications/[appId]/reviews/[reviewId]/index.vue` (History section)
  - `app/models/` (new session types)
  - `server/api/` (new endpoints for sessions)
  - `server/data/` (mock session data)
