# User Testing

**What belongs here:** Testing surface, tools, URLs, setup steps, known quirks.

---

## Testing Surface

- **Dev server:** <http://localhost:3000> (must be running before testing)
- **Tool:** agent-browser (via the playwright-cli skill)

## Key Pages

- **Teams dashboard:** <http://localhost:3000/teams>
- **Team detail:** <http://localhost:3000/teams/>[teamId]
- **Review creation:** <http://localhost:3000/teams/>[teamId]/reviews/new
- **Assessment:** <http://localhost:3000/teams/>[teamId]/reviews/[reviewId]
- **Applications:** accessible via sidebar navigation
- **Templates:** accessible via sidebar navigation

## API Endpoints (for curl testing)

- `GET /api/templates` — list templates
- `POST /api/templates` — create template
- `PUT /api/templates/[id]` — update template
- `POST /api/templates/[id]/publish` — publish template
- `GET /api/applications` — list applications
- `POST /api/applications/bulk/archive` — archive apps
- `POST /api/applications/bulk/delete` — delete apps
- `POST /api/applications/bulk/transfer` — transfer apps
- `GET /api/reviews/[id]/questions` — get review questions (with answers after persistence)
- `POST /api/reviews/[id]/answers` — save answer (NEW)
- `PUT /api/reviews/[id]/pillars/[slug]/progress` — save progress (NEW)

## Known Quirks

- Dev server must be started separately (`pnpm dev`); not auto-started by tests
- Template auto-save has 2s debounce — wait before verifying
- In-memory stores reset on server restart — restarting server resets all mutations to seed data
- Application store has 8 seed apps: app-001 through app-008
- Template store has 4 seed templates: template-001 through template-004

## Flow Validator Guidance: API

**Testing tool:** Use `curl` directly for all API testing in this milestone. No browser testing needed for core-stores — all assertions are about API-level persistence.

**Isolation rules:**

- Each subagent operates on a separate API surface (templates vs applications)
- Template subagent: ONLY use template endpoints. Create new templates with unique names (prefix with subagent group).
- Application subagent: ONLY use application endpoints. Use specific app IDs for mutations to avoid interfering with other tests.
- Do NOT restart the dev server during testing — it resets all in-memory state.

**Request format for applications bulk endpoints:**

```bash
# Bulk operations use { "ids": ["app-001", "app-002"] } format
curl -X POST http://localhost:3000/api/applications/bulk/delete \
  -H 'Content-Type: application/json' \
  -d '{"ids": ["app-001"]}'
```

**Request format for template endpoints:**

```bash
# Create template
curl -X POST http://localhost:3000/api/templates \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test Template", "description": "Test", "pillars": ["security"]}'

# Update template
curl -X PUT http://localhost:3000/api/templates/template-001 \
  -H 'Content-Type: application/json' \
  -d '{"name": "Updated Name", "description": "Updated"}'

# Publish template
curl -X POST http://localhost:3000/api/templates/template-001/publish
```

**Evidence collection:** For each assertion, record:

1. The curl command run
2. The HTTP status code
3. The response body (or relevant excerpt)
4. Whether the assertion passed or failed with explanation

## Flow Validator Guidance: Assessment API

**Testing tool:** Use `curl` directly for all assessment API testing. The assertions test server-side persistence of answers and progress data.

**Available reviews and their question IDs:**

| Review ID | Template | Questions (id: type) |
|-----------|----------|---------------------|
| review-002 | PCI-DSS (draft) | q-pci-sec-001: yes-no, q-pci-sec-002: yes-no, q-pci-inf-001: yes-no, q-pci-ops-001: yes-no |
| review-005 | SOC 2 (draft) | q-soc-sec-001: yes-no, q-soc-sec-002: yes-no, q-soc-ops-001: yes-no, q-soc-inf-001: yes-no |
| review-006 | Peak Season (in-progress) | q-rel-001: yes-no, q-rel-002: yes-no, q-rel-003: yes-no, q-rel-004: checklist, q-sec-001: yes-no, q-sec-002: yes-no, q-sec-003: checklist, q-inf-001: yes-no, q-inf-002: yes-no, q-ops-001: yes-no, q-ops-002: yes-no |
| review-008 | GDPR Audit (draft) | q-gdpr-sec-001: yes-no, q-gdpr-sec-002: yes-no, q-gdpr-ops-001: yes-no, q-gdpr-ops-002: yes-no |

**Checklist question items (for review-006 q-rel-004 and q-sec-003):**

- q-rel-004 checklist items: cli-1, cli-2, cli-3, cli-4, cli-5
- q-sec-003 checklist items: cli-sec-1, cli-sec-2, cli-sec-3, cli-sec-4

**Answer formats:**

```bash
# Yes/No answer
curl -X POST http://localhost:3000/api/reviews/{reviewId}/answers \
  -H 'Content-Type: application/json' \
  -d '{"questionId": "q-xxx", "answer": "yes"}'

# NA answer with reason
curl -X POST http://localhost:3000/api/reviews/{reviewId}/answers \
  -H 'Content-Type: application/json' \
  -d '{"questionId": "q-xxx", "answer": "na", "naReason": "not-applicable"}'

# Checklist answer
curl -X POST http://localhost:3000/api/reviews/{reviewId}/answers \
  -H 'Content-Type: application/json' \
  -d '{"questionId": "q-xxx", "answer": {"checked": ["cli-x-1", "cli-x-2"], "na": []}}'

# Save progress
curl -X PUT http://localhost:3000/api/reviews/{reviewId}/pillars/{pillarSlug}/progress \
  -H 'Content-Type: application/json' \
  -d '{"progress": 100, "answeredQuestions": 3, "totalQuestions": 3}'
```

**Verify answers persist via GET:**

```bash
curl http://localhost:3000/api/reviews/{reviewId}/questions | jq '.questions[] | select(.id == "q-xxx") | {id, answer, naReason}'
```

**Isolation rules:**

- Subagent A (assessment-answers): Use review-006 exclusively for answer persistence tests (VAL-ASM-001 through VAL-ASM-004, VAL-ASM-006, VAL-ASM-007)
- Subagent B (assessment-progress-and-cross): Use review-005 and review-008 for progress/cross-area tests (VAL-ASM-005, VAL-CROSS-001, VAL-CROSS-002)
- Do NOT restart the dev server — it resets all in-memory state
- Do NOT use review-001 — it already has test answers saved to it

**Creating reviews for CROSS tests:**

```bash
# Create a review for a team
curl -X POST http://localhost:3000/api/teams/{teamId}/reviews \
  -H 'Content-Type: application/json' \
  -d '{"name": "Test Review Name", "templateIds": ["template-001"]}'
```

**Teams available:** team-customer-portal, team-mobile-experience, team-payment-gateway, team-api-foundation, team-reporting
