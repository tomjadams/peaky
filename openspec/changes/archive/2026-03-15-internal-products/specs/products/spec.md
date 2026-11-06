## ADDED Requirements

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
- **THEN** an empty state is displayed
- **AND** the empty state shows a centered icon and "No products yet" message
- **AND** the empty state includes a "New Product" button navigating to `/products/new`

#### Scenario: Filter by product origin

- **WHEN** viewing the products dashboard
- **THEN** an origin filter is available
- **AND** options include: All origins, Bespoke, Open Source, Vendor
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
- **THEN** a dedicated page is displayed
- **AND** the page shows a visual mental model explainer with a concrete example (e.g., "Checkout" product with PM: Vlad S., Eng Lead: Heitor L., teams: Checkout Core + Payments Platform, applications: checkout-api + checkout-web + payment-gateway)
- **AND** the form is organized into logical sections: Identity, Contacts, Teams, Applications, Links

#### Scenario: Product identity fields

- **WHEN** filling the creation form
- **THEN** a name field is required (min 1 character, max 120)
- **AND** an origin dropdown is required with options: bespoke, open-source, vendor
- **AND** an Internal/External toggle is required
- **AND** no default origin is pre-selected (user must choose intentionally)
- **AND** duplicate names are allowed (not unique constraint)

#### Scenario: Product Manager contact

- **WHEN** filling the creation form
- **THEN** a Product Manager search field is displayed (required)
- **AND** typing searches against local Backstage mock data (client-side; no server round-trip)
- **AND** search results show user name and email
- **AND** selecting a user stores their Backstage short ID (e.g., "vlads")
- **AND** the field is required — the form cannot be submitted without a PM

#### Scenario: Engineering Lead contact

- **WHEN** filling the creation form
- **THEN** an Engineering Lead search field is displayed (optional)
- **AND** typing searches against local Backstage mock data
- **AND** search results show user name and email
- **AND** selecting a user stores their Backstage short ID (e.g., "heitorl")
- **AND** the field can be left empty

#### Scenario: Team association

- **WHEN** filling the creation form
- **THEN** a team search/select field is displayed
- **AND** the selector searches Backstage groups against local mock data
- **AND** one or more teams can be selected
- **AND** selected teams appear as removable chips showing resolved names
- **AND** at least one team is required
- **AND** selected teams are stored as Backstage group short IDs

#### Scenario: Application association

- **WHEN** filling the creation form
- **THEN** an "Applications" search/select field is displayed
- **AND** the selector searches Backstage components against local mock data
- **AND** zero or more applications can be selected
- **AND** selected applications appear as removable chips showing resolved names
- **AND** selected applications are stored as Backstage component short IDs (componentRefs)

#### Scenario: External links

- **WHEN** filling the creation form
- **THEN** two optional URL fields are displayed: Roadmap, Documentation
- **AND** one optional text field is displayed: Support Channel (Slack channel name, e.g. "#checkout-support")
- **AND** each field has an appropriate icon (map, book-open, message-square)
- **AND** URL fields are validated as URLs when provided

#### Scenario: Create product submission

- **WHEN** clicking "Create Product" with valid form data
- **THEN** the product is created via `POST /api/products`
- **AND** the user is navigated to the new product's detail page `/products/:productId`
- **AND** a success toast is shown

#### Scenario: Create product validation

- **WHEN** clicking "Create Product" with invalid data
- **THEN** validation errors are shown inline
- **AND** the form is not submitted
- **AND** the "Create Product" button is disabled when required fields are empty

#### Scenario: Backstage unreachable during creation

- **WHEN** Backstage is unreachable (off VPN, service down)
- **THEN** search fields for contacts, teams, and applications yield no results
- **AND** the user can type a raw Backstage ID manually as a fallback (e.g., "vlads", "checkout-core")
- **AND** the form accepts raw IDs for all Backstage-backed fields

### Requirement: Product Details Page

The application SHALL provide a product details page showing product information and associated reviews.

#### Scenario: Product details display

- **WHEN** navigating to `/products/:productId`
- **THEN** the page displays the product name as heading
- **AND** displays the product type badge
- **AND** displays creation date
- **AND** displays stat cards for review count and average progress

#### Scenario: Contacts display

- **WHEN** viewing product details
- **THEN** the Product Manager is displayed inline in the header metadata row as "PM: [Name]"
- **AND** the PM abbreviation has a tooltip showing "Product Manager" on hover
- **AND** the PM name links to their Backstage profile (`/catalog/default/user/:id`)
- **AND** the Engineering Lead is displayed inline as "EL: [Name]" if set
- **AND** the EL abbreviation has a tooltip showing "Engineering Lead" on hover
- **AND** if no Engineering Lead is set, the EL entry is not displayed

#### Scenario: Edit product

- **WHEN** clicking "Edit" on product details page
- **THEN** the user is navigated to `/products/:productId/edit`

#### Scenario: Team association display

- **WHEN** viewing product details
- **THEN** the owning teams are listed with names (resolved from Backstage)
- **AND** each team name links to the Backstage group profile (`/catalog/default/group/:id`)

#### Scenario: Application association display

- **WHEN** viewing product details
- **THEN** the constituent applications are listed with names and count (resolved from Backstage)
- **AND** each application name links to the Backstage component profile (`/catalog/default/component/:id`)
- **AND** if no applications are associated, a "No applications linked" message is shown

#### Scenario: Degraded display (Backstage unreachable)

