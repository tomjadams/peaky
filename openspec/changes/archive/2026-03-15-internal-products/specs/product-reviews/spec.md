> **Note:** The `specs/product-reviews/` domain no longer exists. Product review requirements are now split across `openspec/specs/products/spec.md` and `openspec/specs/reviews/spec.md`.

## ADDED Requirements

### Requirement: Product Review Wizard

The application SHALL provide a multi-step wizard for creating product-scoped reviews.

#### Scenario: Wizard step order

- **WHEN** starting a new product review from `/products/:productId/reviews/new`
- **THEN** the wizard displays 2 steps
- **AND** Step 1 is Template Selection
- **AND** Step 2 is Scope & Confirm

#### Scenario: Step 1 - Template selection

- **WHEN** viewing step 1
- **THEN** the interface matches the team review wizard template selection
- **AND** 1-3 templates can be selected
- **AND** templates are displayed as clickable cards

#### Scenario: Step 2 - Scope & Confirm

- **WHEN** viewing step 2
- **THEN** a scope selector is displayed with two options: "Full product" and "Specific applications"
- **AND** "Full product" is selected by default and pre-selects all `product.componentRefs`
- **AND** selecting "Specific applications" shows an application picker with product's componentRefs
- **AND** a review name input is displayed
- **AND** selected templates and scope are summarized
- **AND** "Create Review" button creates the review

#### Scenario: Create product review

- **WHEN** completing the wizard
- **THEN** a ProductReview is created
- **AND** the review is associated with the productId
- **AND** the user is navigated to the review details page

### Requirement: Product Review Listing

The application SHALL list product-scoped reviews on the product details page.

#### Scenario: Reviews table display

- **WHEN** viewing a product with reviews
- **THEN** a data table shows all reviews
- **AND** columns include: Name, Status, Progress, Updated
- **AND** status uses badge with appropriate color
- **AND** progress shows percentage with progress bar

#### Scenario: No reviews empty state

- **WHEN** a product has no reviews
- **THEN** an empty state is displayed
- **AND** shows "No reviews yet" message
- **AND** includes "Start New Review" button

### Requirement: Product Review Navigation

The application SHALL provide navigation between products and their reviews.

#### Scenario: Navigate to review from product

- **WHEN** clicking a review in the product details page
- **THEN** navigate to `/products/:productId/reviews/:reviewId`

#### Scenario: Navigate from review to product

- **WHEN** viewing a product review
- **THEN** breadcrumb shows product name
- **AND** clicking product name navigates back to product details

### Requirement: Product Reviews API

The application SHALL provide API endpoints for product review operations.

#### Scenario: List product reviews

- **WHEN** requesting `GET /api/products/:id/reviews`
- **THEN** a list of reviews for the product is returned
- **AND** each review includes id, name, status, progress, updatedAt
- **AND** reviews are sorted by updatedAt descending

#### Scenario: Create product review

- **WHEN** requesting `POST /api/products/:id/reviews` with templateIds and name
- **THEN** a new ProductReview is created
- **AND** the review is associated with the productId
- **AND** status is set to "draft"
- **AND** progress is set to 0

#### Scenario: Get product review details

- **WHEN** requesting `GET /api/products/:productId/reviews/:reviewId`
- **THEN** the review details are returned
- **AND** includes template information
- **AND** includes pillar progress breakdown

#### Scenario: Product not found for review

- **WHEN** creating a review for non-existent product
- **THEN** a 404 error is returned

## MODIFIED Requirements

### Requirement: Product Review Wizard (MODIFIED)

- Step 0 (Product Selection/Creation) is removed — products are created via standalone `/products/new` page before starting a review
- Wizard is 2 steps: Templates → Scope & Confirm (scope and naming combined into one step)
- Scope selector distinguishes full-product vs targeted-application reviews
- Applications pre-populate from `product.componentRefs`

## REMOVED Requirements

### Requirement: Product Selection in Wizard (REMOVED)

Step 0 for product selection/creation within the review wizard is removed. The wizard is always entered from an existing product context.
