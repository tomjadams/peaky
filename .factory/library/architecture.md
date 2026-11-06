# Architecture

**What belongs here:** Architectural decisions, patterns discovered during implementation.

---

## Data Layer Pattern

All server-side data lives in `server/data/*.ts` as module-level exports:
- Arrays for collections (e.g., `reviews`, `templates`)
- Objects/Maps for keyed data (e.g., `pillarNotesStore`, `organizationPreferencesById`)
- Seed data initializes on first import, persists for server lifetime
- API routes import and mutate these directly — no ORM, no repository pattern

## Dual-Store Sync Pattern (Templates)

Templates use two parallel data structures that must be kept in sync:
- `templateDetails` — Record keyed by ID, contains full template data (pillars, questions, metadata)
- `templates` — Summary array with subset of fields (id, name, status, version, updatedAt, etc.)

When mutating templates, both structures must be updated. The PUT endpoint currently syncs name/status/updatedAt but not version/description — be aware of this gap if adding fields. The POST endpoint correctly syncs all fields on creation.

## Bulk Action Conventions

Bulk endpoints (delete, archive, transfer) accept `{ ids: string[] }` in the request body. This matches the frontend `useBulkActions.ts` composable. Note: the `applicationIds` field on `ReviewSummary` in `app/models/review.ts` is a different context (review model relationship field), not a bulk action parameter.

## Nuxt Server Routes

- File-based routing: `server/api/[resource]/[action].method.ts`
- Validation: Zod schemas in `server/utils/schemas.ts` for complex objects; manual if-checks acceptable for simple bulk endpoints
- Error handling: H3 `createError` for HTTP errors
- Types: imported from `app/models/` when shared type exists; server-only types (e.g., `ApplicationRecord`) can be defined locally in `server/data/`
