---
name: playwright-cli
description: Automates browser interactions for web testing, form filling, screenshots, and data extraction. Use when the user needs to navigate websites, interact with web pages, fill forms, take screenshots, test web applications, or extract information from web pages.
license: MIT
compatibility: Uses agent-browser (bundled). Node.js must be on PATH — see Environment Setup below.
metadata:
  author: converted from Claude Code format
  version: "2.0"
---

# Browser Automation (agent-browser)

> **Note:** This project uses `agent-browser`, not `playwright-cli`. All commands below use `agent-browser`.

## Environment setup

`agent-browser` requires `node` on PATH. Always prepend the corporate node bin before running any command:

```bash
export PATH="/usr/local/adyen/nodejs22/bin:$PATH"
```

Chain this into every shell invocation or set it once at the start of a multi-step workflow.

## orr-sample.vercel.app authentication

The live preview at `https://orr-sample.vercel.app` is behind a password gate. Whenever you navigate to any page on that domain and the page shows a password input, handle it automatically:

```bash
export PATH="/usr/local/adyen/nodejs22/bin:$PATH"
agent-browser open "https://orr-sample.vercel.app/some-page"
agent-browser wait --load networkidle
# If the page shows the Peaky password form, fill and submit it:
agent-browser fill @e1 "stijne"
agent-browser click @e2
agent-browser wait --load networkidle
```

To detect whether the password gate is showing, take an annotated screenshot after `open`:

```bash
agent-browser screenshot --annotate /tmp/check.png
# If refs include a textbox "Password" and button "Authenticate", fill them before proceeding.
```

## Quick start

```bash
export PATH="/usr/local/adyen/nodejs22/bin:$PATH"
# open and navigate
agent-browser open https://example.com
# take a screenshot
agent-browser screenshot /tmp/page.png
# take an annotated screenshot (shows numbered refs for interaction)
agent-browser screenshot --annotate /tmp/page.png
# interact using refs from the annotated screenshot
agent-browser fill @e1 "hello"
agent-browser click @e2
# close
agent-browser close
```

## Commands

See the built-in `agent-browser` skill for the full command reference. Key commands:

```bash
# Navigation
agent-browser open <url>
agent-browser wait --load networkidle
agent-browser get url

# Snapshots and screenshots
agent-browser snapshot -i                          # interactive elements with refs
agent-browser screenshot /path/file.png            # viewport screenshot
agent-browser screenshot --full /path/file.png     # full-page screenshot
agent-browser screenshot --annotate /path/file.png # numbered labels + refs

# Interaction (use @refs from annotated screenshot or snapshot)
agent-browser fill @e1 "text"
agent-browser click @e2
agent-browser press Enter

# Viewport
agent-browser set viewport 1440 900

# Tabs
agent-browser tab
agent-browser tab new <url>
agent-browser tab <index>

# Close
agent-browser close
```

## Example: Screenshot of orr-sample.vercel.app

```bash
export PATH="/usr/local/adyen/nodejs22/bin:$PATH"

# Open page and wait for load
agent-browser open "https://orr-sample.vercel.app/applications" && agent-browser wait --load networkidle

# Check if password gate is showing (look for "Password" textbox in annotated screenshot)
agent-browser screenshot --annotate /tmp/check.png

# If password gate present — refs will be @e1 (Password input) and @e2 (Authenticate button):
agent-browser fill @e1 "stijne" && agent-browser click @e2 && agent-browser wait --load networkidle

# Now take the actual screenshot
agent-browser set viewport 1440 900
agent-browser screenshot --full /path/to/output.png

agent-browser close
```
