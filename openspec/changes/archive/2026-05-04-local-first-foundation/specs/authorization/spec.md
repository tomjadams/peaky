## ADDED Requirements

### Requirement: Lifecycle Authorization For Peaky-Owned Subjects

The system SHALL enforce explicit lifecycle authorization rules for products, templates, and reviews.

#### Scenario: Product lifecycle is owner-or-admin controlled

- **WHEN** an actor requests product archive, restore, or permanent delete
- **THEN** the system allows the action only if the actor is an admin, the product manager, or the engineering lead for that product

#### Scenario: Template lifecycle is owner-or-admin controlled

- **WHEN** an actor requests template archive, restore, or permanent delete
- **THEN** the system allows the action only if the actor is an admin or appears in the template owner list

#### Scenario: Team review lifecycle respects reviewer ownership

- **WHEN** an actor requests team-review archive or restore
- **THEN** the system allows the action only if the actor is an admin or one of the review reviewers

#### Scenario: Product review lifecycle respects product ownership

- **WHEN** an actor requests product-review archive or restore
- **THEN** the system allows the action only if the actor is an admin or one of the owning product actors

#### Scenario: Permanent review delete remains admin-only

- **WHEN** an actor requests permanent review deletion
- **THEN** the system allows the action only if the actor is an admin

### Requirement: Destructive Actions Need Explicit Confirmation

The system SHALL require additional safeguards before permanently deleting archived records.

#### Scenario: Permanent delete requires archived state first

- **WHEN** an actor requests permanent delete for a product, template, or review
- **THEN** the system rejects the request unless the record is already archived

#### Scenario: Product and template delete require typed confirmation

- **WHEN** an actor requests permanent delete for an archived product or template
- **THEN** the system requires the actor to type the exact subject name
- **AND** the delete request is rejected if the confirmation does not match exactly

### Requirement: Admin Events Access Is Admin-Only

The system SHALL restrict the operator-facing Admin Events surfaces to admins.

#### Scenario: Admin can read the audit feed

- **WHEN** an admin requests the Admin Events feed
- **THEN** the system returns the merged operator-facing event timeline

#### Scenario: Non-admin cannot read the audit feed

- **WHEN** a non-admin requests the Admin Events feed or SSE stream
- **THEN** the system rejects the request with an authorization error
