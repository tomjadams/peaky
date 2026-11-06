-- Demo seed data for local development.
--
-- Inserts two entities into the sync event log:
--   • payments-scalability  (team)
--   • 01932b3c-...-000000000001  (product "Demo Payments Scalability")
--
-- The client's sync engine pulls these on first boot, replays them via
-- TeamHandler / ProductHandler, and populates the local OPFS database — no
-- client-side seed plugin needed.
--
-- All statements are idempotent (ON CONFLICT DO NOTHING), so this file can be
-- run multiple times safely.

-- Reset sync cursors so every client does a fresh full pull after reseed.
-- Without this, clients with a cursor from a prior session skip seed events
-- because the pull query is WHERE time > cursor.
DELETE FROM sync_cursors;

-- ── Payments Scalability team ────────────────────────────────────────────────
-- Canonical LDAP ID:  payments-scalability
-- Legacy Workday ID:  TS_Payments_Scalability (filtered from catalog snapshot)
--
-- TODO(sse-family-catalog): `team` is not a synced entity type or routing
-- family. It is still delivered today only because a wildcard actor's pull
-- returns all events (entitled=nil → no entity_type filter), which the client
-- TeamHandler replays. A follow-up will stop syncing teams as a `team` entity
-- and re-encode this data within the sync/SSE taxonomy (review/template/product).

-- Use ON CONFLICT DO UPDATE to bump `time` to NOW() on every reseed.
-- This guarantees the event is always newer than any existing client cursor.
INSERT INTO events (id, event_type, actor_type, actor_id, time, status, source, entity_type, entity_id, root_type, root_id)
VALUES ('seed-team-payments-scalability', 'SyncEvent.v1', 'system', 'seed', NOW(), 'synced', 'peaky.seed', 'team', 'payments-scalability', 'team', 'payments-scalability')
ON CONFLICT (id) DO UPDATE SET time = NOW();