- **WHEN** viewing product details and Backstage is unreachable
- **THEN** contacts, teams, and applications show raw Backstage IDs instead of display names
- **AND** Backstage profile links are still generated (they will work when the user is on the internal network)
- **AND** the page is fully functional — resolution only enriches, never blocks

#### Scenario: Resources display

- **WHEN** viewing product details
- **THEN** a Resources card shows a table with rows for each resource
- **AND** each row shows a type label (Roadmap, Docs, Support) and the value
- **AND** URL resources (Roadmap, Docs) open in a new tab
- **AND** Support Channel is shown as plain text (Slack channel name, not a link)
- **AND** resources that are not set are not shown (no empty rows)

#### Scenario: Product reviews list

- **WHEN** viewing product details
- **THEN** a list of product-scoped reviews is displayed
- **AND** each review shows name, status, progress, and last updated
- **AND** clicking a review navigates to review details

#### Scenario: Start review from product details

- **WHEN** clicking "Start New Review" on product details page
- **THEN** the review wizard starts at `/products/:productId/reviews/new`

### Requirement: Product Edit Page

The application SHALL provide a product edit page at `/products/:productId/edit`.

#### Scenario: Edit page layout

- **WHEN** navigating to `/products/:productId/edit`
- **THEN** the same form layout as the creation page is displayed
- **AND** all fields are pre-populated with the existing product data
- **AND** the submit button reads "Save Changes" instead of "Create Product"

#### Scenario: Edit product submission

- **WHEN** clicking "Save Changes" with valid form data
- **THEN** the product is updated via `PATCH /api/products/:id`
- **AND** only changed fields are sent in the request body
- **AND** the user is navigated back to the product detail page
- **AND** a success toast is shown

#### Scenario: Edit product validation

- **WHEN** editing with invalid data
- **THEN** the same validation rules apply as creation
- **AND** the form cannot be submitted with invalid data

### Requirement: Products API

The application SHALL provide API endpoints for product operations.

#### Scenario: List products

- **WHEN** requesting `GET /api/products`
- **THEN** a list of products is returned
- **AND** each product includes id, name, type, productManagerRef, teamRefs, componentRefs, createdAt
- **AND** each product includes computed metrics: totalReviewCount, activeReviewCount
- **AND** products are sorted by createdAt descending

#### Scenario: Create product

- **WHEN** requesting `POST /api/products` with name, origin, isExternal, productManagerRef, teamRefs, and optional engineeringLeadRef, componentRefs, and links
- **THEN** a new product is created
- **AND** the response includes the created product with generated id
- **AND** createdAt is set to current timestamp
- **AND** productManagerRef is required (Backstage user short ID string)
- **AND** engineeringLeadRef is optional (Backstage user short ID string)
- **AND** teamRefs must contain at least one Backstage group short ID
- **AND** componentRefs defaults to empty array if not provided
- **AND** roadmapUrl and documentationUrl are optional and validated as URLs
- **AND** supportChannel is optional text (Slack channel name)

#### Scenario: Update product

- **WHEN** requesting `PATCH /api/products/:id` with a partial body
- **THEN** only the provided fields are updated
- **AND** the response includes the full updated product
- **AND** the same validation rules apply as creation (e.g., teamRefs must have at least one if provided)
- **AND** fields not in the request body are left unchanged

#### Scenario: Get product details

- **WHEN** requesting `GET /api/products/:id`
- **THEN** the product details are returned
- **AND** includes review count metric
- **AND** includes productManagerRef and engineeringLeadRef as Backstage short IDs
- **AND** includes teamRefs and componentRefs as Backstage short IDs
- **AND** display names are resolved client-side via Backstage resolution endpoints

#### Scenario: Product not found

- **WHEN** requesting a non-existent product
- **THEN** a 404 error is returned

### Requirement: Backstage Resolution

The application SHALL resolve Backstage entity display info entirely client-side. The Nitro server (Vercel-hosted) cannot reach internal Backstage; the user's browser (corporate network) can. No server-side Backstage proxy routes are provided.

In mock phase, resolution is synchronous — mock data is embedded in client composables (`useBackstageUserSearch`, `useBackstageGroupSearch`, `useBackstageComponentSearch`). In production, composables call the Backstage Catalog API directly from the browser.

#### Scenario: Resolve user display name

- **WHEN** a product details page loads with a `productManagerRef` or `engineeringLeadRef`
- **THEN** `resolveBackstageUser(id)` returns the display name synchronously from mock data
- **AND** the name is shown immediately with no loading state
- **AND** if the id is unknown, the raw ID is shown as a fallback

#### Scenario: Search users in creation form

- **WHEN** typing in the PM or Engineering Lead field
- **THEN** `useBackstageUserSearch` filters mock users client-side
- **AND** results show name and email
- **AND** empty query returns all available users

#### Scenario: Search groups/components in creation form

- **WHEN** typing in the Teams or Applications field
- **THEN** `useBackstageGroupSearch` / `useBackstageComponentSearch` filters mock data client-side
- **AND** empty query returns all available entries

## MODIFIED Requirements

### Requirement: Product Creation (SUPERSEDED)

The inline "create product in review wizard" approach (Step 0) is replaced by the standalone creation page at `/products/new`. Products are created before starting a review, not during the review wizard flow.

## REMOVED Requirements

### Requirement: Product Selection (REMOVED)

The wizard Step 0 "Select existing product OR create new" is removed. The review wizard is always entered from an existing product (via product detail page or dashboard), so product selection/creation is no longer part of the wizard flow.
