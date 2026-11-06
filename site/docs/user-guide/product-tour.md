# Product tour

A guided walk through Peaky — from the dashboard to completing your first assessment. Screenshots update automatically when you toggle dark mode.

!!! tip "Already have a product set up? Skip to [Start assessing](#start-assessing)."

## See where your team stands

Open Peaky and you land on the Teams dashboard. It shows how many teams are in scope, which reviews are active, and how many actions remain. Search by Team or Organization when the directory grows.

![Teams dashboard](../assets/images/teams-page.png#only-light)
![Teams dashboard](../assets/images/teams-page-dark.png#only-dark)

The summary shows where to focus. A high pending-actions count means active reviews still contain unresolved gaps. Open a Team to see its Reviews and start the next assessment.

!!! tip "Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) anywhere to open the command palette — search for any product, team, or action without touching the mouse."

## Set up your products

Products represent the systems, services, or initiatives your team is responsible for. They're the starting point for reviews.

### Browsing products

At a glance, you can tell who owns each product, where it came from, and whether it has an open review.

![Products List](../assets/images/products-list.png#only-light)
![Products List Dark](../assets/images/products-list-dark.png#only-dark)

### Creating a product

Click **New Product** to start the creation wizard:

| Step | What you define | Why it matters |
|------|----------------|---------------|
| **1. Identity** | Name, origin type, visibility, description | Establishes what this product is and who can see it |
| **2. Teams** | Which teams own this product | Determines who can create and manage reviews |
| **3. Applications** | Linked services and systems | Maps the technical components that power the product |
| **4. Confirm** | Review everything before creating | Catches mistakes before the product goes live |

Once created, your product page becomes its front door for anyone who needs to understand what it is and who owns it.

!!! example "What makes a good product page?"
    Think of your product page as its front door. Include:

    - What the product does and who it's for
    - Current limits or known constraints
    - Where to ask questions — a Slack channel, wiki page, or team email

    Future versions of Peaky will support richer product documentation, roadmaps, and support channels. For now, use the description field.

## Start assessing

From the product detail page, click **Start Review** to choose your templates.

A review can use up to 3 templates — useful when a product needs to clear multiple readiness bars in the same cycle.

!!! example "When to use multiple templates"
    Say you have a service approaching peak season that also handles sensitive data. You could select two templates — one focused on scalability and failover, the other on data protection and access controls.

    The review tracks progress for both, and gaps from either template surface in the same place. Template names are yours to define — these are just examples.

![Review Wizard](../assets/images/product-review-wizard.png#only-light)
![Review Wizard Dark](../assets/images/product-review-wizard-dark.png#only-dark)

## Work through questions

Each question has Yes, No, or N/A options. Click the ^^info icon^^ on any question to see why it matters, leading practices, and helpful links — this is where the real learning happens.

![Assessment](../assets/images/product-assessment.png#only-light)
![Assessment Dark](../assets/images/product-assessment-dark.png#only-dark)

The assessment view has three areas: ^^pillar tabs^^ at the top for navigating categories (each showing its progress), ^^question cards^^ in the center, and a collapsible ^^template sidebar^^ on the left for jumping to any pillar.

Answers save to your browser automatically as you click — you won't lose work. When you're ready to share progress with your team, click **Save** to create a session snapshot with a comment. We cover session snapshots and review history in detail in [Working with reviews](reviews.md).

!!! warning "N/A requires a reason"
    Marking a question as Not Applicable opens a reason selector. This creates an audit trail — advisors and future reviewers will see why it was skipped.

## Understand your results

The review detail page shows overall progress and per-pillar breakdown. Each pillar tab surfaces where you stand and which gaps remain.

![Review Detail](../assets/images/product-review-detail.png#only-light)
![Review Detail Dark](../assets/images/product-review-detail-dark.png#only-dark)

Template authors can attach leading practices and helpful resources to every question so assessors can understand what good looks like without leaving the review. The [Power user guide](power-user/templates-advanced.md) covers Markdown import/export for larger authoring workflows.

## Keep going

- [Working with reviews](reviews.md) — question types, session history, what happens after
- [Understanding templates](templates.md) — what templates contain and how to choose one
- [Writing great templates](authoring-templates.md) — style guide for template authors
- [Power user guide](power-user/index.md) — keyboard shortcuts, survey mode, and advanced features