INSERT INTO field_versions (id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES
  ('seed-fv-team-name',        'team', 'payments-scalability', 'name',        '"Payments Scalability"', '1735689600000:0000', 'seed', NOW()),
  ('seed-fv-team-slug',        'team', 'payments-scalability', 'slug',        '"payments-scalability"',   '1735689600000:0000', 'seed', NOW()),
  ('seed-fv-team-orgid',       'team', 'payments-scalability', 'orgId',       '"org-payments"',         '1735689600000:0000', 'seed', NOW()),
  ('seed-fv-team-orgname',     'team', 'payments-scalability', 'orgName',     '"Payments"',             '1735689600000:0000', 'seed', NOW()),
  ('seed-fv-team-membercount', 'team', 'payments-scalability', 'memberCount', '12',                     '1735689600000:0000', 'seed', NOW())
ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET value = EXCLUDED.value, hlc = EXCLUDED.hlc, actor_id = EXCLUDED.actor_id, updated_at = NOW();

INSERT INTO field_version_events (id, event_id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES
  ('seed-fve-team-name',        'seed-team-payments-scalability', 'team', 'payments-scalability', 'name',        '"Payments Scalability"', '1735689600000:0000:seed', 'seed', NOW()),
  ('seed-fve-team-slug',        'seed-team-payments-scalability', 'team', 'payments-scalability', 'slug',        '"payments-scalability"',   '1735689600000:0000:seed', 'seed', NOW()),
  ('seed-fve-team-orgid',       'seed-team-payments-scalability', 'team', 'payments-scalability', 'orgId',       '"org-payments"',         '1735689600000:0000:seed', 'seed', NOW()),
  ('seed-fve-team-orgname',     'seed-team-payments-scalability', 'team', 'payments-scalability', 'orgName',     '"Payments"',             '1735689600000:0000:seed', 'seed', NOW()),
  ('seed-fve-team-membercount', 'seed-team-payments-scalability', 'team', 'payments-scalability', 'memberCount', '12',                     '1735689600000:0000:seed', 'seed', NOW())
ON CONFLICT (event_id, field_name) DO UPDATE SET value = EXCLUDED.value, hlc = EXCLUDED.hlc, actor_id = EXCLUDED.actor_id, updated_at = NOW();

-- ── Demo Payments Scalability product ────────────────────────────────────────

INSERT INTO events (id, event_type, actor_type, actor_id, time, status, source, entity_type, entity_id, root_type, root_id)
VALUES ('seed-product-demo-payments-scalability', 'SyncEvent.v1', 'system', 'seed', NOW(), 'synced', 'peaky.seed', 'product', '01932b3c-7d00-7000-8000-000000000001', 'product', '01932b3c-7d00-7000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET time = NOW();

INSERT INTO field_versions (id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES
  ('seed-fv-prod-name',   'product', '01932b3c-7d00-7000-8000-000000000001', 'name',   '"Demo Payments Scalability"',            '1735689601000:0000', 'seed', NOW()),
  ('seed-fv-prod-type',   'product', '01932b3c-7d00-7000-8000-000000000001', 'type',   '"product"',                              '1735689601000:0000', 'seed', NOW()),
  ('seed-fv-prod-slug',   'product', '01932b3c-7d00-7000-8000-000000000001', 'slug',   '"01932b3c-7d00-7000-8000-000000000001"', '1735689601000:0000', 'seed', NOW()),
  ('seed-fv-prod-status', 'product', '01932b3c-7d00-7000-8000-000000000001', 'status', '"active"',                               '1735689601000:0000', 'seed', NOW()),
  ('seed-fv-prod-origin', 'product', '01932b3c-7d00-7000-8000-000000000001', 'origin', '"bespoke"',                              '1735689601000:0000', 'seed', NOW())
ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET value = EXCLUDED.value, hlc = EXCLUDED.hlc, actor_id = EXCLUDED.actor_id, updated_at = NOW();

INSERT INTO field_version_events (id, event_id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES
  ('seed-fve-prod-name',   'seed-product-demo-payments-scalability', 'product', '01932b3c-7d00-7000-8000-000000000001', 'name',   '"Demo Payments Scalability"',            '1735689601000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod-type',   'seed-product-demo-payments-scalability', 'product', '01932b3c-7d00-7000-8000-000000000001', 'type',   '"product"',                              '1735689601000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod-slug',   'seed-product-demo-payments-scalability', 'product', '01932b3c-7d00-7000-8000-000000000001', 'slug',   '"01932b3c-7d00-7000-8000-000000000001"', '1735689601000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod-status', 'seed-product-demo-payments-scalability', 'product', '01932b3c-7d00-7000-8000-000000000001', 'status', '"active"',                               '1735689601000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod-origin', 'seed-product-demo-payments-scalability', 'product', '01932b3c-7d00-7000-8000-000000000001', 'origin', '"bespoke"',                              '1735689601000:0000:seed', 'seed', NOW())
ON CONFLICT (event_id, field_name) DO UPDATE SET value = EXCLUDED.value, hlc = EXCLUDED.hlc, actor_id = EXCLUDED.actor_id, updated_at = NOW();

-- ── Demo Card Issuing product (second product root) ──────────────────────────
-- A second seeded product so cross-product pull scoping is demonstrable in
-- `make watch` dev runs (a single-product seed can't show that a scoped actor
-- sees prod-1 but not prod-2).

INSERT INTO events (id, event_type, actor_type, actor_id, time, status, source, entity_type, entity_id, root_type, root_id)
VALUES ('seed-product-demo-card-issuing', 'SyncEvent.v1', 'system', 'seed', NOW(), 'synced', 'peaky.seed', 'product', '01932b3c-7d00-7000-8000-000000000002', 'product', '01932b3c-7d00-7000-8000-000000000002')
ON CONFLICT (id) DO UPDATE SET time = NOW();

INSERT INTO field_versions (id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES
  ('seed-fv-prod2-name',   'product', '01932b3c-7d00-7000-8000-000000000002', 'name',   '"Demo Card Issuing"',                    '1735689602000:0000', 'seed', NOW()),
  ('seed-fv-prod2-type',   'product', '01932b3c-7d00-7000-8000-000000000002', 'type',   '"product"',                              '1735689602000:0000', 'seed', NOW()),
  ('seed-fv-prod2-slug',   'product', '01932b3c-7d00-7000-8000-000000000002', 'slug',   '"01932b3c-7d00-7000-8000-000000000002"', '1735689602000:0000', 'seed', NOW()),
  ('seed-fv-prod2-status', 'product', '01932b3c-7d00-7000-8000-000000000002', 'status', '"active"',                               '1735689602000:0000', 'seed', NOW()),
  ('seed-fv-prod2-origin', 'product', '01932b3c-7d00-7000-8000-000000000002', 'origin', '"bespoke"',                              '1735689602000:0000', 'seed', NOW())
ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET value = EXCLUDED.value, hlc = EXCLUDED.hlc, actor_id = EXCLUDED.actor_id, updated_at = NOW();

INSERT INTO field_version_events (id, event_id, entity_type, entity_id, field_name, value, hlc, actor_id, updated_at)
VALUES
  ('seed-fve-prod2-name',   'seed-product-demo-card-issuing', 'product', '01932b3c-7d00-7000-8000-000000000002', 'name',   '"Demo Card Issuing"',                    '1735689602000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod2-type',   'seed-product-demo-card-issuing', 'product', '01932b3c-7d00-7000-8000-000000000002', 'type',   '"product"',                              '1735689602000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod2-slug',   'seed-product-demo-card-issuing', 'product', '01932b3c-7d00-7000-8000-000000000002', 'slug',   '"01932b3c-7d00-7000-8000-000000000002"', '1735689602000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod2-status', 'seed-product-demo-card-issuing', 'product', '01932b3c-7d00-7000-8000-000000000002', 'status', '"active"',                               '1735689602000:0000:seed', 'seed', NOW()),
  ('seed-fve-prod2-origin', 'seed-product-demo-card-issuing', 'product', '01932b3c-7d00-7000-8000-000000000002', 'origin', '"bespoke"',                              '1735689602000:0000:seed', 'seed', NOW())
ON CONFLICT (event_id, field_name) DO UPDATE SET value = EXCLUDED.value, hlc = EXCLUDED.hlc, actor_id = EXCLUDED.actor_id, updated_at = NOW();
