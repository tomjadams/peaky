# Peaky Visual Design System

This document defines the aesthetic standards for Peaky's UI — covering visual hierarchy, spatial composition, component styling, and interaction patterns. It complements the architectural patterns in `frontend.md`.

## Design Philosophy

**Clean, structured, professional** — Peaky balances enterprise credibility with approachable clarity. The interface avoids visual noise while maintaining enough density for serious workflows.

The light theme is **"Cartographer"**. Its principles apply to both themes unless a rule says otherwise:

- **Structure, not tone**: One white canvas (`#FFFFFF`) is both page background and surface. Separation comes from the survey tick, type scale, whitespace, and hairlines — never from tone shifts between "canvas" and "card".
- **Wells are for inputs only**: The one tinted surface (`#F4F5F7`) is for inputs, textareas, search, and quiet zones. Never a card background.
- **Generous whitespace**: Sections separate with 48–56px gaps; ~80px before a section that follows large numerals.
- **Color with intent**: Every colour has one job — Action for buttons/links, Index for numerals and route lines, Confirm for done/saved, Warn and Error for signals. Purple and pastel washes are banned outright.
- **Two-weight law**: Regular for data and content, semibold (600) for structure and labels. 700–800 only for numerals, titles, and primary actions.
- **Consistent radius**: 6–8px everywhere (`rounded-md` / `rounded-lg`). Larger card radii are retired.
- **No resting shadows**: Elevation exists only on floating overlays (menus, popovers, modals, the FAB): `0 8px 24px rgba(15,23,42,.10)`.
- **Cards are the last resort**: The one sanctioned heavy line per screen is the active editor card (white, 1px `#CBD5E1` border, 2px ink top rule).

## Screenshots Reference

Current UI patterns. All screenshots live in `site/docs/assets/images/` with a `-dark` variant for dark mode. Every screenshot below was recaptured against the settled Cartographer theme (August 2026) at 1440x1000, device pixel ratio 1. The Templates list and the Events feed are captured again now that both render — they were mid-flight in the Team-ownership refactor during the previous sweep. The one exception is the Applications subject detail page, which is in scope for shared-component updates only, not a visual migration; its capture is older and is not embedded in any page.

| Page | Light | Dark |
|------|-------|------|
| Teams dashboard | `teams-page.png` | `teams-page-dark.png` |
| Application details | `application-details-page.png` | `application-details-page-dark.png` |
| Review details | `review-details-page.png` | `review-details-page-dark.png` |
| Review details — history expanded | `review-details-page-history-expanded.png` | `…-dark.png` |
| Products list | `products-list.png` | `products-list-dark.png` |
| Product detail | `product-detail.png` | `product-detail-dark.png` |
| Product wizard (step 1) | `products-wizard-step1.png` | `…-dark.png` |
| Product assessment | `product-assessment.png` | `product-assessment-dark.png` |
| Product review detail | `product-review-detail.png` | `…-dark.png` |
| Product review wizard | `product-review-wizard.png` | `…-dark.png` |
| Template Studio | `template-studio-page.png` | `template-studio-page-dark.png` |
| Guided Drafting Room (question editing) | `drafting-room.png` | `drafting-room-dark.png` |
| New Review wizard (template selection) | `review-wizard-shelves.png` | `…-dark.png` |
| Template Studio — preview | `template-studio-page-preview.png` | `…-dark.png` |
| Templates list | `templates-page.png` | `templates-page-dark.png` |
| Events feed | `events-page.png` | `events-page-dark.png` |
| System page | `system-page.png` | `system-page-dark.png` |
| System tile — database | `system-tile-database.png` | `…-dark.png` |

## Layout Architecture

### Page Structure

```text
┌─────────────────────────────────────────────────────────┐
│  [Sidebar]  │  [Header: Breadcrumb + Actions]             │
│   80px      │────────────────────────────────────────────│
│   fixed     │                                             │
│  Peaky logo │  [Content Area]                             │
│  + wordmark │  ┌─────────────────────────────────────┐   │
│  ─────────  │  │  Cards / Tables / Forms             │   │
│  Nav icons  │  │                                     │   │
│  (People,   │  │  [Components on bg-muted]           │   │
│   Products, │  └─────────────────────────────────────┘   │
│   Apps,     │                                             │
│   Templates,│                                             │
│   Events,   │                                             │
│   Help)     │                                             │
│  ─────────  │                                             │
│  Settings   │                                             │
│  Profile    │                                             │
└─────────────┴─────────────────────────────────────────────┘
```

The sidebar is icon-only (no text labels on nav items). The Peaky logo with wordmark sits at the top. The active nav item adopts `text-primary` (sky). The header always shows a breadcrumb trail on the left and `Quick actions ⌘K` + dark-mode toggle on the right.

The Profile modal includes a temporary **Access on this device** disclosure until `/system` owns authorization diagnostics. It shows only the current actor's snapshot status, version, refresh and expiry times, and sorted View/Edit grants. It remains read-only and excludes credentials, tokens, other actors, and unrelated local data.

**Spacing scale**:

- Page padding: `p-6` (24px) or `p-8` (32px)
- Spacious default-layout data pages account for the fixed 80px sidebar with `pl-32 pr-12` (48px visible gutters), stepping to `pl-36 pr-16` (64px) at 1920px; do not combine that inset with root `ml-*` or `mx-*` margins, which makes the visible gutters unequal
- Internal padding of tables and editor cards: `p-4` to `p-6`
- Section gaps: 48–56px (`space-y-12` to `space-y-14`)
- Before a section that follows large numerals: ~80px (`pt-20`)

**Responsive width tiers:** Wide desktop starts at 1920px, not at Tailwind's `2xl` breakpoint. Below it, preserve each page's normal content cap. At 1920px, dense list and table pages may relax outer margins and widen to a 1920px cap. Reading and editing pages keep narrower caps. Never let free width stretch a control away from the content it changes.

Assessment uses one grid below the app navigation. Below wide mode it has a 232px route rail and a workspace capped at 1152px; compact mode uses a 96px rail. At 1920px it becomes a 264px rail and a 1600px content grid with a 1248px workspace, a 320px progress rail, and a 32px gap. Use `minmax(0,1fr)` and `min-w-0` on flexible tracks. Respect the saved rail preference; default to compact below 1280px only when no preference exists.

### Structural Separation

Light mode has one surface. Hierarchy comes from structure, not tone shifts:

```text
Canvas #FFFFFF (page AND surface)
    │
    ├─ Wells #F4F5F7 — inputs, textareas, search, quiet zones only
    ├─ Survey tick + title scale + whitespace — section separation
    ├─ Tables — the only full-width horizontal lines
    └─ Overlays (menus, popovers, modals) — the only shadows
```

Dark mode keeps its existing layered surfaces (canvas → elevated → muted), but the same structure rules apply: ticks instead of section rules, lines only in tables, no resting shadows.

## Dark Mode

**The app defaults to light mode** (`colorMode.preference: "light"` in `nuxt.config.ts`); existing users keep their stored choice, and dark mode is one click away via the header toggle. Every component must look correct in both modes.

| Role | Light ("Cartographer") | Dark |
|------|------------------------|------|
| Page canvas | white `#FFFFFF` — also the surface | slate-950 `#020617` |
| Card / panel surface | white `#FFFFFF` — no separate tone | slate-800 `#1e293b` |
| Well (inputs, quiet zones) | `#F4F5F7` | slightly-elevated dark surface |
| Hairline border | `#DDE6EE` | slate-700 `#334155` |
| Strong border / table header rule | `#CBD5E1` | slate-700 `#334155` |
| Table row line | `#EEF3F8` | low-alpha white |
| Text (headings, body) | ink `#0F172A` (~17:1) | slate-200 |
| Text secondary | `#475569` (7.5:1) — darkest grey allowed for copy | slate-400 |
| Text faint (14px+ only) | `#64748B` | slate-500 |

**Dark mode is not redesigned.** All type, spacing, weight, and structure rules apply to it unchanged. Only colors remap: keep the existing dark palette hues; survey ticks and Index accents may need sky-400/500 for contrast; wells become slightly-elevated dark surfaces; table lines become low-alpha white.

## Color Usage (Semantic First, With Flexibility)

### Philosophy

**Prefer semantic colors** for consistency and maintainability, but **allow intentional bespoke colors** when:

1. The semantic palette doesn't cover the use case
2. The color serves a specific, documented purpose
3. There's a plan to converge it into the system over time

### Primary Palette

Light mode uses the deeper Cartographer values; dark mode keeps its existing hues.

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Action | `#0369A1` (hover `#075985`) | Sky 500/600 | Buttons, links, active nav, focus ring |
| Index | `#0284C7` | Sky 400/500 | Large numerals, route/progress lines, survey ticks — never body text |
| Confirm | `#15803D` | Green 500 | Done/saved only |
| Warn | text `#92400E` on tint `#FDF3E3`, border `#EDDCC0`, mark `#B45309` | Amber 500 | Caution states, attention counts |
| Error | `#B91C1C` | Red 500 | Destructive actions, urgent status |
| Sky tint | `#EAF3FA` | sky at low alpha | Selected states, zoning |
| Neutral | Slate | Slate | Text, borders, wells |

**Purple and pastel washes are banned outright** — in both modes.

### Status Colors (Critical for Recognition)

| Meaning | Badge colour | Usage |
|---------|--------------|-------|
| Ready, Completed | `success` | Finished or operational |
| Active | `success` | Available or operational, not merely underway |
| In Progress | `primary` | Work underway |
| Draft, Inactive, Archived | `neutral` | Non-active lifecycle state |
| Action Needed, Blocked, Failed | `error` | Intervention required |
| Pending | `warning` | Waiting or caution is the point |

Map status by meaning, not spelling. Work underway is Primary; Warning is reserved for waiting or caution. No and N/A answers are never Error states.

### Background Scale

Prefer semantic classes. In light mode the canvas is the surface — most of these resolve to the same white:

```text
bg-default     → Canvas (white in light; base layer in dark)
bg-muted       → Well #F4F5F7 — inputs, textareas, search, quiet zones ONLY
bg-elevated    → Overlays (menus, popovers, modals); dark-mode cards
bg-accented    → Selected/highlighted areas (sky tint #EAF3FA in light)
```

Never use the well as a card background. In light mode a "card" is just structure on the canvas.

### Text Hierarchy

