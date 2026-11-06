# System health page

This page helps you quickly diagnose common issues with Peaky running in your browser.

![System page](../../assets/images/system-page.png#only-light)
![System page (dark)](../../assets/images/system-page-dark.png#only-dark)

Peaky uses a concept called local-first architecture to keep your data fast and available even when you're offline. This means Peaky stores transactions in your machine first, then selectively syncs them to the server.

That means even if you close your browser, restart your machine, or lose connectivity, your data is still there.

## The four signals

For each tile, you'll see a colour-coded indicator, a brief status message, and a simple explanation when clicking "What is this?" button:

| Colour      | Meaning                                                                              |
| ----------- | ------------------------------------------------------------------------------------ |
| **Green**   | When healthy                                                                         |
| **Amber**   | When worth a look                                                                    |
| **Red**     | When you need to act                                                                 |
| **Neutral** | When the state is benign but worth surfacing (`"Initializing…"`, `"Not synced yet"`) |

That should be more than enough to get a good grasp of what might be off so you can get faster support.

!!! info "Wanna become an expert?"
    If you however want to go beyond the surface for each area, continue reading.

### Database — your local copy

Peaky stores answers, Products, stable Templates, and draft Revisions in a small database that lives inside your browser. The Database tile says whether that database is up and ready to read and write. Draft Revision content is local-only during the current transport freeze.

![Database tile](../../assets/images/system-tile-database.png#only-light)
![Database tile (dark)](../../assets/images/system-tile-database-dark.png#only-dark)

<!-- markdownlint-disable -->
<div class="grid cards health-cards" markdown>

-   :material-check-circle:{ .lg .middle } **Healthy rhythm**

    ---

    Typically 50ms-500ms is considered good.

-   :material-alert:{ .lg .middle } **Signs of trouble**

    ---

    `"Initializing…"` hangs for seconds? → Hit refresh.

    Still red after a refresh? → use **[Recreate local DB](#recreating-local-db)** at the bottom.

</div>
<!-- markdownlint-enable -->

!!! tip "Why red?"

    There could be many reasons but the most common one is that a database upgrade failed.

    It can fail due to various reasons like corrupted data, network issues, a faulty upgrade, lack of storage space, etc.

Peaky anticipates many of these issues and tries to recover automatically. When it can't, it will bring up a recovery button for you.

### Sync — server vs browser

Sync carries your edits to the server. The tile tells you when the last successful round-trip happened and whether anything's queued.

![Sync tile](../../assets/images/system-tile-sync.png#only-light)
![Sync tile (dark)](../../assets/images/system-tile-sync-dark.png#only-dark)

<!-- markdownlint-disable -->
<div class="grid cards health-cards" markdown>

-   :material-check-circle:{ .lg .middle } **Healthy rhythm**

    ---

    "0–5 pending · last just now" while you type.
    
    It cycles every few seconds.

-   :material-alert:{ .lg .middle } **Signs of trouble**

    ---

    Dozens pending with no activity for minutes? → Check your network.

    **Failed** that doesn't recover next cycle? → Check `/events` and ping the support channel.

</div>
<!-- markdownlint-enable -->

!!! example "First-run state"
    On a fresh session with offline edits, the tile shows neutral `"Not synced yet · waiting for first sync"`.

    This is different from green `"In sync"`. Nothing is broken. It's simply that the first sync cycle hasn't happened yet.

### Storage — your browser's allowance

Browsers give each site a quota to avoid a single site/app consuming all your space.

The tile shows how much of yours Peaky has used so far.

![Storage tile](../../assets/images/system-tile-storage.png#only-light)
![Storage tile (dark)](../../assets/images/system-tile-storage-dark.png#only-dark)

<!-- markdownlint-disable -->
<div class="grid cards health-cards" markdown>

-   :material-check-circle:{ .lg .middle } **Healthy rhythm**

    ---

    A few MB on a normal workspace. Hundreds of MB if you've imported large templates with attachments — still fine.

-   :material-alert:{ .lg .middle } **Signs of trouble**

    ---

    Past 80%? → Archive a few reviews or flag it to your admin.

    Past 95%? → Writes start failing. Don't ignore it.

</div>
<!-- markdownlint-enable -->

!!! tip "Did you know?"
    Browsers ensure that no other site can access your Peaky data.

    Also, if you see `"Unknown"` for storage, it means your browser doesn't expose disk space metrics *(it's fine!)*.

### Schema — the shape of your data

We sometimes ship updates that need new fields or tables. The Schema tile tells you whether your local copy matches the version this build of Peaky expects. The stable Template/Revision Preview cutover intentionally resets legacy Template and dependent Review data in a bounded migration while preserving Product, Team, catalog, cursor, migration-log, and event data outside the reset manifest; it is not a general-purpose database wipe.

![Schema tile](../../assets/images/system-tile-schema.png#only-light)
![Schema tile (dark)](../../assets/images/system-tile-schema-dark.png#only-dark)

<!-- markdownlint-disable -->
<div class="grid cards health-cards" markdown>

-   :material-check-circle:{ .lg .middle } **Healthy rhythm**

    ---

    "Up to date" in green. That's the whole signal — no version numbers to memorise.

-   :material-alert:{ .lg .middle } **Signs of trouble**

    ---

    "Stuck — 7 updates pending" across two refreshes? → That's the rare case where **[Recreate local DB](#recreating-local-db)** is the right answer.

</div>
<!-- markdownlint-enable -->

## Recent activity

Below the tiles is a session-scoped feed: only events from the current browser tab, latest first. For older sessions, click **See full history in Events** in the header.

!!! example "When the session feed earns its keep"
    You hit save, the spinner blinks, you're not sure the change stuck. Glance at the feed — a `sync.cycle.completed` row in the last few seconds means the server has it. No need to refresh anything.

## Actions

### Clearing cache

Try this **first** when Peaky looks "off" after an update — wrong version, missing styles, buttons in the wrong place, a banner that won't go away. Your browser may still be serving an older copy of Peaky from its own private cache; this button forces a fresh download.

![Clear cache card](../../assets/images/system-clear-cache.png#only-light)
![Clear cache card (dark)](../../assets/images/system-clear-cache-dark.png#only-dark)

Your local data, sign-in, and theme are kept — this is the lighter recovery step.

!!! tip "Quick test before clicking"
    Open Peaky in an Incognito / Private window (Cmd+Shift+N on Chrome).

    If it works there but not in your main window, your main browser is serving an old cached copy and Clear cache is the right fix.

<!-- markdownlint-disable -->
<div class="grid cards health-cards" markdown>

-   :material-shield-check:{ .lg .middle } **Use this when**

    ---

    Peaky's looking different than your colleague's screen.

    A new feature was announced but you don't see it.

    The page styling looks broken or half-loaded.

    Refresh (Cmd+R) didn't help.

-   :material-shield-off-outline:{ .lg .middle } **Don't use this when**

    ---

    A specific review or product looks wrong — that's data, not browser cache.

    Sync hasn't finished — changes arrive in real-time via SSE, or via the 30-second polling fallback if SSE is disconnected.

    You're trying to log out — this keeps you signed in. Use the Profile menu instead.

</div>
<!-- markdownlint-enable -->

### Recreating local DB

The big warning button at the bottom is the recovery hatch for "my local copy is genuinely stuck".

It clears the browser's copy and reloads Peaky. Data already transported to the server is unaffected and can return through its declared channel. Local-only unpublished Template work is permanently lost because it has no event, outbox entry, or server copy.

<!-- markdownlint-disable -->
<div class="grid cards health-cards" markdown>

-   :material-shield-check:{ .lg .middle } **Use this when**

    ---

    The Database tile is red and a refresh doesn't fix it.

    The Schema tile shows **Stuck** across two or more reloads.

    The emergency banner says the local database is unrecoverable.

-   :material-shield-off-outline:{ .lg .middle } **Don't use this when**

    ---

    Sync is just slow — wait for the next cycle or refresh the page.

    A specific review looks wrong — the next sync usually reconciles.

    You're trying to "start fresh" — that's not what this is for.

</div>
<!-- markdownlint-enable -->

!!! warning "Unsynced and local-only work"
    The confirmation modal shows the count of queued unsynced edits. If it warns "5 unsynced changes will be lost", cancel, wait for sync to clear them, and try again.

    Template drafts do not enter that queue, so a zero count does **not** mean they are backed up. Export or otherwise preserve any unpublished Template work before recreating the database. If queued changes persist, ping the support channel.
