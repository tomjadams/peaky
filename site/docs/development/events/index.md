# Domain Events

Peaky uses an append-only domain event log to track significant state changes on event-enabled paths. Events are the source of truth for audit trails, the admin activity feed, and future integrations.

Current Template draft authoring is an explicit bounded exception: `LocalMutation.localOnly()` writes Template, draft Revision, Pillar, and Question state without an event or outbox row until issue #137 adds transport. The one-time Preview Template/Revision migration removes its enumerated legacy Template/Review event and replay rows plus every event correlated through a non-null `review_id`, regardless of event or entity type. Unrelated events are preserved only when `review_id` is null; ordinary runtime event retention remains append-only.

## Structure

Every event shares a common envelope and carries a typed `data` payload:

| Field | Description |
|---|---|
| `id` | Unique event ID (UUIDv7) |
| `type` | Event type name (e.g. `ProductCreated.v1`) |
| `specversion` | CloudEvents spec version (`"1.0"`, required) |
| `dataschema` | URL to the JSON Schema for this event's `data` field |
| `source` | Origin — `peaky.client`, `peaky.sync`, etc. |
| `time` | ISO 8601 timestamp |
| `actorId` | ID of the user or system that triggered the event |
| `actorType` | `user`, `integration`, or `system` |
| `entityType` | Kind of the subject entity (e.g. `product`, `review`) |
| `entityId` | Stable ID of the subject entity |
| `reviewId` | Cross-entity correlation key (links sub-entity events to their parent review) |
| `clientId` | Browser session identifier |
| `data` | Typed payload — shape varies per event type |

## Type naming

Event types follow the `EventName.v1` convention (PascalCase + version suffix), aligned with Amazon EventBridge routing patterns. The version suffix makes breaking changes explicit and allows routing rules to pin to a specific schema generation.

## JSON Schemas

Each event type has a machine-readable JSON Schema for its `data` payload, served at its `dataschema` URL:

```text
https://orr-sample.vercel.app/schemas/{EventName.v1}.json
```

These are generated from Zod schemas via `pnpm events:schemas` and committed alongside the code.

## CloudEvents alignment

Peaky events follow [CloudEvents v1.0.2](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md). The envelope uses CloudEvents **core attributes** alongside domain-specific **extension attributes**:

| Attribute | CloudEvents role | Description |
|---|---|---|
| `id` | Core (REQUIRED) | UUIDv7 event identifier |
| `type` | Core (REQUIRED) | Versioned event name, e.g. `ProductCreated.v1` |
| `specversion` | Core (REQUIRED) | Always `"1.0"` |
| `source` | Core (REQUIRED) | Origin — `peaky.client`, `peaky.sync`, or `peaky.system` |
| `time` | Core (OPTIONAL) | ISO 8601 timestamp — always set by the factory |
| `dataschema` | Core (OPTIONAL) | URL to the JSON Schema for the `data` payload |
| `data` | Core | Typed payload — shape varies per event type |
| `actorId` | Extension | ID of the user or system that triggered the event |
| `actorType` | Extension | `user`, `integration`, or `system` |
| `entityType` | Extension | Kind of the subject entity (e.g. `product`, `review`) |
| `entityId` | Extension | Stable ID of the subject entity |
| `reviewId` | Extension | Cross-entity correlation key (links sub-entity events to their parent review) |
| `clientId` | Extension | Browser session identifier |

Extension attributes are top-level JSON members — not nested under a `metadata` object — per the [CloudEvents extensions model](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md#extension-context-attributes).

**Why extensions instead of nesting?** The CloudEvents spec requires that extension attributes are top-level. This keeps events routable by any CloudEvents-aware middleware without needing to understand our domain-specific nesting.

**Why `.v1` in the type instead of a `version` field?** The version suffix in the type string (e.g. `ProductCreated.v1`) follows Amazon EventBridge conventions and allows routing rules to pin to a specific schema generation. A separate `version` field would be redundant.

## Event catalog

### Review operations

| Event | Description |
|---|---|
| `ReviewAnswerRecorded.v1` | Single answer recorded or cleared |
| `ReviewCheckpointSaved.v1` | Batch of answers committed with progress snapshot |
| `ReviewNoteRecorded.v1` | Free-text note created or updated |
| `ReviewNoteDeleted.v1` | Note removed from a scope |
| `ReviewAttachmentUploaded.v1` | File attached to a review scope |
| `ReviewAttachmentDeleted.v1` | Attachment removed |
| `ReviewProgressUpdated.v1` | Per-pillar progress recomputed |
| `ReviewCreated.v1` | New Review header event; exact ordered Revision selections are not transported by this legacy payload |
| `ReviewArchived.v1` | Review moved to archive |
| `ReviewRestored.v1` | Archived review made active again |
| `ReviewDeleted.v1` | Review permanently deleted |

### Product lifecycle

| Event | Description |
|---|---|
| `ProductCreated.v1` | Product created — includes origin, ownership, and linked teams/components |
| `ProductUpdated.v1` | Product metadata changed |
| `ProductArchived.v1` | Product archived |
| `ProductRestored.v1` | Archived product restored |
| `ProductDeleted.v1` | Product permanently deleted |

### Legacy Template lifecycle and authoring

These schema/type names are retained for historical compatibility and inspection. They describe the removed mutable `template_draft` authoring/publication path and are **dormant**: current Template and draft Revision authoring emits none of them, publication/lifecycle writes are unavailable, and no replacement Template event family is introduced by #140.

| Legacy event | Historical meaning |
|---|---|
| `TemplateDraftCreated.v1` | Template draft created |
| `TemplateDraftUpdated.v1` | Template draft metadata changed |
| `TemplateDraftDeleted.v1` | Template draft permanently deleted |
| `TemplatePublished.v1` | Draft promoted to published (`publishedAt` was `time` on the envelope) |
| `TemplateImported.v1` | Template imported from external source |
| `TemplatePillarCreated.v1` | Pillar added to a draft |
| `TemplatePillarUpdated.v1` | Pillar metadata changed |
| `TemplatePillarDeleted.v1` | Pillar removed from a draft |
| `TemplateQuestionCreated.v1` | Question added to a pillar |
| `TemplateQuestionUpdated.v1` | Question content or settings changed |
| `TemplateQuestionDeleted.v1` | Question removed from a pillar |

### System events

| Event | Description |
|---|---|
| `ClientSchemaMigrated.v1` | Emitted after one or more schema migrations are applied on startup. Source is `peaky.system`. See [Upgrades](../walkthroughs/local-first/upgrades) for the full rollout mechanics. |

## GDPR

Events with free-text fields containing potential PII (e.g. `ReviewNoteRecorded.v1`, `ReviewCheckpointSaved.v1` note field) are subject to right-to-erasure processing. When applied, PII fields are overwritten in-place and `piiRedactedAt` is set on the event record. The event itself is retained for audit integrity.
