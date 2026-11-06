# sync-engine Specification (delta: sync-pull-scoping)

## MODIFIED Requirements

### Requirement: Sync Pull Scoped by Entitlements

The sync pull endpoint SHALL return only events whose resolved root the requesting actor is entitled to view. Entitlements SHALL be applied at the query level against each event's `(root_type, root_id)` reference, using per-family wildcard scoping so a wildcard in one entity family never widens or removes the filter for another family.

#### Scenario: Pull returns events for entitled roots, including their children

- **WHEN** an actor pulls with a cursor
- **THEN** the server resolves the actor's entitlements into per-family wildcards (e.g. `review:*`) and exact root references (e.g. `(review, review-001)`)
- **AND** the SQL WHERE clause matches events where `root_type = ANY(wildcard_families) OR (root_type, root_id) IN (exact_refs)`
- **AND** both root events and their child events (which carry the same `root_type`/`root_id`) are returned
- **AND** the filter is part of the SQL WHERE clause, not a post-query filter

#### Scenario: Child events ride along with their root

- **WHEN** an actor entitled to exactly `review:review-001` (no wildcard) pulls
- **AND** child events exist for entity `(review_answer, review-001:q1)`
- **THEN** those child events are returned because they resolve to root `(review, review-001)`
- **AND** the actor receives the review's answers, notes, and checkpoints, not just the review's own fields

#### Scenario: A family wildcard scopes only to its own family

- **WHEN** an actor holds `product:*` plus an exact `review:review-001` entitlement
- **THEN** the pull returns every product-rooted event (the wildcard) and only `review-001` review events
- **AND** events rooted at `review-999` are NOT returned
- **AND** a wildcard in one family never sets the pull filter to unscoped (no global `entitled = nil` collapse)

## ADDED Requirements

### Requirement: Event Root Reference Stamping

The sync push handler SHALL resolve and persist a `(root_type, root_id)` reference on every accepted event, and SHALL reject any event whose root cannot be resolved. A root entity is its own root; a child entity resolves to the root identified by its composite id.

#### Scenario: A root entity is its own root

- **WHEN** a push event targets a root entity such as `(review, review-001)`
- **THEN** the stored event's `root_type` and `root_id` equal its own `entity_type` and `entity_id`

#### Scenario: A child entity resolves to its parent root

- **WHEN** a push event targets a child entity whose id has the form `{rootId}:{unitId}`, such as `(review_answer, review-001:q1)`
- **THEN** the server resolves the root `(review, review-001)` and stamps it as `root_type`/`root_id` on the stored event

#### Scenario: An unresolvable root is rejected at push

- **WHEN** a push event targets a known **child** entity type whose id has no parseable `{rootId}:` prefix, so its root cannot be resolved (root entity types are always self-rooted and never hit this case)
- **THEN** the server rejects that event with the terminal reason `invalid_entity_id`
- **AND** writes no `events` or `field_versions` rows for it
- **AND** the client marks the corresponding outbox entry as `failed`
- **AND** this is distinct from `invalid_entity_type` (entity type unknown to the registry), which is rejected earlier and never reaches root resolution

#### Scenario: Existing events are backfilled with root references

- **WHEN** the root-reference migration runs against a populated database
- **THEN** every existing `events` row receives a resolved `root_type`/`root_id` using the same resolution rules
- **AND** no event row is left with a null root reference
- **AND** events that cannot be resolved fail the migration loudly rather than being left unscoped

### Requirement: Pull Root Types Include Product

The sync engine SHALL treat a fixed set of entity types as pull roots when resolving entitlements, and SHALL include `product` as a pull root alongside `review`.

#### Scenario: Pull resolves entitlements across all root types

- **WHEN** the pull handler resolves an actor's entitlements
- **THEN** it iterates the configured pull-root types, which include at least `review` and `product`
- **AND** for each root type it resolves the actor's viewable ids (or a family wildcard) independently

#### Scenario: Product entitlement scopes product-rooted events

- **WHEN** an actor is entitled to a specific product `(product, prod-1)` but no others
- **THEN** the pull returns events rooted at `prod-1` (the product and its children)
- **AND** does not return events rooted at other products
- **AND** does not return review or other-family events the actor is not entitled to