```text
text-highlighted    → Page titles, key numbers (ink #0F172A in light)
text-default        → Primary content, labels (ink #0F172A in light)
text-muted          → Secondary info, descriptions (#475569 — darkest grey allowed for copy)
text-dimmed         → Placeholders, hints (#64748B — only at 14px and above)
```

### Extension Colors (Approved Bespoke)

These colors are approved for specific use cases not covered by the semantic palette. They should be used consistently for their documented purpose.

| Color | Use Case | Notes |
|-------|----------|-------|
| `amber-*` | Dark-mode warning/highlight states | Light mode uses the fixed Warn set (`#92400E` on `#FDF3E3`, mark `#B45309`) |
| `emerald-*` | Dark-mode alternative success | When green-500 conflicts with the background |

`orange-*` (low-value progress bars) and `violet-*` (chart and canvas accents) are **retired**. Progress lines fill with Index sky and turn Confirm green at 100%; charts use Index sky. Purple is banned.

**Guidelines for extension colors:**

- Document the use case when introducing
- Use consistent shades (e.g., always amber-500 for warning icons)
- Prefer lighter backgrounds with darker text for badges

### Proposing New Extension Colors

When you need a color not in the palette:

1. **Check if semantic works first** - Can `color="primary"` or `text-muted` serve the purpose?
2. **Document the use case** - Why does this need a bespoke color?
3. **Add to Extension Colors table** - If approved, document here for consistency
4. **Plan convergence** - If used broadly, consider adding as a new semantic color

### When to Flag vs Allow

| Situation | Severity | Action |
|-----------|----------|--------|
| Random color with no pattern | CRITICAL | Replace with semantic or document |
| Extension color used correctly | OK | Already approved |
| Extension color with new use case | WARNING | Document or find alternative |
| Repeated bespoke color (3+ places) | NOTE | Consider adding to palette |

## Typography

Public Sans (self-hosted via `@fontsource/public-sans`) is the only typeface. The scale is **theme-agnostic** — the same rules apply in light and dark mode.

| Role | Spec |
|------|------|
| Page title | 30px / 800, letter-spacing -0.015em |
| Section title | 26px / 800, under a survey tick |
| App body | 16px / 400, line-height 1.6 |
| Shell / marketing body | 18–20px |
| Label | 14px / 600, sentence case |
| Meta | 13px — the floor. 10–12px is retired everywhere. |
| Assessment question | 17px / 400 with relaxed leading; 18px at 1920px |
| Survey question | 34px / 700; 44px at 1280px; 48px at 1536px |
| Metric | 32px / 800, leading-none and tabular; 40px at 1920px |
| Display numerals | tabular, 800, Index sky at display scale |

**Two-weight law**: regular (400) for data and content; semibold (600) for structure and labels. 700–800 is reserved for numerals, titles, and primary actions.

**Eyebrow micro-caps are banned.** No uppercase + tracking + tiny-size labels — table headers and section labels are 14px/600 sentence case.

## Component Aesthetics

### Buttons

"Instrument keys" — one button system, everywhere. Geometry is identical across variants; only color and state behavior change. It's configured once in `app/app.config.ts` (`ui.button`), so every `UButton` picks it up automatically — hand-rolled CTAs (the shell's three Okta buttons — nav, hero, footer — are all raw `<button>` markup, not `UButton`) are hand-matched to the same values instead of drifting.

**The shell shows exactly one filled button per viewport.** The hero CTA is the page's one solid action (`h-12`, `rounded-[7px]`, `border-[1.5px]`, Action fill, press-nudge on active, no gradient/shadow); nav and footer are drafted outlines instead of duplicate solids — 1.5px `#CBD5E1`/`slate-600` border, ink text, alpha-tint hover well — so the three read as one system (nav and footer rhyming, hero the single "press me").

- **Geometry** — radius `rounded-[7px]` (its own value, distinct from the 8px used by cards/inputs/menus, so buttons read as a specific kind of control). Heights `sm` 36px / `md` 44px / `lg` 48px, padding to match. Label 15px at `md`, 16px at `lg`, sentence case always. Icons 16–18px, `gap-2`. Focus-visible ring: 2px Action, offset 2 — every variant, not just primary. Transition: `150ms`, colors and transform only.
- **Primary** (`solid` + `color="primary"`, the default): fill is Action (`#0369A1`). Hover **darkens the fill** to Action-hover (`#075985`) — this is a real color swap, not an opacity fade. Never ship `hover:bg-primary/75` on a button. Active darkens one step further and nudges `translate-y-[0.5px]` — a key being pressed. Disabled drops to 45% opacity with no hover response.
- **Secondary** (`outline` + `color="neutral"`): white/transparent fill, a 1.5px Border-strong ring. Hover fills the well (`bg-muted`) and darkens the border one step; active repeats that plus the press nudge. No color tints — this is a structural button, not a tinted one.
- **Ghost / Text** (`ghost` / `link` + `color="neutral"`): muted text, no border, ever. Hover resolves to ink text with a well fill (`ghost`) or just darkens straight to ink (`link`).
- **The one shadow exception:** the primary fill's bottom edge carries a subtle inset shadow — `shadow-[inset_0_-1px_0_rgba(2,44,69,0.45)]` — read as a machined, pressed-key edge, not a drop shadow. It is the single sanctioned resting shadow on any button; nothing else gets one.
- **Dark mode:** identical geometry and state behavior. Dark keeps its existing primary hue (sky); hover/active still darken, just within that hue. Check every new button in both themes before shipping.

```vue
<!-- Primary — needs nothing but the label; color/variant default to this -->
<UButton>Continue with Okta</UButton>

<!-- Secondary — cancel / secondary actions -->
<UButton variant="outline" color="neutral">Cancel</UButton>

<!-- Ghost — icon-only row actions -->
<UButton variant="ghost" color="neutral" icon="i-lucide-ellipsis" size="sm" />
```

### Stat Blocks

Dashboard metrics are **stat blocks, not cards** — no border, no background, no shadow. The numbers do the work. This replaces the old gradient/bordered stat cards.

```vue
<!-- Visual: bare block, large tabular number, thin progress line -->
<div>
  <div class="text-[15px] font-medium text-muted">Open follow-ups</div>
  <!-- Value: ink; #B45309 amber for attention counts -->
  <div class="mt-1 text-[32px] font-extrabold leading-none tabular-nums text-highlighted min-[1920px]:text-[40px]">42</div>
  <div class="text-sm text-muted">across 3 reviews</div>
  <!-- Optional 4px progress line: track #DDE6EE, fill #0284C7 (index), #15803D at 100% -->
  <div class="mt-3 h-1 w-full rounded-full bg-[#DDE6EE]">
    <div class="h-1 rounded-full bg-[#0284C7]" style="width: 65%"></div>
  </div>
</div>
```

Values are tabular numerals at 800 in ink. Attention counts (e.g. overdue items) render the value in the Warn mark colour (`#B45309`) instead.

### Stat Strip — the Surveyor's Plate

`StatStrip.vue`, the row container around a set of Stat Blocks, is the one deliberate exception to "no border, no card": a drafted survey plate, not a tinted card. This is the **only** StatStrip look — there is no bare/plain variant.

