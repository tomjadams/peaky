-- Sync repo queries — managed by sqlc.
-- Run `make gen:sqlc` to regenerate internal/syncengine/db/ after editing this file.
--
-- NOT included here (genuinely dynamic SQL, kept in postgres.go):
--   pullEventRows  — variable-length entity_id IN clause
--   attachFields   — tuple IN clause: (entity_type, entity_id) IN (...)

-- name: GetFieldVersion :one
SELECT entity_type, entity_id, field_name, value, hlc, actor_id
FROM field_versions
WHERE entity_type = $1 AND entity_id = $2 AND field_name = $3
LIMIT 1;

-- name: UpsertFieldVersion :exec
-- WHERE clause ensures atomic HLC-wins check: a concurrent push with a newer
-- HLC that lands between our read and write cannot be silently overwritten.
INSERT INTO field_versions (id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET
    value      = EXCLUDED.value,
    hlc        = EXCLUDED.hlc,
    actor_id   = EXCLUDED.actor_id,
    updated_at = EXCLUDED.updated_at
WHERE EXCLUDED.hlc > field_versions.hlc
   OR (EXCLUDED.hlc = field_versions.hlc AND EXCLUDED.actor_id > field_versions.actor_id);

-- name: GetCursor :one
SELECT cursor_value FROM sync_cursors WHERE actor_id = $1 LIMIT 1;

-- name: SaveCursor :exec
INSERT INTO sync_cursors (actor_id, cursor_value, updated_at)
VALUES ($1, $2, $3)
ON CONFLICT (actor_id) DO UPDATE SET
    cursor_value = EXCLUDED.cursor_value,
    updated_at   = EXCLUDED.updated_at;

-- name: SaveEvent :exec
INSERT INTO events
    (id, specversion, event_type, actor_type, actor_id, time, status, source, entity_type, entity_id, root_type, root_id, operation)
VALUES ($1, '1.0', $2, 'user', $3, $4, 'synced', 'peaky.sync', $5, $6, $7, $8, $9)
ON CONFLICT (id) DO NOTHING;

-- name: FindAttachmentReview :one
SELECT review_id FROM review_attachments WHERE id = $1 LIMIT 1;

-- name: GetReviewParticipantRole :one
-- Server-side review-participants lookup behind the action-specific Advisor
-- override policy (authorization/REQ-008; AC-024). Returns the actor's
-- current persisted role ('assessor' | 'reviewer') on the review, or no row
-- when the actor is not a current participant. review_participants has no
-- UNIQUE (review_id, actor_id), so ties are broken deterministically: the
-- most recently created row wins (latest role, never a stale demotion).
SELECT role FROM review_participants
WHERE review_id = $1 AND actor_id = $2
ORDER BY created_at DESC, id DESC
LIMIT 1;

