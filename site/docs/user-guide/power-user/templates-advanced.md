# Template import and export

Beyond Question authoring, Template Studio provides Markdown import/export for sharing draft Revisions across teams and external editing workflows.

## Import and export

A draft Revision is a complete local snapshot of Template metadata, Pillars, and Questions. It can be exported as ^^markdown^^ and imported into another editable draft. This is useful for:

- Sharing a proven template across teams or organizations
- Version-controlling templates in Git alongside your code
- Reviewing template changes in pull requests before publishing

### The markdown format

Exported templates follow a simple, human-readable structure:

```markdown
# Template: Peak Season 2026

> A readiness template for high-traffic events.

## Pillar: Reliability

### SEC-1 — Do you have automated failover?

- **Risk Level**: Critical
- **Why This Matters**: Failover prevents extended outages during peak.
- **Leading Practices**: Test failover monthly. Document RTO targets.
- **Helpful Links**: [Failover runbook](https://wiki.example.com/failover)

### SEC-2 — Has load testing been completed at 2x peak?

- **Risk Level**: High
- **Why This Matters**: Untested capacity assumptions fail under real load.

## Pillar: Security

### SEC-3 — Is production access logged and reviewed?

- **Risk Level**: Critical
```

Each `## Pillar:` becomes a pillar. Each `###` heading becomes a question. The metadata fields (`Risk Level`, `Why This Matters`, etc.) map directly to the Template Studio fields.

### Exporting

From an editable draft in Template Studio, click the Markdown button. The export modal shows the full draft snapshot as Markdown — copy it to your clipboard or save it to a file.

!!! danger "Markdown is the backup for local-only authoring"
    Drafts do not upload or sync. Export before clearing site storage, recreating the local database, changing browser profiles, or applying a destructive Preview data reset. Otherwise the unpublished draft is permanently lost.

### Importing

Switch to the **Import** tab in the same modal. Paste your Markdown and click import. Peaky replaces the mutable in-memory draft structure with the supported metadata, Pillars, Questions, Question types, checklist items, leading practices, and helpful links from the document. The next local save reconciles the structured rows atomically. Published and retired Revisions are immutable and cannot receive imports. If the format is invalid (say, missing `## Pillar:` headers), you'll see a parse error with details.

Legacy exports containing a `## Rules` section are rejected because Template Rules are no longer supported. Remove that section before importing; Peaky rejects the document before applying partial draft state.

!!! warning "Import does not publish"
    Import, local save, and preview leave the Revision in `draft`. Publication and Template archive, restore, and delete are currently unavailable; direct calls fail without changing data.

!!! tip "Collaborative authoring with Google Docs"
    For templates that need input from multiple stakeholders (compliance, engineering, product), draft in Google Docs first. Use heading levels to match the markdown format — `Heading 2` for pillars, `Heading 3` for questions. When the draft is ready, export as markdown from Google Docs and import into Peaky.

    This lets non-technical stakeholders contribute to template design without needing access to the Template Studio.

!!! tip "Templates are yours"
    The export format is plain markdown — no vendor lock-in. You can edit exported templates in any text editor, store them in Git, review in pull requests, and re-import into any Peaky instance.