- **Ground**: chart-paper cream `#F9F7F2`, border `#E8E3D9`, bottom edge `#DBD4C4` — a deeper warm on the bottom only, reading as the plate's thickness (print-bevel, zero shadow). 2px ink top rule. A second inner hairline (`#E3DDD0`, inset 6px — a "neatline") quotes a drafted map's frame. Dark mode shares the elevated `primary/10` ground and skips the neatline/edge nuance; linework alone carries it there.
- **Engraving is drafted chart geometry, not generated organic curves.** An earlier pass baked wobbled-ellipse contour rings and terrain lines from splines; at page scale those read as wood grain and knots, not a chart. The engraving is three plain elements, lifted to page-scale presence (v4 — the earlier pass only rewarded zooming in): a **graticule** (a regular grid of small "+" crosses, the lat/long marks every chart carries, 0.12 light / 0.09 dark); an **edge-cropped compass rose** anchored just outside the plate's top-right corner so only a wedge shows — inner circles and degree ticks (0.12/0.09), radial spokes (0.18/0.14), and the outer ring (0.26/0.20) as the strongest blue element; and one **dotted route** with 3 waypoints, confined to the lower-right quadrant so it never crosses under the first two columns' numerals (0.22 light / 0.16 dark). A horizontal mask holds ~35% line visibility at the far left, ramping to full strength by ~55% width — one continuous plate, never faded to nothing, while the numeral zone stays quiet. A fully-visible rose or ring reads as a sticker; edge-cropping reads as a window into a larger chart sheet.
- **Two-ink printing**: the needle diamond — the rose's "jewel" — takes a muted warm amber (the warning family's ink) at 0.38 light / 0.30 dark instead of the traditional red; the destination ring takes a confirm green (the success family's ink), also 0.38/0.30, echoing the landing route map's arrival ring and the pillar-complete bars. Everything else stays index blue — three inks total, no new hues.
- **The plate comes alive once**: on first scroll-reveal (never re-triggered) the route mask-wipes in over ~900ms — the same mask-wipe recipe `LandingRouteMap.vue` introduced, on the plate's own clock (the landing map itself now draws over ~1100ms) — and the compass needle fades + scales into place over ~400ms — not `LandingCompassRose.vue`'s rotation settle, since that recipe's full swing would carry this needle's thin edge-cropped sliver off-plate for most of the animation instead of visibly settling. The destination ring appears once the draw finishes. Graticule and circles simply arrive with the plate. `prefers-reduced-motion` snaps straight to the settled plate.
- **Dividers are scale ticks, not borders**: a 1×10px tick (ink 30% light / white 35% dark) hangs from the top rule at each column boundary — no full-height `border-l`, which reads as a table rule on chart paper.
- **Chart paper is a StatStrip-only material.** `#F9F7F2` never spreads to cards, wells, or any other surface, and must read as visually distinct from the Warn tint (`#FDF3E3`) — both are warm, but they are unrelated systems.

### Sections (Instead of Content Cards)

Do not wrap page content in bordered cards. A section is a survey tick + a section title + whitespace:

```vue
<section class="pt-12">
  <!-- Survey tick: 40×3px, index sky, radius 2. Replaces ALL full-width section rules. -->
  <div class="mb-3 h-[3px] w-10 rounded-[2px] bg-[#0284C7]" />
  <h2 class="text-[26px] font-extrabold text-highlighted">Review history</h2>
  <!-- Content sits directly on the canvas -->
</section>
```

- Sections separate through tick + title scale + whitespace: 48–56px gaps, ~80px after large numerals.
- Full-width horizontal rules between sections are banned. Lines live only inside tables.
- Severity belongs in a dot, badge, or label — not a colored outline or rail.
- Gradient washes, top rails, and partial borders for generic section separation remain banned.
- **Collapsible sections reduce overwhelm**: default the first severity group expanded and collapse the rest. Store collapsed state in a `ref<Set<string>>` of severity slugs. The collapse header is a 14px/600 sentence-case label row, not a card header.

### The Active Editor Card

Cards are the last resort. The **one sanctioned heavy line per screen** is the active editor card — e.g. the expanded question card in Template Studio:

```vue
<!-- White, hairline #CBD5E1 border, 2px ink top rule. One per screen. -->
<div class="rounded-lg border border-[#CBD5E1] border-t-2 border-t-[#0F172A] bg-default p-6">
  <!-- Editing controls -->
</div>
```

Everything not being edited sits directly on the canvas.

**The rule may be inked by meaning, never by decoration.** Where the thing being edited carries a state worth reading at a glance, that state colours the rule instead of plain ink — the only sanctioned case today is Template Studio's question card, where severity inks it (Error `#B91C1C` critical, Warn `#B45309` high, plain ink medium/unset; see Compact Mode). One heavy rule, one meaning; a rule tinted for looks is not allowed.

**The rule is handed over, never stacked.** When an active editor opens on top of a surface that already carries the rule, the surface behind it drops to a hairline. In Template Studio the pillar sheet keeps the rule while the question list is at rest and yields it to the expanded question card while a question is open — exactly one heavy ink rule is painted at any moment.

**Empty States**:

```vue
<!-- Dashed hairline for "drop here" or "select to start" -->
<div class="rounded-lg border-2 border-dashed border-default p-12">
  <div class="flex flex-col items-center text-center">
    <UIcon name="i-lucide-box" class="text-4xl text-dimmed" />
    <h3 class="mt-4 font-medium text-default">Select a pillar</h3>
    <p class="mt-1 text-sm text-muted">
      Choose a pillar from the tabs above to start editing
    </p>
  </div>
</div>
```

### Tables

Tables are the **only** place full-width horizontal lines are allowed.

- Header: 14px/600 in Text-2 (`text-muted`), sentence case, with sort icons. No uppercase, no tracking.
- Header rule: 1px `#CBD5E1` under the header row
- Row lines: 1px `#EEF3F8` between rows (low-alpha white in dark mode)
- Cells: 16px ink, vertical padding ≥18px (`py-[18px]` or more)
- At 1920px: headers and supporting values may step to 16px, primary cells to 17px, and row padding to 20px
- Rows: alpha-tint hover (see Hover States); whole-row activation is keyboard reachable and responds to Enter
- Whole-row activation ignores links, buttons, form controls, and the actions cell
- Status column: Badge with subtle variant
- Actions: Right-aligned, visible, and reachable without hover

```vue
<table class="w-full">
  <thead class="border-b border-[#CBD5E1] dark:border-gray-700">
    <tr>
      <th class="py-3 text-left text-sm font-semibold text-muted">
        Name <UIcon name="i-lucide-arrow-up-down" class="ml-1 inline" />
      </th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-[#EEF3F8] transition-colors hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]">
      <td class="py-[18px] text-base text-default">Value</td>
    </tr>
  </tbody>
</table>
```

**Do not use `divide-y divide-default` for row separators** — the `--color-default-border` token collapses to near-zero contrast in dark mode regardless of background. Use an explicit `border-b` per row: `#EEF3F8` in light, low-alpha white (`dark:border-white/10`) in dark.

### Tables — Sheets

Search, filters, and counts used to float above tables as afterthoughts — every page invented its own idiom. Now every table is a bounded **sheet**: `DataTable.vue`'s existing `.data-table-surface` (canvas, 1px hairline, `rounded-lg`) owns a **title block** and a **footer rail** inside its own border, so the sheet reads as one object — title, search, data, count — instead of a bare table with furniture scattered around it.

All of this is opt-in on `DataTable.vue` — a table with none of the new props renders exactly as it always has, which is why embedded tables (the review Breakdown table, the events feed, Recent Changes) stay bare.

```vue
<DataTable
  :columns="columns"
  :data="rows"
  title="Teams"
  item-noun="teams"
  :total-count="teams.length"
  :filtered-count="filteredTeams.length"
  empty-message="No teams yet."
  filtered-empty-message="No matches for your search."
  aria-label="Teams table"
>
  <template #console>
    <SearchInput v-model="search" placeholder="Search teams..." class="w-72" />
    <USelect v-model="orgFilter" :items="orgOptions" size="md" />
  </template>
</DataTable>
```

- **Title block** — renders only when `title` or the `#console` slot is given. `px-6 pt-5 pb-4`, title 16px/600 `text-highlighted`, no survey tick (ticks are page-section vocabulary — a sheet's title block is its own thing). The console — search plus filters — sits to the right in a `gap-3` row. A `border-b` in row-line separates it from the header row.
- **Footer rail** — renders only when `total-count` is given. `border-t` row-line, `px-6 py-3`, `min-h-14` so a future 32px pagination control row drops in with zero vertical shift. Left: count text, 14px `text-muted` tabular-nums — `"{N} {noun}"` normally, `"{K} of {N} {noun}"` once `filtered-count` is below `total-count`. Right: `#footer-trailing`, reserved for export/pagination.
- **Filtered-empty state** — `filtered-empty-message` shows instead of `empty-message` when a search or filter narrows a non-empty table to zero rows, so "No teams yet." (nothing has ever been created) reads differently from "No matches for your search." (something exists, the filter just hid it).
- **Sort affordance** — the active sorted column shows one directional arrow (`arrow-up`/`arrow-down`, `text-primary`); inactive sortable columns show the `arrow-up-down` hint only on hover/focus (`opacity-0` → `opacity-100`), so idle headers stay quiet.
- **Actions column** — a column keyed `"actions"` gets a visually-hidden (`sr-only`) header label; a column of controls explains itself, and the cell stays right-aligned.

**Filter chips** (`FilterChips.vue`) are the one canonical chip, replacing three divergent styles (solid/outline toggle buttons, hand-rolled `<button>`s, pill badges):

```vue
<FilterChips
  :model-value="statusFilter"
  :options="[
    { label: 'Active', value: 'active', count: activeCount },
    { label: 'Archived', value: 'archived', count: archivedCount },
  ]"
  @update:model-value="(v) => (statusFilter = v)"
/>
```

Selected: `bg-primary/10 text-primary font-medium`. Unselected: `text-muted hover:text-default`, transparent, no border. Both: `text-sm px-3 py-1.5 rounded-[7px]`, focus-visible ring.

**Action compression** governs what a row is allowed to show:

- A row has one view destination. The name link and whole-row activation may share it, but never add a duplicate "View" button.
- At most **one** quiet action stays visible: `variant="ghost" color="primary"`, e.g. "Start review".
- Everything else — Archive, Restore, Delete — folds into a single `⋯` overflow: `variant="ghost" color="neutral"` `icon="i-lucide-ellipsis"` `aria-label="More actions"`.
- Destructive actions live **inside that menu only**, styled `color="error"` on the `UDropdownMenu` item, and still route through a confirm dialog — never a bare destructive button on the row.

**Reserved: pagination.** Designed now, not wired. The footer rail's right side is where it lands: a range string ("1–25 of 118", 14px tabular), ghost prev/next instrument keys, and an optional page-size select. Because the rail is already sized for a 32px control row, turning pagination on later costs no layout shift. The CSV export control's future home is the same slot, `#footer-trailing`.

The Template library uses its whole row as a safe view action. It opens the current published Revision when one exists, otherwise it opens the draft in explicit view mode. The table never shows Edit or duplicate View buttons. Actors with draft edit access get one "Edit draft" action in the read-only notice, making the transition into authoring deliberate and keeping it close to the state it changes. The same transition is available as "Edit draft template" in the command palette only while that Template Studio view is read-only and the actor has edit access; Template library commands remain View actions.

### Form Elements

**Inputs** (Search, text entry):

- **Surface**: Inputs, textareas, and search sit on the well (`#F4F5F7`) in light mode — the only tinted surface. Never reuse the well as a card background.
- **Border**: Hairline `#DDE6EE`; focus ring 2px `#0369A1`
- **Size**: `size="md"` for most cases, `size="lg"` for prominent search
- **Radius**: Always `rounded-lg` (8px, inherited from NuxtUI config)
- **Icon**: Leading search icon in muted color
- **Width**: `w-full` within container

```vue
<!-- Good: Prominent search input -->
<UInput
  v-model="search"
  size="lg"
  placeholder="Search applications..."
  class="w-full"
>
  <template #leading>
    <UIcon name="i-lucide-search" class="text-dimmed" />
  </template>
</UInput>

<!-- Good: Standard form input with label — labels are 14px/600 sentence case -->
<UFormField label="Application name" required>
  <UInput size="md" placeholder="e.g., Peaky API" />
</UFormField>
```

**Text Areas**:

- Use for multi-line content (description, notes)
- `size="md"` with appropriate rows (4-6 typically)
- Same styling as inputs (rounded-lg, ring border)

**Buttons**: geometry, states, and the color recipe live in [Buttons](#buttons) under Component Aesthetics. Which `color`/`variant` to reach for, by purpose:

| Purpose | Style | Example |
|---------|-------|---------|
| Primary action | `color="primary"` `variant="solid"` size="md/lg" | "+ New application" |
| Secondary | `color="neutral"` `variant="outline"` | "Cancel" |
| Destructive | `color="error"` `variant="soft"` — `#B91C1C` in light | "Delete" |
| Icon action | `color="neutral"` `variant="ghost"` size="sm" | Row actions |

Button labels are sentence case.

**Dropdown / Select Menus**:

- White, 1px `#DDE6EE` border, radius 8 (`rounded-lg`)
- Overlay shadow: `0 8px 24px rgba(15,23,42,.10)` — menus are overlays, the only place shadows exist
- Options: 15px, sentence case
- Selected option: sky-tint (`#EAF3FA`) background plus a check mark
- Leading coloured dots only when they carry meaning (risk levels) — never as decoration

**Assessment Answer Group** (Yes/No/N/A — see Extended Component Patterns for the full pattern):

```vue
<fieldset>
  <legend class="sr-only">Answer for question REL-1</legend>
  <UFieldGroup size="sm">
    <UButton
      v-for="option in options"
      :key="option.value"
      color="neutral"
      :variant="answer === option.value ? 'solid' : 'outline'"
      :aria-pressed="answer === option.value"
    >
      {{ option.label }}
    </UButton>
  </UFieldGroup>
</fieldset>
```

All three values use the same neutral selected treatment. Selection communicates state, not correctness.

### Navigation

**Sidebar**:

- Fixed 64px width
- Logo at top, centered
- Icon-only navigation with tooltips
- Active state: `bg-muted` or `text-primary`
- Bottom section: Settings, Profile

**Breadcrumbs**:

- `text-sm` with `text-muted` and `text-default` for current
- Separator: `/` or chevron icon
- First item often clickable (Dashboard)

```vue
<nav class="flex items-center gap-2 text-sm">
  <NuxtLink to="/" class="text-muted hover:text-default">Dashboard</NuxtLink>
  <UIcon name="i-lucide-chevron-right" class="text-dimmed" />
  <span class="text-default">Applications</span>
</nav>
```

**Tabs and filter chips**:

Filters are chips, not tabs. Use `FilterChips` for query and surface filters; chips wrap and expose `aria-pressed`. Use tabs only to switch one content region, such as templates in a review breakdown or pillars while the assessment rail is compact. Tabs need a structural active cue, keyboard selection, and horizontal scrolling when labels do not fit. Counts and percentages use tabular numerals.

## Interactive Patterns

### Hover States

All interactive elements need clear hover feedback:

```vue
<!-- Row hover — use opacity tint, not semantic bg classes.
     hover:bg-muted on a bg-default table matches the page canvas in dark mode,
     making the row visually disappear. Raw alpha tints work in both modes. -->
<tr class="transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">

<!-- Clickable area hover — tint or border emphasis, never a shadow -->
<div class="transition-colors duration-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">

<!-- Button hover (built into NuxtUI, but verify visible) -->
<UButton ...>  <!-- Check: visible background change -->

<!-- Link hover -->
<a class="text-primary hover:text-primary-700 transition-colors">
```

> **Why not `hover:bg-muted`?** The semantic background tokens (`bg-muted`, `bg-default`, `bg-elevated`) map to different depths in light and dark mode. A hover that goes from one depth to another can accidentally match an adjacent surface. Raw alpha tints (`bg-white/[0.04]`, `bg-black/[0.03]`) always produce a visible contrast delta regardless of the base surface.

### Progress Indicators

**Linear Progress** (dashboard stats, assessment completion):

A 4px line. Track `#DDE6EE`, fill Index `#0284C7`, switching to Confirm `#15803D` at 100%. No value-based colour ramps — orange/amber progress is retired.

```vue
<div class="h-1 w-full rounded-full bg-[#DDE6EE]">
  <div
    class="h-1 rounded-full transition-all duration-500"
    :class="value >= 100 ? 'bg-[#15803D]' : 'bg-[#0284C7]'"
    :style="{ width: `${value}%` }"
  />
</div>
```

**Survey Progress Track**:

Survey mode uses the flat progress track motif — a thin track with a waypoint circle at the current position. Never an ascending chart (see Motifs).

```vue
<!-- Compact progress display on review details / assessment pages -->
<div class="mb-8">
  <div class="flex items-center justify-between text-sm">
    <span class="text-muted">Overall progress</span>
    <span class="text-dimmed">16 / 25 questions answered</span>
  </div>
  <div class="relative mt-2 h-1 rounded-full bg-[#DDE6EE]">
    <div class="h-1 rounded-full bg-[#0284C7] transition-all duration-500" style="width: 64%" />
    <!-- Waypoint circle at the current position -->
    <div class="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#0284C7] bg-default" style="left: 64%" />
  </div>
</div>
```

### Empty States

Every list/table needs a designed empty state:

```vue
<div class="flex flex-col items-center justify-center py-16 text-center">
  <div class="rounded-full bg-muted p-4">
    <UIcon name="i-lucide-inbox" class="text-3xl text-dimmed" />
  </div>
  <h3 class="mt-4 font-medium text-default">No applications yet</h3>
  <p class="mt-1 max-w-sm text-sm text-muted">
    Get started by creating your first application to assess
  </p>
  <UButton color="primary" class="mt-6">Create application</UButton>
</div>
```

### Loading States

**Skeleton Loading** (preferred over spinner for content):

```vue
<div class="animate-pulse space-y-4">
  <div class="h-4 w-3/4 rounded bg-muted" />
  <div class="h-4 w-1/2 rounded bg-muted" />
</div>
```

**Button Loading**:

```vue
<UButton loading>Loading...</UButton>
<!-- Or: -->
<UButton :disabled="loading">
  <UIcon v-if="loading" name="i-lucide-loader" class="animate-spin" />
  Save
</UButton>
```

## Motion & Transitions

### Principles

- **Fast**: 150-200ms for micro-interactions
- **Smooth**: `ease` or `ease-out` curves
- **Purposeful**: Motion indicates state change

### Vue Transitions

**Page/Content Fade**:

```vue
<Transition name="fade" mode="out-in">
  <component :is="currentView" />
</Transition>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}</style>
```

**List Stagger**:

```vue
<TransitionGroup name="list">
  <div v-for="item in items" :key="item.id" class="transition-all">
    {{ item.name }}
  </div>
</TransitionGroup>

<style>
.list-move, .list-enter-active, .list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}</style>
```

### Hover Transitions

```css
/* Standard hover transitions */
transition: colors 0.15s ease;
transition: all 0.2s ease;
```

### Scroll Reveal & Wayfinding (Shell)

The shell page (`app/components/landing/`) carries a heavier, one-time entrance system on top of the micro-interaction rules above. It exists only there — product screens keep the 150–300ms rules.

**The reveal recipe** — one recipe, reused everywhere something enters:

```css
/* from */
opacity: 0;
transform: translateY(12px);
filter: blur(5px);

/* to, 700ms cubic-bezier(0.22, 1, 0.36, 1) */
opacity: 1;
transform: none;
filter: blur(0);
```

Only `transform`, `opacity`, and `filter` ever animate — nothing that triggers layout. Elements within a group stagger roughly 120ms apart (hero dash → headline → sub → CTA → meta; journey/way columns cascade left to right) using `animation-delay` on the same keyframe.

**Scroll sections reveal once.** Below-the-fold sections use `useRevealOnce()` (`app/composables/useRevealOnce.ts`), a thin wrapper over `@vueuse/core`'s `useIntersectionObserver`: the first time the target crosses into view it flips a ref to `true` and stops observing. It takes an optional `{ threshold, rootMargin }` (default `0.25` / `"0px"`, matching the original behavior); the shell's two below-fold sections pass `rootMargin: "0px 0px -20% 0px"` so a section has to scroll 20% up from the viewport's bottom edge before revealing, instead of firing the instant its first pixel is visible. Nothing re-triggers scrolling back up. On the landing shell those sections rest as a ghost, not hidden: `opacity 0.45`, `blur(4px)`, 10px low — readable as words but clearly out of focus (depth-of-field, never fog), sharpening into place on reveal via `landing-sharpen`. The blur is tuned to the narrow band where it reads as intent: heavier smears into a rendering artifact, lighter gives the content away and the sharpen loses its payoff.

```ts
const sectionRef = ref<HTMLElement | null>(null);
const revealed = useRevealOnce(sectionRef); // true once, then stays true

// stricter — fires later, once the section has meaningfully entered view
const revealedLate = useRevealOnce(sectionRef, {
  rootMargin: "0px 0px -20% 0px",
});
```

**Two wayfinding beats**, each fires once and then holds still:

- `LandingCompassRose.vue` — the needle settles on load over 1500ms `ease-out` with overshoot (it rotates past rest, then eases back).
- `LandingRouteMap.vue` — the route draws on scroll via a mask wipe over ~1100ms `cubic-bezier(0.22, 1, 0.36, 1)`; waypoint circles pop in as the wipe reaches them at 275/495/825ms; the destination gets one pulse ring at 1100ms, then goes still.

**One progressive-enhancement exception to "never scrubbed":** the four "How the pieces connect" journey columns normally cascade in on a fixed post-reveal time stagger, same as any other group. Where `@supports (animation-timeline: view())` holds, they instead use `animation-timeline: view()` with `animation-range: entry 10% entry 45%`, so each column's entrance tracks its own scroll position instead of firing on a shared timer. Unsupported browsers keep the time-staggered version; both stay behind `.motion-armed .is-in` (so SSR/no-JS still renders visible) and both are neutralized under `prefers-reduced-motion`. Everywhere else in the app, motion still never ties to scroll position.

**Stillness after settle.** Nothing on the shell loops — no ambient motion, no idle pulsing, no infinite animation once the entrance and wayfinding beats finish.

**`prefers-reduced-motion: reduce` must render the finished page**, not a slower version of the animated one: final opacity, final position, no blur, `animation: none` on every reveal. This is a hard requirement, not a nice-to-have — every shell component with a `.style` block pairs its keyframes with a `@media (prefers-reduced-motion: reduce)` override.

**Hidden states arm only after hydration.** `opacity: 0` and friends live behind an `armed`/`motion-armed` class toggled in `onMounted()`, never in the template's initial class list. SSR markup, no-JS, and the pre-hydration frame all render fully visible — the class is what turns a static page into a reveal, not what hides content from slow connections.

## Extended Component Patterns

These patterns appear across the app and must be used consistently.

### Avatar Groups

Circular initials avatars with ring separator and -8px overlap. Each user gets a consistent generated colour (green, teal, sky, amber — purple is banned).

```vue
<div class="flex -space-x-2">
  <div class="h-8 w-8 rounded-full bg-green-500 ring-2 ring-elevated flex items-center justify-center text-[13px] font-semibold text-white">SC</div>
  <div class="h-8 w-8 rounded-full bg-sky-500 ring-2 ring-elevated flex items-center justify-center text-[13px] font-semibold text-white">MJ</div>
</div>
```

Use `ring-elevated` (not `ring-white`) so the separator matches the card surface in dark mode.

### Severity Badges (Template Studio)

Dropdown selectors with a coloured dot prefix. Rendered as a button with a dot + label:

| Severity | Dot class |
|----------|----------|
| CRITICAL | `text-error` |
| HIGH | `text-warning` (amber) |
| MEDIUM | `text-warning` muted |
| LOW | `text-dimmed` |

### Question ID Badges

Monospace identifier badges at the left of each question row (`REL-1`, `Q-INF-001`). Sky-tint background, Action text, 13px mono:

```vue
<span class="inline-flex items-center rounded-md bg-[#EAF3FA] px-2 py-0.5 font-mono text-[13px] font-medium text-[#0369A1] dark:bg-primary/10 dark:text-primary">
  REL-1
</span>
```

### Identifier / Tag Chips

Small neutral chips identify team slugs, app IDs, origin labels, and repeated metadata such as templates used by a review. These are informational, not interactive. Render each template as its own quiet chip instead of one comma-separated string. Chip text is 13px, the meta floor; omit borders when several chips share one table cell.

```vue
<span class="inline-flex items-center rounded-md border border-default bg-muted px-2 py-0.5 text-[13px] text-muted font-medium">
  team-customer-portal
</span>
```

### Event Category Chips

Prefix chips in the events feed that categorise each event. Use `UBadge variant="subtle"`:

| Category | Colour |
|----------|--------|
| System | `color="success"` |
| Review | `color="neutral"` |
| Integration | `color="primary"` |

### Sync / Storage Status Chips

Small `variant="subtle"` chips: `synced` → success, `local` → neutral, `pending` → warning. Chip text sits at the 13px floor.

The header connection dot reports verified connectivity, not local database readiness. Green requires a successful API sync and active SSE stream. Amber means API sync works while SSE or pull is degraded. The primary spinner means a sync is running. Gray means no successful sync yet or the server is unreachable. Reject non-2xx and non-`text/event-stream` SSE responses before marking the connection healthy.

### Delta Badges

Percentage-change indicators on stat blocks (`+2%`, `-1%`). Always 13px `font-medium`:

```vue
<span :class="delta > 0 ? 'text-success' : delta < 0 ? 'text-error' : 'text-dimmed'" class="text-[13px] font-medium">
  {{ delta > 0 ? '+' : '' }}{{ delta }}%
</span>
```

### Floating Action Button (FAB)

Round button fixed bottom-right. Used for primary in-context actions (e.g. Preview in template studio). Action colour in light, primary sky in dark. It floats over content, so it takes the overlay shadow — the only shadow outside menus/popovers/modals:

```vue
<button class="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary shadow-[0_8px_24px_rgba(15,23,42,.10)] flex items-center justify-center text-white hover:bg-primary-hover transition-colors">
  <UIcon name="i-lucide-eye" />
</button>
```

### Template Studio Pillar Tabs

Horizontal draggable tabs keep their `⠿` drag handle, visible active rule, 13px tabular question count, horizontal scrolling, and keyboard selection. Editable tabs reserve a fixed delete gutter, so the trash icon fades in without moving neighboring tabs. Pillar deletion always uses a standard modal outside the scrolling tab strip. In read-only mode, Add pillar remains visible but disabled and explains the restriction.

### Template Studio — the Drafting Table

The studio's questions editor sits on the Guided Drafting Room's material one level out: the work area is a cutting mat (same dot-grid recipe), and the active pillar's editor is a sheet lying on it — white paper, 2px ink top rule, corner registration marks, and `Pillar {n} of {m}` on the header's right baseline. Opening a question reads as the sheet taking over the screen.

Width follows the task. Resting lists cap at 60rem, then 72rem at 1600px and 80rem at 1920px. Expanded Compact editors cap at 72rem, then 88rem and 96rem. Above 1600px, keep at least 48px of mat on each side. Compact content stacks below 1280px; above it, Resources takes two-fifths of the band with a 24rem floor. Guided sheets cap at 880px normally and 1200px at 1920px. Resting-to-expanded width and body disclosure use the emphasized 500ms easing curve, with an immediate change under reduced motion.

**The mat has to be visible to be material.** Resting mode keeps the narrower cap because a short list is a reading surface. Expanded mode grows because multi-field authoring benefits from width; explicit caps and side gutters still preserve the sheet-on-table metaphor.

The template's identity — name plus the description shown on the wizard's template cards — is edited in one place: clicking the name in the studio header opens the Template details modal. The name wears a quiet dotted underline at rest — the resting "click to edit" cue, same mark as the PM/EL identity links — strengthening to Action ink on hover alongside the pencil. No resident field, so the studio's top space stays free for authoring tools. Name commits live while trimmed non-empty; description is capped at 160 characters (the wizard card's two-line clamp) with a live counter, amber at the limit, and a helper line saying where it appears. Edits ride the draft autosave; Done is the single action. On non-draft revisions the name is plain text. The header shows one Revision badge only: Draft or Published · vN. Ownership, Template lifecycle, and storage details live in Template details. When editing is unavailable, a persistent lock notice explains why and add actions remain visible but disabled.

While a question is expanded the pillar sheet yields its 2px ink rule to that card and drops to a hairline (see The Active Editor Card).

### Compact Mode — the Active Editor Sheet

Compact Mode (`QuestionCardCompactView.vue`) is the in-place editor for authors who already know the question schema. It never opens a modal and never leaves the list: expanding a row turns that row into the sheet being worked on, in place.

- **The card is the sheet**: white paper, 1px `#CBD5E1` border, the screen's one 2px top rule, and the pillar sheet's hairline registration marks at card scale (10px arms, inset 8px). Collapsed rows stay bare hairline-separated lines, so the collapsed→expanded move reads as one line becoming the active sheet.
- **Severity inks the sheet's one heavy rule**: the question already carries Critical / High / Medium, and its risk is what a template author wants to read across a pillar without opening anything, so severity — not decoration — is what puts colour on this card. Expanded, the 2px top rule takes Error `#B91C1C` for Critical and the Warn mark `#B45309` for High (dark: `red-400` / `amber-400`); **Medium leaves it plain ink**, because "no alarm" is the reading, not a missing style. Collapsed, the same reading is a 3×20px tick flush to the row's leading edge — same two inks, pencil `#94A3B8` (dark `slate-500`) for Medium — so a pillar's risk profile scans down the left margin. The brighter badge hues (`#ef4444` / `#f59e0b`) are not used here: at 2–3px on white paper a candy amber reads as decoration. An unrecognised severity renders **no mark at all** rather than borrowing one.
- **Two bands, two materials**: the **identity band** on top is two columns of one sheet, not two panels — a single vertical hairline divides them and nothing inside is washed, tinted, or boxed. The split is semantic, not an even balance: Type, Question, and Why this matters are the question's own words and sit together on the left; Resources is the one section that points off the sheet, so it sits alone on the right and takes two-fifths of the identity band with a `24rem` floor. The **answer band** below it is Leading practices at the card's full width, and it sits on the **cutting mat**: the well (`#F4F5F7` / `slate-800/40` dark) under the studio's own dot grid — the `.studio-table` recipe verbatim, 1px radial-gradient dots on a 24px grid, `#E4E7EB` light / `rgba(51,65,85,.5)` dark. Every row in that band is a textarea, which is what the well is for, so this is the sanctioned quiet-zone use and not a card wash: the paper above is what the question *says*, the mat below is where it gets *filled in*. **The dots are load-bearing, not texture**: flat well alone reads as a panel switched off, and the leading practices are the opposite of deprioritised — dots read as material under paper, the same sentence the page says one level out. The mat is painted once, on a wrapper around the answer band's own content (Leading practices and, on a yes/no question, the live Follow-up placement block), so its rhythm runs unbroken through the hairline between the two instead of restarting at that seam. The footer rail is not part of this band — see Footer rail below. Each practice sits on an elevated paper row with a hairline, small radius, and quiet shadow. This keeps editable rows distinct from the dotted mat without adding another hue. Flipping the question type moves nothing; only the rows inside the answer band change.
- **Leading practices is one section under one name**: a checklist question has the reviewer tick the practices off one at a time, a yes/no question asks for one call over the whole list — the only difference between them, so the editor names the list once (see Naming — leading practices). Practice lines run to two sentences, so the rows are wrapping textareas at the card's full width in both cases, never single-line inputs that clip what was typed. Enter commits the line and opens the next one.
- **Every content section opens with the index tick**: a sky `h-[3px] w-6` mark above a 14px/600 sentence-case label — the drafting room's sheet-header grammar at field scale, replacing the old run of differently coloured section icons. Sections are separated by spacing alone; the band boundary is the one hairline, because full-width rules otherwise stay inside tables and the answer band's own table-header rule is the line that opens it.
- **Repeated rows need separation**: list headers keep the table voice. Leading-practice rows use elevated paper, 8px vertical gaps, hairlines, and a quiet shadow over the mat. Guided practices and resources use the same spacing. Row controls stay in fixed gutters and appear on hover or focus.
- **Type is a control row, not a section**: its 14px/600 label sits **inline** with its two buttons (`gap-x-3`, center-aligned) and it carries **no index tick** — a tick announces a section of the question's own content, and Type announces a setting. Inline, the identity band starts ~40px tighter and the sections below move up with it; Compact Mode is where vertical space is scarce, so the Guided Drafting Room keeps its stacked type control unchanged. Selection stays the sky recipe: `border-sky-600 bg-[#EAF3FA] text-sky-700` (dark: `border-sky-400 bg-sky-400/10 text-sky-300`) plus a check.
- **Validation states speak in their own ink**: `Required: at least {n} leading practices` is a warn mark — Warn `#B45309` at 13px/500 with the alert glyph — not dimmed prose; the footer's error count and its blocked Done stay Error ink. Amber means "needs attention before this is finished", red means "this is wrong now"; neither is a tinted pill.
- **Footer rail**: hairline top edge, back on the card's own white paper (`bg-default` / dark equivalent) rather than on the answer band's mat — Delete question and Done act on the whole question, not on the leading practices list, so the footer differentiates from the mat instead of sharing it: the card reads paper, then mat, then paper again, never three surfaces pretending to be two. A flat well footer with no dots was tried and rejected — without the dot grid the well's flat tint is indistinguishable from the mat above at a glance, so the footer still read as scoped to the practices list, the exact ambiguity this fix removes. Delete question sits as a quiet ghost aligned to the card's content left edge — the same optical left as Leading practices and the sheet's other section labels, not the button's own hit-box padding — with the error count and Done right-aligned. Count grammar throughout — `{n} practices`, `{n} links`, `{n} errors`.

**Maturity score and Follow-up placement.** The definition stores a stage association. The product calls the calculated result the Score stage and the authored association Follow-up placement. Answers and severity-derived weights set the score. Placement only groups explicit gaps in Follow-ups.

- **The overview is compact and open**: `MaturitySection.vue` renders all five stage names and ranges on one raised spectrum plate with a shared paper surface, hairline dividers, quiet shadow, and a restrained pencil-to-Index-blue top edge. Hovering or focusing a stage opens the shared Cartographer popover with its canonical description, proportional bands, range, and next threshold. Default stage starts are 5, 25, 50, and 75 percent, keeping **Not implemented** below 5 percent. **Test maturity scoring** opens the ordinary Template Preview so authors can answer the draft and watch the score move.
- **The spectrum is the range editor**: **Adjust score ranges** adds one proportional rail and four grippable seam sliders to the same plate. Each shows only its percentage. Focus or selection persists while one inline editor says **Ad-hoc starts at**, **Defined starts at**, **Measured starts at**, or **Optimized starts at**. Drag, Arrow keys, Page keys, Home, End, and numeric entry update the same stage start. The editor lane keeps a fixed height; the equal-width legend drops full bars and dividers while editing. **Use default ranges** restores all four starts atomically.
- **The scoring reference stays static**: **How scoring works** uses bare Formula, Question weights, and Answer rules rows. It never invents answers, totals, coverage, percentage, or a Score stage.
- **Checklist placement is per practice**: each practice row ends with a `Follow-up placement` select in the existing `10.5rem` track. `Set all Follow-up placements` sits beside the count and updates all rows. This is a real control, not a dashed reservation.
- **Yes/No placement is asked once**: one `Follow-up placement` block follows Leading practices. Its rows carry no duplicate control.
- **Guided and Compact match**: Guided adds Follow-up placement as its final route section. It uses the same one-control Yes/No shape and per-practice plus bulk checklist shape.
- **Hidden compatibility data stays visible as a condition, not an editor**: valid legacy custom weighting and guidance round-trip. No custom-share or guidance fields render. The warning offers **Use equal weighting**; invalid hidden guidance offers removal.

### Naming — leading practices

A checklist question and a yes/no question hold the same thing: the leading practices a team is expected to have in place. The checklist question has a reviewer confirm them one at a time; the yes/no question takes one call over the list. That is a difference in how the answer is given, not in what is listed, and two names for one concept ("checklist items" against "leading practices") made authors think they were two features.

**One name, everywhere a person reads it: leading practices.** The section heading, the row placeholder, the add button, the counts, and the validation messages say it in both editor modes and both question types.

Three things deliberately keep the older word, because in each of them "checklist" names the answer mechanic rather than the list:

- **The `Checklist` question type** — it names how the reviewer answers, tick each practice, which is the distinction the rename is not trying to erase.
- **The internal `checklist-gap` ImprovementPlan state** names the answer mechanic. Follow-ups derives it only from a recorded checklist with applicable unchecked practices; it is not the visible product name.
- **The Markdown interchange token** — `**Checklist Items:**` is parsed by exact string match on import (`app/utils/templateMarkdown.ts`), so renaming it would stop every already-exported template from importing. It changes with the template-model migration that gives the two lists one field, not before.

Code identifiers, schema columns, event names, and test fixtures keep `checklistItems` for the same reason: the storage split is real until the model merges the two lists.

### Markdown Transfer

Import and export share a bounded Cartographer dialog: maximum 72rem wide and 52rem tall, with 32px viewport gutters. Header and footer remain visible while the monospace editor scrolls inside a well. Never pair `autoresize` with a clipped modal body. Import is two-step: Review import parses and summarizes current versus incoming pillar and question counts; Replace template is the only destructive commit action. Parsing errors preserve the pasted Markdown.

### Guided Drafting Room

`GuidedDraftingRoom.vue`, the full-screen guided question editor, is staged as a drafting room rather than a generic modal: a rail of route waypoints, a cutting-mat table, and a sheet of paper being filled in. Expanding a question never opens the room automatically; the author must choose Guided or Open drafting room. Escape and Back to template both close it and return focus. Follow-up placement is the final route section.

Preview template opens the full-template test view above the room and restores focus on exit. `MaturityPreview.vue` uses the production calculator. Its resting line shows score, exact Score stage, coverage, and the provisional or no-result qualifier. **How scoring works** keeps a stable label beside coverage and uses a trailing down/up chevron for closed/open state. It opens a **Live calculation** section labelled **Updates with every answer**. One raised plate holds the earned ÷ available = maturity equation. Two compact labelled rows follow the plate. **Current question mix** renders only nonzero severity counts and multipliers. **Scoring rules** keeps checklist, unanswered, and N/A cues on one wrapping icon-led row. Neither adds a panel, border, divider, or shadow. The available operand states how many questions supply the weighted total. Hovering or focusing the live stage shows its canonical meaning, proportional score bands, the current percentage, and the next threshold. The fixed Preview header warns before any answer control: **Answers are not saved. Reloading this page clears them.** Checklist item editors wrap long text, resource titles wrap instead of truncating, and risk-menu options use the standard 15px menu type.

- **Cutting-mat table**: the room's own signature material, the way chart-paper is the Stat Strip plate's. A quiet dot grid under the sheet — `radial-gradient` dots, 1px, 24px grid (`#E4E7EB` light / `rgba(51,65,85,.5)` dark) over the existing table well. Barely-there at arm's length; the sheet paints over it, never the reverse.
- **Action top rule**: the room root carries a 2px Action blue rule. It replaces the obscured question card rule and marks full-screen authoring without adding another heavy line.
- **Functional color carries the route**: the header uses the approved sky wash. The rail stays on the canvas with a neutral dashed connector, matching the product setup rail. The current row uses sky tint with an Action label, and started sections use a quieter blue waypoint. Confirm green appears only after validation passes and includes a check.
- **Sheet header**: a small sky index tick sits above the section title. Required uses blue, Recommended uses Warn, and Optional remains neutral. The right side shows a 32px Index numeral plus the smaller total, with one accessible `Section n of m` label.
- **Registration marks**: hairline L-marks in the sheet's four corners — 12px arms, 1px, `--ui-border` light / slate-700 dark, inset 10px. Decorative, `aria-hidden`, pointer-events-none.

**The Drafting Room Ceremony** plays once when the room opens and never blocks — the first field is focused and typeable from the first frame:

| Act | What happens | Starts | Duration |
|-----|---------------|--------|----------|
| Room enters | Existing fade + scale from 98.5% (unchanged) | 0ms | 250ms |
| Paper laid down | Sheet rises 12px into place | 80ms | 420ms |
| Route draws | Rail's dotted connector wipes top→bottom; waypoints step in behind it | 120ms | 500ms (+70ms/row) |
| You are here | Current waypoint pulses once, sky ink | 640ms | 600ms |
| Section inks in | Title, description, editor rise with the entrance-reveal recipe (see Motion) | 200ms | 700ms, 70ms stagger |
| Chevron hand-off | Abbreviated: rail and sheet hold still, only the section's own content inks in, faster | on ‹ › | 450ms, 60ms stagger |
| Section earns green | A completed waypoint gains a confirm-green check and one soft pulse | when section validation first passes | 450ms |
| Paper filed | Back to template: quick settle down + fade | on exit | 200ms |

The full entrance plays on a fresh open; the abbreviated hand-off plays when the header's ‹ › chevrons move to a neighbouring question. Each question owns its own room instance, so a hand-off actually closes one room and opens a sibling a beat later — `useDraftingRoomHandoff()` bridges the two with a module-level timestamp: the closing room marks the moment, the opening room checks whether that was under 600ms ago. The section-earns-green reward fires at most once per section per room-open, when that section first satisfies its content and length requirements. `prefers-reduced-motion` snaps every act above straight to its settled state.

### Review Wizard — Template Selection

The New Review wizard's first step (`ReviewWizardTemplateStep.vue`, one component shared by the team and product wizards) presents templates as ranked groups instead of a flat paginated list. Group order is an editorial ranking — what the organisation wants chosen sits closest to the hand:

1. **Featured** — campaign templates declared in `app/constants/featuredTemplates.ts` (`FEATURED_TEMPLATES: { templateId, note }[]`). Rendered as a hero, not a grid card: a full-width real `<button>` carrying the editor card's 2px ink top rule (`border-t-2 border-t-inverted`), a 17px/700 title, the mono `v{n}` chip, an amber campaign chip carrying the note ("Peak season · required"), the full metadata line, and a solid Select affordance — a non-interactive `<span>` (`pointer-events-none`) styled as the Action button, so the hero stays one focusable control with no nested-interactive trap. Selected swaps the span to sky tint plus a check. Featured entries that don't resolve in the catalog are silently skipped — never a broken hero.
2. **{Team} templates** — templates whose `ownerTeamId` matches the wizard's team context. Team wizard only.
3. **All templates** — every remaining published template, sorted by `reviewsCount` desc then `publishedAt` desc. Popularity is real usage, never a fabricated signal.
4. **Drafts** — always last, dashed borders (dashed = provisional). The group explains itself: drafts exist to try a template in a real review *before* publishing, because a published Revision is immutable. A draft lives only in its author's local database until draft sync ships, so a draft-backed review is a this-device trial.

**Groups are cutting mats.** Each group's cards (the hero included, under its own "Featured" header — it stacks when multiple campaigns run) sit on a `.shelf-mat`: the Guided Drafting Room's material at catalog scale — the well under 1px radial-gradient dots on a 24px grid, `p-3`, `rounded-lg`, no border, no shadow. Cards read as sheets on the table, and each opens with the sheet-header index tick (`h-[3px] w-6`) — Index sky for published, pencil-gray for drafts.

Cards (`ReviewWizardTemplateCard.vue`) sit in a two-column grid (`grid gap-3 sm:grid-cols-2`; single column on mobile) — only the featured hero spans the full width. Each card is metadata-rich so same-name templates disambiguate at a glance — name + mono `v{n}` chip (drafts: neutral "Draft" chip), "by {owner} · updated {relative}" (owner segment omitted when unresolvable, never a raw id), a two-line `line-clamp-2` description, and a "{n} pillars · {n} questions · {n} reviews" line pinned to the card's bottom edge so the stats align across every card in a grid row. A draft card never borrows its template's review count — those reviews belong to the published revisions. Selection is the sky-tint recipe (a selected draft trades its dashed border for the solid sky one):

```vue
<button
  :aria-pressed="selected"
  :class="selected
    ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
    : ['border-default bg-default hover:border-accented', isDraft ? 'border-dashed' : '']"
  class="flex h-full flex-col rounded-lg border p-4 text-left"
>
  <!-- title row · owner line · description · stats pinned with mt-auto -->
```

**Long groups preview, then reveal.** "All templates" previews its 6 most-used cards, Drafts previews 4; anything longer adds a quiet centered toggle below the grid — 13px medium, chevron, no border. A group hiding only a handful (≤12) opens in one click ("Show all {N} templates"); past that it reveals a page of the grid at a time ("Show 24 more"), so a hundred-template catalog never lands as one dump. Fully revealed, the toggle becomes "Show fewer". Both capped groups keep a K-of-N header count ("6 of 24 templates", "4 of 31 drafts") while truncated. The team-templates group and search results are never capped. Question counts fetch only for rendered cards — a large catalog must not open with a hundred detail requests.

**The toolbar stays within reach.** Search, filter chips, and the Selected Revisions tray are pinned below the app header (`sticky`, solid `bg-default`, bottom hairline as the block's own edge) so the way back out and the 3-slot selection state never scroll away. Opaque on purpose — translucency smears passing cards into ghost text. This relies on the layout's `<main>` staying `overflow: visible`: the window is the app's one scroller, and any overflow value on `main` silently kills `position: sticky` for every descendant.

**Entrance.** One quiet settle on first paint — toolbar and group blocks rise 6px over 240ms, 40ms stagger, armed after hydration, snapped to the finished state under `prefers-reduced-motion`. Then stillness, plus the 150ms press acknowledgment on cards (`active:scale-[0.99]`).

Above the groups: **All · Published · Drafts** filter chips plus search. A search query flattens the groups into one grid headed by the count grammar — "{K} of {N} templates" — because a ranked list answers "what should I pick?" and search answers "where is the one I named?".

**Scope steps speak plainly.** The team wizard's scope step leads with "Most team reviews cover the team as a whole." and offers applications as the exception; a team with no owned applications is told so plainly ("This team doesn't own any applications yet — showing the full catalog"). The confirm step describes a team scope as "Team-scoped — covers the team as a whole." — never "No applications linked.", which reads as an error to fix.

### New Product Wizard — the Route Rail and the Sheet

`/products/new` is staged like the Guided Drafting Room one level out: a rail of route waypoints on the left, a cutting mat on the right, and one sheet of paper on the mat carrying the step being filled in. The stock stepper bar is retired — the rail says both where you are and what you have entered so far.

- **The rail** (`product-wizard/StepRail.vue`) reuses the assessment sidebar's waypoints at wizard scale: a dashed vertical connector threads one `h-2.5 w-2.5 rounded-full border-2` waypoint per step — confirm green once the step has the input it needs, Index sky filled on the current step (its row takes the sky-tint selected background `#EAF3FA` / dark `sky-400/10`), a hollow sky ring for a step already reached, hollow gray for a step still ahead. Rows carry a 14px/600 title and a 13px sub-line that starts as the step's ask ("Name, origin, and contacts") and becomes what was actually entered ("Checkout · Bespoke", "2 teams", "3 applications") in the "{N} {noun}" count grammar. Steps past the furthest one reached are `disabled` — the rail walks back, never skips ahead.
- **The mat and the sheet.** The work column is a cutting mat, the drafting room's dot-grid recipe (`#F4F5F7` under 1px `#E4E7EB` radial-gradient dots on a 24px grid; `#020617` under `rgba(51,65,85,.5)` dots in dark), `p-4`, `rounded-lg`, no border, no shadow. One sheet lies on it: white paper, 1px `#CBD5E1` border, the 2px ink top rule, and hairline registration marks in all four corners. That rule is the page's one heavy line.
- **Sheet header.** Sky index tick (`h-[3px] w-6`), then a baseline row — step title at 20px/700 left, `Step {n} of 4` (13px, dimmed, tabular) right — then the step's one-sentence ask. Same grammar as the room's `Section {n} of {m}`.
- **Identity has room to work.** The page caps at 1440px without extra desktop side margins. Decision contacts and Working links become two balanced sections only at `xl`; below that they stack. Their fields remain vertical, so person search and URLs do not collapse into narrow three-column inputs.
- **Actions sit on the sheet**, separated by whitespace only: Cancel (ghost) far left, Back / Skip / Continue or Create product on the right. No rule above them — full-width lines stay inside tables.
- **Motion.** Moving between steps holds rail and sheet still and inks only the step's content in (6px rise, 260ms). On first paint the legend, rail, and mat rise 6px with a 40ms stagger, armed after hydration; `prefers-reduced-motion` renders the settled page.
- **The legend** (`ProductMentalModel.vue`) sits above the wizard on plain canvas — no card, no wash — and is built as a keyed map legend, not four mini-articles. One intro line, then four parts named after the wizard's own steps (Identity, Teams, Applications, Links). Each is keyed by a small icon chip — `h-7 w-7 rounded-md bg-primary/10` with a 16px glyph in Action ink, **one tint across all four** so the glyphs do the telling and the row never turns into colour-coded badges (the one place the laws allow a tint fill is exactly this: a small icon chip, never a card). Beside the key: a 14px/600 name, a meaning of a few words — worded to match the rail's own step lines below, so the legend keys the route — and the worked Checkout example as identifier chips. All four parts carry chips, so the block reads as one rhythm instead of mixed prose and pills. Each part is its own `content-start` grid, which keeps the name, meaning, and chip rows aligned across the four even when one part's chips wrap. A quiet Show/Hide toggle stores the reader's choice in `localStorage` (`peaky:product-legend-open`); the section renders open on the server and pre-hydration.
- **Pickers preview, then reveal.** Teams and Applications (`product-wizard/StepEntityPicker.vue`) drop the 4-per-page pager for the review wizard's shelf recipe: a two-column card grid previews 6 and reveals 12 at a time ("Show all {N} teams" while 12 or fewer are hidden, "Show {n} more" past that, "Show fewer" once open), with a K-of-N header count so truncation is never silent. Cards use the sky selection recipe over a `rounded-lg` hairline and pin the directory id to the bottom edge as a mono identifier chip, so ids line up across a grid row. The selection tray above the grid lists picks as removable pills. When teams are chosen, the applications list is scoped to them and says so: "Showing applications owned by the selected teams. Search to reach the full catalog."
- **The review step is a manifest, not nested cards.** `StepReview.vue` lays Identity out as a `dt`/`dd` grid, then Teams and Applications as chip groups (`SummaryList.vue`), then Links. Each group header carries an Edit link that sends the rail back to that step. People, teams, and applications render by display name, never a raw directory id; an empty field reads "Not set" in dimmed text. An empty Applications group is a dashed box — dashed is still-to-decide, and applications are optional.
- **No visibility control.** Products are internal-only today, so the wizard offers no internal/external choice and the review step states none.

### Product Overview

`/products/{id}` is the product's record: identity chips, the survey plate, the title block, and the reviews sheet — three drawn objects stacked down the page. The bordered "Architecture" and "Resources" panels are retired, and so is the bare four-column band that briefly replaced them: labelled columns floating on canvas read as unstyled text, not a designed object.

- **Header.** Section-header tick plus product name; Edit and Follow-ups as ghost keys, Start new review as the page's one solid action. Under it a chip row: origin as an identifier chip, an "External" chip only when the product actually is external, and "Created {relative}" at 14px dimmed. No "Internal" chip — every product is internal today, and a chip there would imply a choice that does not exist.
- **Stat strip.** Active reviews ("draft or in progress"), Total reviews ("{N} reviews archived", only when something is archived), Last activity. Nothing is stated that the local data cannot back.
- **The title block** (`ProductTitleBlock.vue`) carries ownership and resources. A drafted map or engineering drawing puts exactly this content — who drew the sheet, who approved it, which documents it references — in a ruled title block, so this one is drawn rather than styled as a card:
  - **Frame and neatline**: outer 1px `#CBD5E1` frame at `rounded-lg`, plus a second hairline frame inset 5px (`rounded-[4px]`, `#DDE6EE` / slate-700) — the stat plate's neatline device, in the standard hairline because this panel sits on white, not chart paper. The neatline clips the contents, so internal rules stop at it and the edge reads double-ruled, not crossed.
  - **No fill, no ink top rule, no shadow.** The lines carry it. The page's one ink top rule already belongs to the plate above.
  - **Caption row**: `px-6 py-4`, "Ownership and resources" at 16px/600 with no survey tick (a bounded object carries its own caption, the same allowance table sheets have), and the drawn-by field on the right — "Added by {name}", 13px dimmed, from `createdBy`, falling back to the stored id rather than a blank. A `border-b` hairline separates it from the cells.
  - **Ruled cells**: Contacts, Teams, Applications, References. One column stacks with horizontal rules; two and four columns rule vertically, only where cells actually sit side by side. At `xl` the tracks are uneven on purpose — `1.15fr 1fr 1fr 1.15fr` — the way a drawn title block rules unequal fields. The divisions are internal to a bounded object, never page-level section rules.
  - **Contacts is the human-first cell** and comes first — the drawn-by / checked-by stack. Product manager and Engineering lead each get a 13px dimmed sub-label above a 15px/600 Action link into the directory.
  - **Field names** are 14px/600 `text-muted`, the table-header voice, because this is a ruled object. Teams and Applications right-align a "{N} {noun}" count. Values are identifier chips linking into the directory; references are `dt`/`dd` lines pairing field name and link.
  - **Empty fields are dashed**: a 13px dashed pill — "Not set", "None linked", "No links added" — an unfilled field on a drawing.
- **Loading is a skeleton of the real page** — tick, title, chip row, plate, ruled panel, sheet — not a centered "Loading product..." line.
- The reviews list is the shared `SubjectReviewsSection` sheet, unchanged; the title block sits 64px below the plate and 48px above it.

### Assessment UI

Assessment is the multi-question scan and edit mode. It uses one grid below the app navigation: a template and pillar route rail beside a bounded workspace. The expanded rail owns template identity and pillar navigation. Template name, version, and status remain separate; inactive templates are real switches. Pillar names wrap, percentages use tabular numerals, and active state combines text, tint, and a waypoint. When the rail is compact, pillar tabs replace the hidden navigation.

Each question row has a stable 56px reference column and one flexible reading column. Question text is 17px regular, increasing to 18px at 1920px, and the row caps at 960px. Keep the information action beside the question and put answer controls directly below it on the same reading axis. Do not pin controls to the far edge of a wide row. A pillar header shows one answered/total summary, not a duplicate percentage.

Yes, No, and N/A use one neutral selection recipe: solid when selected, outlined when unselected, and `aria-pressed` for state. No and N/A are not error states. An N/A row may use a quiet neutral background, but never fade or grayscale its text.

Checklist groups use a `fieldset` and screen-reader legend. Each item uses a native checkbox with an explicit label and a separate N/A button named with the item text. The item container is not interactive. A collapsed checklist row prioritises its progress and Expand action; whole-checklist N/A appears only after expansion, inside the checklist header. Disclosures expose `aria-expanded` and `aria-controls`; controls are siblings, never nested.

Survey is the one-question focus mode. Its question type scales from 34px to 44px at 1280px and 48px at 1536px. Do not reuse survey display type in assessment mode. Whole-question N/A stays inside the answer area: it is the third option beside Yes and No, or sits with the checklist instructions before the item list. Below `xl`, Question information uses a bounded slideover with the question as context, 16px body copy, numbered practices, and three-item disclosure. Wider survey views keep the teaching rail beside the question.

### Progress History Chart

Line chart on Review Details below the pillar breakdown table, drawn in Index sky (`#0284C7` light; sky-400/500 dark — violet is retired). Data-point markers are small filled circles. The chart sits directly on the canvas. Axes: date (x), completion % (y, 0–100%).

### System Status Tiles

Four-up grid on the System page: Database, Sync, Storage, Schema. Each tile: icon + 14px/600 sentence-case label (no uppercase micro-caps) + headline status + sub-detail + "What is this?" disclosure link. Healthy = `text-success`, problem = `text-error`.

### Rich Info Popovers

Mini-modal popovers for displaying structured detail on hover/click (e.g. checklist diffs, field history). The pattern solves a common corner-bleed issue where NuxtUI's default popover wrapper (`bg-default rounded-md ring ring-default`) fights with a custom inner card.

**The rule:** strip the popover wrapper's visuals and let one inner div own all styling.

```vue
<UPopover
  :content="{ side: 'left', align: 'start', sideOffset: 12 }"
  :ui="{ content: 'bg-transparent shadow-none ring-0 rounded-none p-0' }"
>
  <!-- Trigger button -->
  <button type="button" class="group hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ...">
    <!-- compact summary -->
  </button>

  <!-- Popover body — single source of background, border, rounding -->
  <template #content>
    <div class="bg-elevated border-default w-[30rem] overflow-hidden rounded-lg border shadow-[0_8px_24px_rgba(15,23,42,.10)]">
      <!-- Header -->
      <div class="bg-muted/40 border-default flex items-center justify-between border-b px-4 py-3">
        <span class="text-highlighted text-sm font-semibold">Title</span>
      </div>
      <!-- Scrollable body -->
      <div class="max-h-80 overflow-y-auto px-3 py-3">
        <!-- Items -->
      </div>
    </div>
  </template>
</UPopover>
```

**Why this matters:**

- NuxtUI v4's `UPopover` content wrapper applies `bg-default rounded-md ring ring-default` by default.
- If the inner div also applies `bg-elevated rounded-lg`, the two backgrounds and two border-radii create visible corner bleed in dark mode.
- Setting the wrapper to `bg-transparent shadow-none ring-0 rounded-none p-0` makes it invisible, so the inner div is the only painted surface.
- Use `overflow-hidden` on the inner div (not `clip-path`) to contain child backgrounds within the rounded corners.

## Motifs

The illustration language is cartography — journeys across terrain, not climbs up a mountain.

- **Journey line**: the logo's sky→green gradient line.
- **Compass rose**: the shell hero.
- **Route map**: a top-down dotted route through contour fields with waypoints and a green destination ring (shell "how it connects").
- **Progress track**: a flat track with a waypoint circle (survey mode — see Survey Progress Track above).
- **Survey plate**: the StatStrip's chart-paper ground — a graticule, an edge-cropped compass rose, and a dotted route made literal as a drafted instrument backdrop (see Stat Strip — the Surveyor's Plate above).

**Never ascending elevation profiles or mountain-climb charts.** An ascent chart reads as a performance grade and evokes being judged. Contours and routes are the only texture, at most ~4% ink.

## Language & Copy

- **"Follow-ups" replaces "Improvement Plan"** as the UI label. The deeper rename (routes, code, domain model) is a separate future change.
- Sentence case throughout — labels, buttons, menu options, table headers.
- The non-judgment stance is structural: **"A 'No' isn't a failure — it's a signal."** Copy and styling must never make an answer feel like a grade.
- Copy style: simplified technical language. Short sentences. No walls of text.
- Avoid launch-only framing — templates set the bar for anything: a launch, a process, an engineering baseline.

## The Shell Page

The shell is the front door — unauthenticated visitors land here, and signed-in teammates can revisit it via the sidebar logo. Light theme, white canvas, no product chrome:

1. **Nav**: logo + Docs + auth-aware CTA ("Continue with Okta" signed out, "Go to Teams" signed in — the landing stays reachable as the concept page), drafted-outline construction (see Buttons above)
2. **Hero**: compass rose motif — visible from `lg` up (scaled down ~0.8 and pulled toward the corner below `xl` so it clears the `max-w-[660px]` headline at 1024–1279), plus a few aria-hidden graticule crosses scattered in the upper-right air, same vocabulary as the route map's; headline "Every "ready" has blind spots.", a one-sentence breadth sub-line, the page's one solid CTA + "How it connects" anchor, one meta line — signed out, its three phrases are separated by drafted 1px tick marks instead of middots
3. **"How the pieces connect"**: route map + 01–04 Define / Review / Learn / Act columns — each carries its persona's substance (author / run / advise) in one or two sentences plus one signal line ("Start with one pillar." / "A "No" isn't a failure — it's a signal." / "Teaching, not grading." / "Follow-ups, not blame."). The flowline's `→` glyphs carry the index ink, the words stay muted. One story, told once — no separate personas section.
4. **Footer**: dark ink, with exactly one local-first sentence: "Work saves to this device first and syncs in the background. Offline is fine — nothing is lost."

Shell body copy runs 18–20px. No sync jargon, no SQLite/WASM talk on the front door.

## Anti-Patterns to Avoid

### Visual Chaos

❌ **Don't**: Mix border radius styles (some `rounded`, some `rounded-lg`, some `rounded-xl` on same page)
✅ **Do**: Radius is 6–8px everywhere — `rounded-md` for chips and badges, `rounded-[7px]` for buttons, `rounded-lg` for inputs, menus, editor cards. `rounded-xl` is retired.

❌ **Don't**: Resting shadows anywhere (`shadow-sm`, `shadow-md`, `shadow-lg` on cards or sections)
✅ **Do**: No resting shadows. Elevation exists only on overlays (menus, popovers, modals, FAB): `0 8px 24px rgba(15,23,42,.10)`

❌ **Don't**: Wrap page content in bordered cards to group it
✅ **Do**: A section is a survey tick + section title + whitespace on the canvas; the one heavy line per screen is the active editor card

❌ **Don't**: Uppercase micro-caps labels (`text-xs uppercase tracking-wider`)
✅ **Do**: 14px/600 sentence-case labels — the eyebrow pattern is banned

❌ **Don't**: Raw color classes like `text-slate-600`, `bg-gray-100`
✅ **Do**: Semantic colors: `text-muted`, `bg-muted` (documented Cartographer hexes are allowed until their tokens land in `app.config`)

❌ **Don't**: `hover:bg-muted` on table rows inside a `bg-default` container (matches page canvas in dark mode)
✅ **Do**: `hover:bg-black/[0.03] dark:hover:bg-white/[0.04]` — alpha tints always produce visible contrast

### Component Bareness

❌ **Don't**: Bare NuxtUI components

```vue
<UInput v-model="x" />  <!-- WRONG -->
<UButton>Save</UButton>  <!-- WRONG -->
```

✅ **Do**: Styled with intent

```vue
<UInput v-model="x" size="md" placeholder="..." class="w-full" />
<UButton color="primary" size="md">Save changes</UButton>
```

### Layout Inconsistency

❌ **Don't**: Arbitrary spacing (`p-3`, `p-5` mixed)
✅ **Do**: Scale-consistent spacing (`p-4`, `p-6`, `p-8`)

❌ **Don't**: Missing empty states
✅ **Do**: Every table/list has designed empty state

❌ **Don't**: Static progress bars
✅ **Do**: Animated progress transitions

## Accessibility Notes

- Focus rings: 2px in the Action colour (`#0369A1` in light) — NuxtUI provides these via `focus:ring-2 focus:ring-primary`
- Color alone never indicates state: combine with text/icon
- Minimum contrast: semantic colors maintain WCAG 2.1 AA
- Interactive targets: minimum 44x44px for touch
- Checklist groups use `fieldset` with a screen-reader legend. Native checkboxes have explicit labels
- Toggle state uses `aria-pressed`; disclosure state uses `aria-expanded` and `aria-controls`
- Rows with multiple controls are non-interactive containers. Never nest one button or link inside another

## Checklist for New UI

Before marking complete:

- [ ] Verified in **both light and dark mode** (light is the default)
- [ ] Uses semantic color classes (no raw Tailwind colors, no `bg-white` hardcoded; documented Cartographer hexes allowed until tokens land)
- [ ] Light mode sits on the white canvas — no card wrappers or tone shifts; wells (`bg-muted`) for inputs and quiet zones only
- [ ] Sections separate via survey tick + title + whitespace — no full-width rules outside tables
- [ ] Consistent border radius 6–8px (`rounded-md` / `rounded-lg`) — no `rounded-xl`
- [ ] No resting shadows — overlay shadow only on menus, popovers, modals, FAB
- [ ] Labels are 14px/600 sentence case — no uppercase micro-caps; no text below the 13px floor
- [ ] Hover states defined for all interactive elements (alpha tints, never a shadow)
- [ ] Loading state designed
- [ ] Empty state designed
- [ ] Error state uses `color="error"`
- [ ] Spacing follows 4px scale (`p-4`, `gap-4`, `space-y-6`)
- [ ] Transitions for state changes (150–300ms)
- [ ] Status badges use correct color mapping (see Status Colors table)
- [ ] Avatar `ring-*` uses `ring-elevated` not `ring-white`
- [ ] Static metadata (slugs, IDs) uses identifier chips, not `UBadge`
- [ ] Scoped CSS `<style>` section checked for raw hex/rgba colors
