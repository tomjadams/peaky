-- +goose Up
-- Add root_type / root_id to events: resolved root reference for pull scoping.
-- Root types are self-rooted; child types resolve to their parent root type
-- and the {rootId} prefix of their composite entity_id (before the first ':').
--
-- NOTE: 'team' is included as a self-rooted type solely to backfill the legacy
-- seed event (entity_type='team', see seed/001_demo_data.sql). Teams are NOT a
-- Peaky-managed entity or a pull root. When the sse-family-catalog follow-up
-- removes the 'team' entity_type from the seed and events, the CASE branches
-- for 'team' here become dead code but are harmless to leave until a cleanup
-- migration drops them.

ALTER TABLE events ADD COLUMN root_type TEXT;
ALTER TABLE events ADD COLUMN root_id   TEXT;

-- Set-based backfill: map each entity_type to its root_type and derive root_id.
UPDATE events SET
  root_type = CASE entity_type
    -- root types: self-rooted
    WHEN 'review'              THEN 'review'
    WHEN 'product'             THEN 'product'
    WHEN 'template'            THEN 'template'
    WHEN 'template_draft'      THEN 'template_draft'
    WHEN 'team'                THEN 'team'
    -- child types: resolve to parent root type
    WHEN 'review_answer'       THEN 'review'
    WHEN 'review_note'         THEN 'review'
    WHEN 'review_attachment'   THEN 'review'
    WHEN 'review_checkpoint'   THEN 'review'
    WHEN 'template_draft_pillar'   THEN 'template_draft'
    WHEN 'template_draft_question' THEN 'template_draft'
  END,
  root_id = CASE entity_type
    -- root types: root_id = entity_id (self)
    WHEN 'review'              THEN entity_id
    WHEN 'product'             THEN entity_id
    WHEN 'template'            THEN entity_id
    WHEN 'template_draft'      THEN entity_id
    WHEN 'team'                THEN entity_id
    -- child types: root_id = prefix before first ':'
    WHEN 'review_answer'       THEN split_part(entity_id, ':', 1)
    WHEN 'review_note'         THEN split_part(entity_id, ':', 1)
    WHEN 'review_attachment'   THEN split_part(entity_id, ':', 1)
    WHEN 'review_checkpoint'   THEN split_part(entity_id, ':', 1)
    WHEN 'template_draft_pillar'   THEN split_part(entity_id, ':', 1)
    WHEN 'template_draft_question' THEN split_part(entity_id, ':', 1)
  END
WHERE entity_type IS NOT NULL;

-- Non-entity-scoped events (entity_type IS NULL, e.g. system events) get a
-- synthetic self-root so the table-wide NOT NULL invariant below holds. They
-- stay unreachable by every pull: pullEventRows always filters
-- `entity_type IS NOT NULL`, so root_type='system' never matches a pull scope.
UPDATE events SET
  root_type = 'system',
  root_id = id
WHERE entity_type IS NULL;

-- Guard: fail loudly if any event still has a null root after both backfills
-- above. This now also catches an entity_type value the CASE mapping doesn't
-- recognize (schema drift), which would otherwise leave root_type/root_id
-- null despite entity_type being non-null.
-- +goose StatementBegin
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT count(*) INTO null_count
  FROM events
  WHERE root_type IS NULL OR root_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill guard failed: % events have null root_type/root_id after backfill',
      null_count
      USING HINT = 'Each event must resolve to a root. Check for unknown entity_type values in the events table.';
  END IF;
END $$;
-- +goose StatementEnd

-- Enforce non-null roots: every event must have a root reference.
ALTER TABLE events ALTER COLUMN root_type SET NOT NULL;
ALTER TABLE events ALTER COLUMN root_id SET NOT NULL;

-- +goose Down
ALTER TABLE events ALTER COLUMN root_id DROP NOT NULL;
ALTER TABLE events ALTER COLUMN root_type DROP NOT NULL;
ALTER TABLE events DROP COLUMN IF EXISTS root_id;
ALTER TABLE events DROP COLUMN IF EXISTS root_type;
