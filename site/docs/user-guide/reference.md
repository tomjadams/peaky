# Reference

Use this page to look up statuses, roles, risk levels, and terminology when you need a quick answer without reading a full guide.

## Review statuses

| Status | Description | Can proceed? |
|--------|-------------|-------------|
| **Draft** | Created but no questions answered | No |
| **In Progress** | Questions being answered | No |
| **Completed** | All questions have responses | Yes, if gaps are accepted |
| **Archived** | Cycle is over, review preserved for history | N/A |

## Risk levels

| Level | What it signals | If "No" |
|-------|----------------|---------|
| **Critical** | Outages, data loss, or major compliance violations | Stop — fix first |
| **High** | Significant risk before the target date | Likely needs remediation |
| **Medium** | Operational debt, increasing risk over time | Plan to address |
| **Low** | Best practice improvement | Track for next cycle |

## Participant roles

| Role | What they do | Typically filled by |
|------|-------------|-------------------|
| **Assessor** | Answers questions based on current state | Engineers, process owners, compliance analysts |
| **Advisor** | Reviews answers, shares context, identifies blind spots | Staff+ engineers, domain experts, compliance leads |
| **Template author** | Designs the assessment framework | Engineering leads, compliance PMs, UX designers |
| **Review creator** | Assigns products/teams to templates, tracks progress | Product managers, TPMs, engineering leads |

## Question types

=== "Yes / No"

    Binary assessment of a single requirement.

    | Field | Description |
    |-------|-------------|
    | Question text | The requirement to assess |
    | Risk level | Critical, High, Medium, or Low |
    | Why this matters | Context for the assessor |
    | Leading practices | What "good" looks like |
    | Helpful links | Resources and documentation |

    Answers: **Yes** (met), **No** (not met), **N/A** (not applicable — reason required)

=== "Checklist"

    Multiple leading practices to confirm within a single question.

    | Field | Description |
    |-------|-------------|
    | Question text | The overall requirement |
    | Leading practices | 3-5 specific practices to confirm |
    | Risk level | Applies to the question as a whole |

    Complete when all leading practices are checked or the entire question is marked N/A.

## N/A reasons

| Reason | When to use |
|--------|-------------|
| **Not in scope** | Applies to a different type of system |
| **Handled by infrastructure** | A platform team manages this |
| **Legacy system** | Predates this requirement |
| **Pending deprecation** | System is being retired |
| **Other** | Custom reason — add a comment |

## Glossary

| Term | Definition |
|------|-----------|
| **Application** | A service or system linked to a product |
| **Assessment** | The act of working through questions in a review |
| **Advisor** | A participant who reviews answers and provides guidance |
| **Assessor** | A participant who answers questions based on current state |
| **Command palette** | Quick-access search and navigation, opened with Cmd+K / Ctrl+K |
| **Gap** | A question answered "No" — a readiness risk to address |
| **Organization** | A top-level grouping of teams |
| **Pillar** | A category within a template |
| **Product** | The thing being assessed — a system, process, or initiative |
| **Review** | A point-in-time assessment against a template |
| **Session** | A saved snapshot of assessment progress with timestamp and comment |
| **Survey mode** | Focused assessment view showing one question at a time |
| **Template** | A reusable framework defining what to assess |
| **Team** | An organizational unit that owns products and participates in reviews |
