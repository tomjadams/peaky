## Context

The Review Details page currently has a placeholder "History" section. This change implements that section to show assessment session history and enable comparisons between sessions.

Reviews are collaborative, long-running processes. The history feature transforms ORR from a static checklist into a living document that shows the journey toward operational readiness.

## Goals / Non-Goals

### Goals
- Show chronological progress of assessment completion
- Enable comparison between any two points in time
- Attribute changes to specific team members
- Provide quick visual indication of progress velocity

### Non-Goals
- Real-time collaboration (Google Docs style)
- Branching/merging of assessments
- Automatic session creation (sessions are explicit save points)
- Notifications when others make changes

## Visual Design

### Timeline View
```
History
─────────────────────────────────────────────────────────────────────────────

    ●────────────●────────────●────────────●────────────●
 Oct 1        Oct 15       Nov 3        Nov 20       Dec 15
 Started     +12 answers  +8 answers   +15 answers   Today
 (0%)         (22%)        (36%)        (64%)        (78%)
```

- Horizontal timeline with nodes for each session
- Progress percentage shown below each node
- Delta indicators (+N answers) between nodes
- Current state highlighted on the right

### Session Cards (Expandable)
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Dec 15, 2025 · Sarah Chen                                    [Compare] │
│  ├─ Infrastructure: 100% → 100% (no change)                             │
│  ├─ Reliability: 50% → 67% (+2 answers)                                 │
│  ├─ Security: 50% → 50% (no change)                                     │
│  └─ Operations: 0% → 0% (no change)                                     │
│                                                                         │
│  Note: "Completed reliability runbook documentation"                    │
└─────────────────────────────────────────────────────────────────────────┘
```

- Collapsed by default, showing date/author/summary
- Expandable to show per-pillar deltas
- Optional session note (user-provided context)
- "Compare" button to select for diff view

### Diff View (Modal or Inline)
```
Comparing: Nov 20 → Dec 15

┌─────────────────────────────────────────────────────────────────────────┐
│ Reliability Pillar                                           +17% ↑    │
├─────────────────────────────────────────────────────────────────────────┤
│  Q: Do you have runbooks for common failure scenarios?                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ - No                                                             │   │
│  │ + Yes                                                            │   │
│  │                                                                  │   │
│  │ + Evidence: "See runbooks in /docs/runbooks/"                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

- Git-like diff showing answer changes
- Added content in green, removed in red
- Grouped by pillar with progress delta badges
- Collapsible sections for large diffs

## Decisions

### Session Creation Strategy
- **Decision**: Sessions are created explicitly when user clicks "Save Progress" AND there are actual changes
- **Rationale**: Automatic snapshots would create noise; view-only visits should not pollute history
- **Alternative considered**: Auto-snapshot with squashing - rejected due to complexity

**Session creation rules:**
1. Sessions MUST only be created when at least one answer differs from the previous session
2. "View only" visits (opening assessment without answering) MUST NOT create sessions
3. A "Save Progress" button triggers session creation (not auto-save on every keystroke)
4. Backend MUST compare new answers against last session snapshot before persisting
5. If no changes detected, save operation succeeds but no new session is created

**Why this matters:**
- Prevents DB/storage bloat from empty sessions
- Keeps history timeline meaningful (each node = real progress)
- Avoids "noise" in team activity (advisors checking progress shouldn't create entries)
- Reduces backend costs in production

### Data Storage
- **Decision**: Store full snapshots, not deltas
- **Rationale**: Simpler queries, no reconstruction needed, storage is cheap
- **Alternative considered**: Delta-only storage - rejected due to query complexity and potential corruption cascades

### Timeline Visualization
- **Decision**: Horizontal timeline with expandable session cards below
- **Rationale**: Matches mental model of time flowing left-to-right; cards provide detail on demand
- **Alternative considered**: Vertical timeline (like GitHub activity) - considered for mobile but horizontal works better for showing velocity

### Diff Algorithm
- **Decision**: Question-level diff, not character-level
- **Rationale**: Meaningful unit of change is a question answer, not text fragments
- **Alternative considered**: Character-level diff - too granular, hard to understand

## Data Model

```typescript
interface AssessmentSession {
  id: string;
  reviewId: string;
  templateId: string; // Links to specific template in multi-template reviews
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  snapshot: {
    overallProgress: number;
    pillars: Array<{
      slug: string;
      name: string;
      progress: number;
      totalQuestions: number;
      answeredQuestions: number;
    }>;
    answers: Array<{
      questionId: string;
      value: string | boolean | string[];
      evidence?: string;
      attachments?: string[];
    }>;
  };
  delta: {
    questionsAnswered: number;
    questionsChanged: number;
    progressDelta: number; // e.g., +12
  };
  note?: string; // Optional user-provided context
}
```

## API Endpoints

```
GET /api/reviews/:reviewId/sessions
  → List all sessions for a review (paginated)

GET /api/reviews/:reviewId/sessions/:sessionId
  → Get specific session with full snapshot

GET /api/reviews/:reviewId/sessions/compare?from=:id1&to=:id2
  → Get diff between two sessions

POST /api/reviews/:reviewId/sessions
  → Create new session (snapshot current state)
```

## Risks / Trade-offs

### Storage Growth
- **Risk**: Each session stores full snapshot, could grow large
- **Mitigation**: Implement retention policy (e.g., keep all for 1 year, then thin to monthly snapshots)

### Performance
- **Risk**: Loading many sessions with full snapshots could be slow
- **Mitigation**: Paginate sessions, lazy-load full snapshots on expand

### Complexity
- **Risk**: Diff view adds significant UI complexity
- **Mitigation**: Start with simple session list, add diff view in follow-up iteration

## Implementation Phases

### Phase 1: Foundation
- Data model and mock data
- Basic session list (no timeline)
- Session cards with pillar deltas

### Phase 2: Timeline
- Horizontal timeline visualization
- Interactive node selection
- Progress velocity indicators

### Phase 3: Diff View
- Compare mode selection
- Question-level diff rendering
- Evidence/attachment diff display

## Open Questions

1. Should sessions be per-review or per-template (for multi-template reviews)?
   - Leaning toward per-template for granular tracking
   
2. How to handle concurrent edits by multiple team members?
   - Consider optimistic locking or last-write-wins for MVP
   
3. Should there be a "restore to session" feature?
   - Useful but adds complexity; defer to future iteration
