# Power user guide

You know the basics. Now make Peaky work for you — faster navigation, focused assessment modes, and features that most users never discover.

## Keyboard shortcuts

| Shortcut | Action | Where |
|----------|--------|-------|
| **Cmd+K** / **Ctrl+K** | Open command palette | Anywhere |
| **Esc** | Close palette or modal | Anywhere |
| **Arrow keys** | Navigate results | Command palette |
| **Enter** | Execute selected command | Command palette |

## Command palette

The fastest way to navigate Peaky. Press **Cmd+K** and start typing — results are fuzzy-matched and grouped by category.

| Category | What you can do |
|----------|----------------|
| **Navigation** | Jump to Teams, Products, Applications, Templates, Events |
| **Actions** | Toggle dark mode, clear browser cache |
| **Search** | Find products, teams, and templates by name |

The palette also surfaces ^^contextual commands^^ depending on where you are. On a review page, you'll see commands to enter survey mode or jump to a specific pillar. In Template Studio, you'll get commands for supported local save, preview, Markdown, and pillar-navigation actions. Publication and Template lifecycle commands are unavailable during the server-authority freeze.

!!! example "Try these"
    - From anywhere: type "teams" to jump to the Teams dashboard
    - On an assessment: type "survey" to enter survey mode
    - On the Templates page: type the name of a template to open it directly

## Survey mode

Survey mode shows one question at a time for focused, distraction-free assessment. Ideal for initial passes with many questions or smaller screens.

=== "Enter"

    - Click **Survey Mode** in the assessment header
    - Or open command palette → "Enter survey mode"

=== "Navigate"

    - **Previous / Next** buttons between questions
    - Progress bar shows position (e.g., "Question 8 of 25")
    - Questions ordered by pillar, same as standard view

=== "Exit"

    - Click **Complete** after the last question
    - Or open command palette → "Exit survey mode"

!!! tip "When to use which"
    **Survey mode** for working through questions sequentially — first pass, focused sessions. **Standard view** for jumping between pillars, reviewing specific sections, or comparing answers.

## Bulk actions

On the dashboard and product list, select multiple items with checkboxes to reveal the bulk action bar:

| Action | What it does |
|--------|-------------|
| **Transfer** | Move products to a different team |
| **Archive** | Soft-delete (can be restored, no data lost) |
| **Delete** | Permanently remove — requires archive first + typed confirmation |

## Offline work

You can complete an assessment offline — on a plane, in a coffee shop, wherever. Peaky saves enabled Review fields to your browser first and syncs them when connectivity returns.

- **Instant saves** — answers persist in milliseconds, not seconds
- **Background sync** — enabled Review/Product fields push automatically when connectivity returns
- **7-day offline window** — your access permissions stay valid for up to 7 days offline

Template draft authoring is different: it is local-only, creates no event or sync queue entry, and can be lost if local data is cleared or the device is lost. Exact Review Revision selections are also not yet transported to another client.

If the server deploys a newer version while you're working, a "New version available" banner appears. Reload promptly so migrations can run; confirm enabled changes have synced first, and preserve any local-only Template draft work you still need.

## Go deeper

<!-- markdownlint-disable -->
<div class="grid cards" markdown>

-   :material-history:{ .lg .middle } **Events and audit trail**

    ---

    Track every change, understand GDPR data handling, browse event schemas

    [:octicons-arrow-right-24: Events](events.md)

-   :material-pulse:{ .lg .middle } **System health page**

    ---

    What `/system` shows, how to recover a stuck local database, when to use it instead of Events

    [:octicons-arrow-right-24: System](system.md)

-   :material-puzzle-outline:{ .lg .middle } **Template import/export**

    ---

    Markdown export and external authoring workflows for sharing templates across teams

    [:octicons-arrow-right-24: Templates advanced](templates-advanced.md)

-   :material-cog-outline:{ .lg .middle } **Automation and integration**

    ---

    Event schemas, API patterns, and where Peaky is heading

    [:octicons-arrow-right-24: Automation](automation.md)

</div>
<!-- markdownlint-enable -->
