# Automation and integration

Peaky is designed to be part of a larger operational workflow, not a standalone silo. While the integration surface is still growing, the foundations are in place — and you can start building on them today.

## What's available today

| Capability | Status |
|-----------|--------|
| Event audit trail (CloudEvents-aligned) | Available |
| JSON schemas for all event types at `/schemas` | Available |
| Markdown template export/import | Available |
| Read APIs for reviews, products, published Template fixtures, and events | Available |
| Template create/update/publication/lifecycle API | Frozen — returns `template_write_unavailable` |
| Local-first offline sync | Available for enabled Review/Product fields; not Template drafts or exact Review selections |

## Exploring the API

Peaky's API follows RESTful conventions. Here are a few examples to get started — try them against your instance.

### List all events

=== "cURL"

    ```bash
    curl -s https://your-peaky-instance/api/events \
      -H "x-actor-id: your-id" \
      -H "x-actor-name: Your Name" \
      -H "x-actor-roles: admin" | jq '.[:3]'
    ```

=== "Response"

    ```json
    [
      {
        "id": "evt-001",
        "eventType": "AnswerRecorded",
        "reviewId": "01932b3c-...",
        "actorId": "heitorl",
        "actorName": "Heitor Lessa",
        "timestamp": "2026-04-03T14:30:00Z",
        "details": { "questionId": "SEC-1", "answer": "yes" }
      }
    ]
    ```

### Get a specific review

=== "cURL"

    ```bash
    curl -s https://your-peaky-instance/api/reviews/01932b3c-... \
      -H "x-actor-id: your-id" | jq
    ```

=== "Response"

    ```json
    {
      "id": "01932b3c-...",
      "name": "Q4 Peak Season — Payments",
      "status": "in-progress",
      "templates": [
        {
          "templateId": "01932b3c-...",
          "templateRevisionId": "01932b3c-...",
          "revisionNumber": 1,
          "pillars": [
            { "slug": "reliability", "progress": 75 },
            { "slug": "security", "progress": 40 }
          ]
        }
      ]
    }
    ```

### Browse event schemas

=== "cURL"

    ```bash
    # List available schemas
    curl -s https://your-peaky-instance/schemas/ReviewCreated.v1.json | jq
    ```

=== "Response"

    ```json
    {
      "$schema": "https://json-schema.org/draft-07/schema#",
      "title": "ReviewCreated.v1",
      "type": "object",
      "properties": {
        "type": { "const": "ReviewCreated.v1" },
        "source": { "enum": ["ui", "api", "integration"] },
        "data": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "subjectId": { "type": "string" }
          }
        }
      }
    }
    ```

!!! note "Authentication"
    The examples above use header-based actor identity (`x-actor-*`), which is the current simulator model. In production, these will be replaced with signed JWT tokens. The API shape stays the same — only the auth mechanism changes.

## Common integration patterns

**1/ Post to Slack when a review completes** — poll the events endpoint for `CheckpointSaved.v1` events, check if the review reached 100% progress, and send a Slack notification.

**2/ Block deployment if readiness gaps exist** — in your CI/CD pipeline, fetch the review for the target product and check for "No" answers on Critical-risk questions. Fail the gate if unresolved gaps remain.

**3/ Author templates from Git locally** — store templates as Markdown in your repository and import them into Template Studio. The import updates the local draft Revision only; it does not publish, create an event/outbox row, or make the draft available on another device.

!!! tip "Start simple"
    The most valuable integration is usually the simplest: a cron job that checks for stale reviews (created but not started) and posts a reminder to the team's Slack channel. You can build this with `curl` and `jq` in a few lines.

## What's coming

| Capability | Why it matters |
|-----------|---------------|
| **Webhooks** | Push event notifications to Slack, Jira, PagerDuty when gaps are flagged or reviews complete |
| **Organization dashboard** | Aggregate readiness posture across all products and teams |
| **Compliance report export** | Audit-ready artifacts grouped by control family |
| **Advisor workflow** | Dedicated UI for advisors with per-question annotations |

!!! note "Shape the roadmap"
    The best way to influence priority is to describe the workflow: "When a review with Critical gaps completes, post to our #incidents Slack channel" is more actionable than "we need an API."

## Going deeper

For teams that want to understand the event architecture in depth — how events flow from local writes through the sync protocol to the server — the [auditing walkthrough](../../development/walkthroughs/local-first/auditing.md) covers the full technical model.

The key insight: event-enabled mutations atomically produce state, a domain event, and an outbox entry. Current Template/draft Revision authoring is the explicit state-only exception, so it has neither an event trail nor server recovery until transport is enabled.
