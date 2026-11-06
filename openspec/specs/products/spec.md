# products Specification

## Purpose

This specification covers the products domain — internal products (bespoke, open-source, or vendor), their creation, details, and association with teams and applications via Backstage entity references. Products serve as an alternate review owner alongside teams.

## Requirements

### Requirement: Products Dashboard

The application SHALL provide a products dashboard for viewing and managing user-created internal products.

#### Scenario: Products dashboard display

- **WHEN** navigating to `/products`
- **THEN** the page displays a list of all products
- **AND** each product shows name, origin badge, and review count
- **AND** the page displays stat cards for total products and active reviews
- **AND** a "New Product" button is visible navigating to `/products/new`

#### Scenario: Products dashboard empty state

- **WHEN** no products exist
- **THEN** an empty state is displayed with a centered icon and "No products yet" message
- **AND** the empty state includes a "New Product" button navigating to `/products/new`

#### Scenario: Filter by product origin

- **WHEN** viewing the products dashboard
- **THEN** an origin filter is available with options: All origins, Bespoke, Open Source, Vendor
- **AND** selecting an origin filters the product list

#### Scenario: Search products

- **WHEN** typing in the search input
- **THEN** the product list filters to match product names
- **AND** search is case-insensitive
- **AND** empty results show "No products match your search" message

### Requirement: Product Creation Page

The application SHALL provide a standalone product creation page at `/products/new`.

#### Scenario: Creation page layout

- **WHEN** navigating to `/products/new`
- **THEN** a dedicated page is displayed with a visual mental model explainer
- **AND** the form is organized into sections: Identity, Contacts, Teams, Applications, Links

#### Scenario: Product identity fields

- **WHEN** filling the creation form
- **THEN** a name field is required (min 1 character, max 120)
- **AND** an origin dropdown is required with options: bespoke, open-source, vendor
- **AND** an Internal/External toggle is required
- **AND** no default origin is pre-selected (user must choose intentionally)

#### Scenario: Product Manager contact

- **WHEN** filling the creation form
- **THEN** a Product Manager search field is displayed (required)
- **AND** typing searches against local Backstage mock data (client-side; no server round-trip)
- **AND** search results show user name and email
- **AND** selecting a user stores their Backstage short ID (e.g., "vlads")

#### Scenario: Engineering Lead contact

- **WHEN** filling the creation form
- **THEN** an Engineering Lead search field is displayed (optional)
- **AND** typing searches against local Backstage mock data
- **AND** selecting a user stores their Backstage short ID

#### Scenario: Team association

- **WHEN** filling the creation form
- **THEN** a team search/select field is displayed
- **AND** one or more teams can be selected (at least one required)
- **AND** selected teams appear as removable chips showing resolved names
- **AND** selected teams are stored as Backstage group short IDs

#### Scenario: Application association

- **WHEN** filling the creation form
- **THEN** an "Applications" search/select field is displayed
- **AND** zero or more applications can be selected
- **AND** selected applications appear as removable chips showing resolved names
- **AND** selected applications are stored as Backstage component short IDs (componentRefs)

#### Scenario: External links

- **WHEN** filling the creation form
- **THEN** two optional URL fields are displayed: Roadmap, Documentation
- **AND** one optional text field is displayed: Support Channel (Slack channel name)
- **AND** URL fields are validated as URLs when provided

#### Scenario: Create product submission

- **WHEN** clicking "Create Product" with valid form data
- **THEN** the product is committed to the local database and queued for background synchronization
- **AND** the user is navigated to the new product's detail page `/products/:productId`
- **AND** a success toast is shown

#### Scenario: Create product validation

- **WHEN** clicking "Create Product" with invalid data
- **THEN** validation errors are shown inline and the form is not submitted
- **AND** the "Create Product" button is disabled when required fields are empty

#### Scenario: Backstage unreachable during creation

- **WHEN** Backstage is unreachable (off VPN, service down)
- **THEN** search fields yield no results
- **AND** the user can type a raw Backstage ID manually as a fallback
- **AND** the form accepts raw IDs for all Backstage-backed fields

### Requirement: Product Details Page

The application SHALL provide a product details page showing product information and associated reviews.

#### Scenario: Product details display

- **WHEN** navigating to `/products/:productId`
- **THEN** the page displays the product name as heading with type badge and creation date
- **AND** displays stat cards for review count and average progress

#### Scenario: Contacts display

- **WHEN** viewing product details
- **THEN** the Product Manager is displayed inline in the header as "PM: [Name]" with a tooltip
- **AND** the PM name links to their Backstage profile (`/catalog/default/user/:id`)
- **AND** the Engineering Lead is displayed as "EL: [Name]" if set, with a tooltip
- **AND** if no Engineering Lead is set, the EL entry is not displayed

#### Scenario: Team and application association display

