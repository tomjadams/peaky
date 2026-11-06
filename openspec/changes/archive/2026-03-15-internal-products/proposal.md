## Why

Teams come from LDAP (external organizational data), but we need a way to review internal products that don't have LDAP backing. Users need to create products on-demand, rather than having them pre-defined by an external system.

Products are the central concept that ties teams, applications, and reviews together. A product represents something the organization builds and operates — it can be a customer-facing offering (e.g., Online Payments), a platform engineering building block (e.g., containers), a managed service (e.g., Kafka), a vendor-based product (e.g., GitLab), or a developer experience tool (e.g., Launchpad). As products grow in complexity and scope, they naturally involve more teams and more applications.

All external identity (people, teams, applications) is referenced via Backstage short IDs — no LDAP data is stored locally. Display info is resolved from Backstage at render time, keeping the local database lean and positioning for a local-first architecture. The UI uses "Applications" as the user-facing term; these map to Backstage components (`kind: Component`) in the data model.

This enables reviews for:
- Internal services and platforms
- Libraries and shared tooling
- Any product that isn't team-owned or LDAP-managed

## What Changes

- New **Products** view (parallel structure to Teams view)
- New **Product** model with Backstage references (contacts, teams, applications) and local data (name, type, links)
- New **ProductReview** model (separate from Review to maintain clean separation)
- **Standalone product creation page** with mental model explainer (`/products/new`)
- **Backstage resolution layer** for resolving display info from short IDs (mocked for now)
- Product-to-team and product-to-application associations via Backstage refs

### Products Dashboard

- Lists user-created products with review metrics
- Search and filter products by type
- "New Product" CTA navigates to standalone creation page
- "Start New Review" for existing products

### Product Creation Page (`/products/new`)

- Dedicated page with visual explainer of the product mental model
- Product identity: name (required), type (required)
- Point of contact: Product Manager (required, Backstage user lookup), Engineering Lead (optional, Backstage user lookup)
- Team association: search and link one or more owning teams (Backstage groups)
- Application association: search and link zero or more applications (Backstage components)
- Optional links: roadmap URL, documentation URL, support URL

### Product Edit Page (`/products/:productId/edit`)

- Same form layout as creation page, pre-populated with existing product data
- All fields editable via `PATCH /api/products/:id`

### Product Review Wizard

- Step 1: Template selection (1-3 templates)
- Step 2: Application linking (optional, pre-populated from product's componentRefs)
- Step 3: Review naming and confirmation

### Product Detail Page

- Shows product info (name, type, contacts, teams, applications, links, created date)
- Lists product-scoped reviews
- "Start New Review" and "Edit" actions

## Capabilities

### New Capabilities

- `products`: Product management - CRUD operations, listing, filtering by type, Backstage refs (contacts, teams, applications), external links
- `product-reviews`: Product-scoped reviews with application pre-population from product

### Modified Capabilities

None. Product reviews use the same assessment flow as team reviews (existing `reviews` spec covers the shared behavior).

## Impact

### New Routes
- `/products` - Products dashboard
- `/products/new` - Product creation page
- `/products/:productId` - Product detail page
- `/products/:productId/edit` - Product edit page
- `/products/:productId/reviews/new` - New product review wizard

### New Models
- `Product` - User-created product (id, name, type, productManagerRef, engineeringLeadRef?, teamRefs, componentRefs, roadmapUrl?, documentationUrl?, supportUrl?, createdAt, createdBy)
- `ProductReview` - Product-scoped review (mirrors Review structure with productId)

### New Composables
- `useProducts` - Fetch and filter products
- `useProductDetails` - Single product with metrics
- `useProductReviews` - Product-scoped reviews
- `useProductCreation` - Form state and submission for product creation
- `useBackstageSearch` - Backstage entity search (users, groups, components)

### New API Endpoints
- `GET /api/products` - List products
- `GET /api/products/:id` - Product details
- `POST /api/products` - Create product (name, type, refs, links)
- `PATCH /api/products/:id` - Update product (partial update, any field)
- `GET /api/products/:id/reviews` - Product reviews
- `POST /api/products/:id/reviews` - Create product review
- `GET /api/backstage/users?q=:query` - Search Backstage users (mock, returns {id, name, email})
- `GET /api/backstage/groups?q=:query` - Search Backstage groups (mock, returns {id, name})
- `GET /api/backstage/components?q=:query` - Search Backstage components (mock, returns {id, name})
- `GET /api/backstage/users/:id` - Resolve single user display info
- `GET /api/backstage/groups/:id` - Resolve single group display info
- `GET /api/backstage/components/:id` - Resolve single component display info
