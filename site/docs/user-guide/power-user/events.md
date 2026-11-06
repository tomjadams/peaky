# Events and audit trail

This page is your audit trail for event-enabled actions — answering a question, archiving a review, changing a Product, or the local engine starting up produces a ^^domain event^^ that lands here.

Template draft authoring is currently local-only and does not produce events or sync work. Publication and Template lifecycle actions are unavailable, so the feed cannot be used as evidence that an unpublished draft is backed up or published.

![Events page](../../assets/images/events-page.png#only-light)
![Events page (dark)](../../assets/images/events-page-dark.png#only-dark)

Filter by category, action, source, or actor to narrow the feed. There is no separate "admin" view — every member sees the same events sourced from their own browser.

!!! example "What you can find here"
    - Who changed an answer on a specific review, and when
    - Whether a Product or Review lifecycle action occurred
    - Which products were created or modified in the last week
    - Why your local database stalled or recovered (filter by `peaky.system`)

That should be more than enough to debug most "wait, what just happened?" moments.

!!! info "Wanna build integrations or learn the shape?"
    The rest of this page covers event schemas, the envelope structure, GDPR handling, and a reference table of common types. Skip if you only came for the feed.

## Event schemas

Every event type has a machine-readable JSON Schema at `/schemas`. Browse them, or grab a URL like:

```text
/schemas/{EventName.v1}.json
```

!!! tip "Bookmark `/schemas`"
    Always in sync with the running app. Fastest way to see what an event carries when you're building an integration or debugging an unfamiliar type.

## Event anatomy

Every event is a ^^CloudEvents-aligned envelope^^ with a typed `data` payload. You don't need the internals to read the feed, but the shape helps when you're building integrations.

=== "Envelope"

    ```json
    {
      "id": "evt_01HZ...",                       // (1)!
      "type": "ReviewAnswerRecorded.v1",         // (2)!
      "specversion": "1.0",
      "source": "peaky.client",                  // (3)!
      "time": "2026-04-30T14:30:00.000Z",
      "actorType": "user",
      "actorId": "heitorl",
      "entityType": "review_answer",
      "entityId": "review-1:question-2",
      "reviewId": "01932b3c-..."                 // (4)!
    }
    ```

    1. UUIDv7 — sortable by creation time
    2. Versioned event type — `PascalCase.v1` convention
    3. `peaky.client` (this browser), `peaky.sync` (received from server during a pull), or `peaky.system` (engine internals)
    4. Cross-entity correlation key for review-scoped events

=== "Payload"

    ```json
    {
      "questionId": "SEC-1",
      "answer": "yes",
      "pillarSlug": "security"
    }
    ```

    Shape varies by event type. `/schemas` has the canonical definition for every one.

## Live tail

Click **Live tail** in the Events header to follow new events as they arrive.

!!! example "When live tail earns its keep"
    You're reproducing a bug. Open `/events` in a tab, hit Live tail, then walk through the steps in another tab — every event fires in real time and you can see exactly which one failed.

## Session history

Session history (visible on the review detail page) is built from these events. Each save captures what fired since the last checkpoint. Session comments matter because they sit alongside the trail and add the human "why".

## GDPR and data handling

The event log is append-only — but the right to erasure is not optional. We solve it with two patterns.

!!! info "1. Minimise free-text in events"
    Where it's reasonable, we capture metadata (counts, IDs, hashes) instead of full text. Pillar notes are the deliberate exception — `ReviewNoteRecorded.v1` stores the full `content` because notes are short and the redaction path below handles erasure cheaply.

!!! info "2. Erase residual PII via redaction, not deletion"
    When a user requests erasure, Peaky overwrites PII fields in place. The row itself stays so audit integrity holds.

```json
{
  "type": "ReviewNoteRecorded.v1",
  "actorName": "[Redacted]",                              // (1)!
  "actorId": "heitorl",                                   // (2)!
  "data": {
    "scopeType": "pillar",
    "scopeId": "reliability",
    "content": "[Redacted — GDPR erasure]"                // (3)!
  },
  "piiRedactedAt": "2026-05-01T10:00:00.000Z",
  "piiRedactedBy": "ops-001"
}
```

1. Human-readable name → tombstoned
2. Stable principal ID → kept (GDPR Recital 49, legitimate interest — an audit log without a principal isn't an audit log)
3. Free-text content → replaced inline; `eventType`, `time`, `entityId` all survive

!!! note "What about deletions?"
    When a review or attachment is permanently deleted, its events stay. They reference the deleted resource by ID — they're ^^tombstones^^ proving the resource existed and what happened to it.

## Common event types

The full catalog is at `/schemas`. The frequent ones:

| Event type | When it fires |
|-----------|---------------|
| `ReviewAnswerRecorded.v1` | A question is answered (Yes/No/N/A) or cleared |
| `ReviewCheckpointSaved.v1` | A session snapshot is committed |
| `ReviewNoteRecorded.v1` | A pillar note is saved |
| `ReviewAttachmentUploaded.v1` | Evidence is attached to a pillar |
| `ReviewProgressUpdated.v1` | Pillar progress is recomputed after a checkpoint |
| `ReviewCreated.v1` / `ReviewArchived.v1` / `ReviewDeleted.v1` | Review lifecycle |
| `ProductCreated.v1` / `ProductUpdated.v1` / `ProductDeleted.v1` | Product lifecycle |
| `TemplatePublished.v1` / `TemplateImported.v1` | Legacy Template schemas retained for historical records; dormant for current authoring |
| `LocalDbReady.v1` / `LocalDbMigrationFailed.v1` | Local engine bootstrap (also visible on `/system`) |
| `SyncCycleSucceeded.v1` / `SyncCycleFailed.v1` | Background sync results |

Engine internals (`peaky.system` source) appear here too — `/system` just summarises them as four glance tiles for quicker reading.