- **WHEN** viewing product details
- **THEN** owning teams are listed with names resolved from Backstage, each linking to their Backstage group profile
- **AND** constituent applications are listed with names resolved from Backstage, each linking to their Backstage component profile
- **AND** if no applications are associated, a "No applications linked" message is shown

#### Scenario: Degraded display (Backstage unreachable)

- **WHEN** viewing product details and Backstage is unreachable
- **THEN** contacts, teams, and applications show raw Backstage IDs instead of display names
- **AND** Backstage profile links are still generated
- **AND** the page is fully functional — resolution only enriches, never blocks

#### Scenario: Resources display

- **WHEN** viewing product details
- **THEN** a Resources card shows rows for each set resource: Roadmap (URL), Docs (URL), Support (text)
- **AND** URL resources open in a new tab
- **AND** resources that are not set are not shown

#### Scenario: Edit product

- **WHEN** clicking "Edit" on product details page
- **THEN** the user is navigated to `/products/:productId/edit`

### Requirement: Product Edit Page

The application SHALL provide a product edit page at `/products/:productId/edit`.

#### Scenario: Edit page layout

- **WHEN** navigating to `/products/:productId/edit`
- **THEN** the same form layout as the creation page is displayed with all fields pre-populated
- **AND** the submit button reads "Save Changes"

#### Scenario: Edit product submission

- **WHEN** clicking "Save Changes" with valid form data
- **THEN** only changed product fields are committed locally and queued for background synchronization
- **AND** the user is navigated back to the product detail page with a success toast

### Requirement: Products Compatibility API

The server SHALL retain validated product compatibility endpoints while member-facing product pages use the replicated local projection as their source of truth.

#### Scenario: List products

- **WHEN** requesting `GET /api/products`
- **THEN** a list of products is returned with id, name, type, productManagerRef, teamRefs, componentRefs, createdAt
- **AND** each product includes computed metrics: totalReviewCount, activeReviewCount
- **AND** products are sorted by createdAt descending

#### Scenario: Create product

- **WHEN** requesting `POST /api/products` with name, origin, isExternal, productManagerRef, teamRefs, and optional fields
- **THEN** a new product is created with generated id and current createdAt
- **AND** productManagerRef is required; engineeringLeadRef is optional
- **AND** teamRefs must contain at least one Backstage group short ID
- **AND** roadmapUrl and documentationUrl are optional URLs; supportChannel is optional text

#### Scenario: Update product

- **WHEN** requesting `PATCH /api/products/:id` with a partial body
- **THEN** only provided fields are updated, all others unchanged
- **AND** same validation rules apply as creation

#### Scenario: Get product details

- **WHEN** requesting `GET /api/products/:id`
- **THEN** the product details are returned with all refs as Backstage short IDs
- **AND** display names are resolved client-side via Backstage resolution composables
- **AND** returns 404 if the product does not exist

### Requirement: Backstage Resolution

The application SHALL resolve Backstage entity display info entirely client-side. The Nitro server (Vercel-hosted) cannot reach internal Backstage; the user's browser (corporate network) can.

In mock phase, resolution is synchronous — mock data is embedded in client composables (`useBackstageUserSearch`, `useBackstageGroupSearch`, `useBackstageComponentSearch`). In production, composables call the Backstage Catalog API directly from the browser.

#### Scenario: Resolve user display name

- **WHEN** a product details page loads with a `productManagerRef` or `engineeringLeadRef`
- **THEN** `resolveBackstageUser(id)` returns the display name synchronously from mock data
- **AND** if the id is unknown, the raw ID is shown as a fallback

#### Scenario: Search users in creation form

- **WHEN** typing in the PM or Engineering Lead field
- **THEN** `useBackstageUserSearch` filters mock users client-side, showing name and email

#### Scenario: Search groups/components in creation form

- **WHEN** typing in the Teams or Applications field
- **THEN** `useBackstageGroupSearch` / `useBackstageComponentSearch` filters mock data client-side

### Requirement: Local-First Product Editing

The application SHALL support local-first create and edit flows for products the current user is permitted to modify.

#### Scenario: Editable product details hydrate from local state

- **WHEN** a user opens a product they are permitted to edit and that product has already been replicated locally
- **THEN** the product detail and edit flows load from the local database first
- **AND** the last known product state is available even if the remote server is temporarily unavailable

#### Scenario: Product edits commit locally before remote sync

- **WHEN** a user changes product identity, owner groups, linked components, or resource links
- **THEN** the updated product state is committed locally first
- **AND** the change is queued for background synchronization

#### Scenario: Product creation survives refresh before sync

- **WHEN** a user creates a product while the app is offline or the remote server is temporarily unavailable
- **THEN** the pending product exists locally after browser refresh
- **AND** the create action remains queued until synchronization succeeds or requires review
