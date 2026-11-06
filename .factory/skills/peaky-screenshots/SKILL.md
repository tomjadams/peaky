---
name: peaky-screenshots
description: Take full-page screenshots of Peaky UI pages for docs and changelogs. Handles viewport sizing so the sidebar spans the full page height in both dark and light modes.
compatibility: Requires agent-browser skill and a running dev server (make watch, default port 3000).
---

# Peaky Screenshots for Docs

Use this skill when capturing screenshots of Peaky pages for `site/docs/assets/images/`, changelogs, or MR descriptions.

## Key Problem

Peaky's left sidebar is `position: fixed; height: 100vh`. Using `agent-browser screenshot --full` captures the full document height but the sidebar only spans the viewport — leaving a blank gap below the last icon. The fix is to match the viewport height to the document height so no scroll is needed, then take a plain screenshot.

## Procedure

### 1. Activate agent-browser

```text
Skill: agent-browser
```

### 2. Set viewport width and navigate

Always use **1440px width**. Navigate to the target page and wait for it to fully load:

```bash
agent-browser set viewport 1440 900
agent-browser open http://localhost:3000/<path>
agent-browser wait --load networkidle
agent-browser wait 1500   # let JS finish rendering
```

### 3. Measure the document height

```bash
agent-browser eval 'document.documentElement.scrollHeight'
```

Note the returned value (e.g. `1016`).

### 4. Resize viewport to match and shoot (dark mode — default)

```bash
agent-browser set viewport 1440 <height>
agent-browser wait 500
agent-browser screenshot /Users/heitorl/DEV/orr/site/docs/assets/images/<name>-dark.png
```

Do **not** use `--full`. The sidebar will now stretch all the way to the bottom.

### 5. Switch to light mode and shoot

```bash
# Find the toggle ref
agent-browser snapshot -i 2>&1 | grep -E "Switch to light"
# Toggle
agent-browser click @eN
agent-browser wait 800
agent-browser screenshot /Users/heitorl/DEV/orr/site/docs/assets/images/<name>-light.png
```

Switch back to dark when done (`Switch to dark mode` button) so the app is left in its default state.

### 6. Close the browser

```bash
agent-browser close
```

## Finding Populated Pages

The dev seed data includes:

| Entity | ID / slug | URL |
|--------|-----------|-----|
| Team | `payments-scalability` | `/teams/payments-scalability` |
| Team review (62% complete) | `01932b3c-7d00-7000-8000-000000002001` | `/teams/payments-scalability/reviews/01932b3c-7d00-7000-8000-000000002001` |
| Product | `01932b3c-7d00-7000-8000-000000000001` | `/products/01932b3c-7d00-7000-8000-000000000001` |

### Navigating to sub-pages

Review rows in tables are not `<a>` tags — they use Vue click handlers. Use the cursor-interactive snapshot to click them:

```bash
agent-browser snapshot -i -C 2>&1 | grep "clickable"
agent-browser click @eN   # click the review row
```

Then look for sub-page links (Plan, Improvement Plan, etc.) in the standard snapshot:

```bash
agent-browser snapshot -i 2>&1 | grep -E "Plan|Improvement"
agent-browser click @eN
```

## Notes

- **Document height changes by page**: measure fresh for each new page; the product plan is ~1558px, the review plan is ~1016px.
- **Re-measure after navigating**: navigating to a different page resets the scroll height.
- **Always commit screenshots on the feature branch**, not main, unless they are not tied to a feature.
- Screenshots saved in `site/docs/assets/images/` are referenced from `site/docs/product_changelog.md` and MR descriptions using raw GitLab URLs.
