---
name: Peaky
description: >
  Operational Readiness Review platform — an enterprise workflow tool for
  teams managing structured review cycles across applications and products.
  Light-first, clean, professional. Built on NuxtUI v4 + Tailwind CSS with
  the "Cartographer" design system: a pure-white light canvas, structural
  separation instead of tone shifts, a slate/sky/green palette and the
  Public Sans typeface.

colors:
  # ── Light theme — "Cartographer" ─────────────────────────────────────
  # The canvas IS the surface. Separation comes from structure, not tone.
  canvas: "#FFFFFF"          # page background AND component surface
  well: "#F4F5F7"            # inputs, textareas, search, quiet zones ONLY — never a card background
  hairline: "#DDE6EE"        # default 1px border
  border-strong: "#CBD5E1"   # emphasised borders, table header rule
  row-line: "#EEF3F8"        # table row separators
  ink: "#0F172A"             # headings and body (~17:1)
  text-2: "#475569"          # secondary copy (7.5:1) — darkest grey allowed for copy
  faint: "#64748B"           # only at 14px and above
  action: "#0369A1"          # buttons, links; focus ring
  action-hover: "#075985"
  index: "#0284C7"           # large numerals, route/progress lines, survey ticks — never body text
  confirm: "#15803D"         # done/saved only
  warn-text: "#92400E"       # on warn-tint
  warn-tint: "#FDF3E3"
  warn-border: "#EDDCC0"
  warn-mark: "#B45309"       # warning icons/marks, attention counts
  error: "#B91C1C"
  sky-tint: "#EAF3FA"        # selected states, zoning
  # Purple and pastel washes are banned outright.

  # ── Dark mode — first-class alternative (palette hues unchanged)
  primary-dark: "#0ea5e9"
  primary-hover-dark: "#0284c7"
  success-dark: "#22c55e"
  error-dark: "#ef4444"
  warning-dark: "#f59e0b"
  bg-dark: "#020617"
  bg-muted-dark: "#0f172a"
  bg-elevated-dark: "#1e293b"
  border-dark: "#334155"

typography:
  # Theme-agnostic — the same scale applies in light and dark mode.
  page-title:
    fontFamily: Public Sans
    fontSize: 30px
    fontWeight: 800
    letterSpacing: -0.015em
  section-title:
    fontFamily: Public Sans
    fontSize: 26px
    fontWeight: 800
  body:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-shell:
    fontFamily: Public Sans
    fontSize: 18-20px        # shell/marketing surfaces only
  label:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: 600
    textTransform: none      # sentence case — uppercase micro-caps are banned
  meta:
    fontFamily: Public Sans
    fontSize: 13px           # the floor — 10–12px is retired everywhere
  assessment-question:
    fontFamily: Public Sans
    fontSize: "17px; 18px at >=1920px"
    fontWeight: 400
    lineHeight: 1.625
  survey-question:
    fontFamily: Public Sans
    fontSize: "34px; 44px at >=1280px; 48px at >=1536px"
    fontWeight: 700
  metric:
    fontFamily: Public Sans
    fontSize: "32px; 40px at >=1920px"
    fontWeight: 800
    lineHeight: 1
    fontVariantNumeric: tabular-nums
  code-badge:
    fontFamily: ui-monospace
    fontSize: 13px
    fontWeight: 500

rounded:
  md: 6px                    # chips, badges, small controls
  lg: 8px                    # buttons, inputs, menus, editor cards
  full: 9999px               # pills and avatars only — 12–16px card radii are retired

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section-gap: 48-56px
  section-gap-after-numerals: 80px

layout:
  wide-breakpoint: 1920px
  standard-data-cap: 1440px
  wide-data-cap: 1920px
  assessment-default: "232px rail + workspace capped at 1152px"
  assessment-collapsed: "96px rail; pillar tabs replace hidden pillar navigation"
  assessment-wide: "264px rail + 1600px content: 1248px workspace, 320px progress rail, 32px gap"

shadows:
  resting: none              # no resting shadows anywhere
  overlay: "0 8px 24px rgba(15,23,42,.10)"   # floating overlays only — menus, popovers, modals, FAB

focus:
  ring: 2px solid #0369A1

components:
  button:
    radius: 7px
    heights: "sm 36px · md 44px · lg 48px, padding to match"
    label: 15px (md) / 16px (lg), sentence case
    icon: 16-18px, gap-2
    focus: 2px solid action, offset 2 — every variant
    transition: 150ms, colors and transform only
    primary: "solid; bg action; hover darkens to action-hover (never an opacity fade); active darker still + translate-y-[0.5px]; disabled 45% opacity"
    secondary: "outline; border-strong ring 1.5px; hover well bg + border darkens one step; no color tints"
    ghost-text: "variant=ghost/link; text-2 → ink + well bg on hover (ghost) or text darkens (link); no border"
    exception: "the primary fill's machined bottom edge (inset shadow) is the one sanctioned resting shadow on a button"
  survey-tick:
    size: 40x3px
    color: index
    radius: 2px
    placement: above section titles — replaces ALL full-width section rules
  stat-block:
    background: none         # no border, no card
    label: 15px/500 text-2
    value: 32px/800 tabular ink; 40px at >=1920px (warn-mark amber for attention counts)
    sub-label: 14px
    progress-line: 4px — track #DDE6EE, fill #0284C7, #15803D at 100%
  stat-strip:                # the "surveyor's plate" — the ONLY StatStrip look, not a variant
    background: chart-paper #F9F7F2, border #E8E3D9, bottom edge #DBD4C4 (deeper warm = plate thickness), ink top-rule 2px, inner neatline #E3DDD0 inset 6px — STAT-STRIP-ONLY, never a general surface, never the warn-tint family
    engraving: drafted chart geometry only, never generated organic curves — graticule grid 0.12 light/0.09 dark; edge-cropped compass rose (inner circles/ticks 0.12/0.09, spokes 0.18/0.14, outer ring 0.26/0.20) at the top-right corner; one dotted route + waypoints, lower-right quadrant only, 0.22 light/0.16 dark; horizontal fade ~35%→100% by 55% width; two-ink accents — needle jewel warm amber (warn-mark territory) 0.38/0.30, destination ring confirm green (success-mark territory) 0.38/0.30, everything else stays index blue
    motion: on first scroll-reveal only — route mask-wipes in (~900ms), needle fades + scales into place (~400ms), destination ring pops in after the draw; reduced-motion snaps straight to the settled plate
    dividers: 1x10px scale ticks hanging from the top rule (ink/30, white/35) — never full-height borders
  editor-card:
    background: canvas
    border: 1px solid #CBD5E1
    top-rule: 2px solid ink — inked by severity where the editor's subject carries one (Template Studio's question card: error #B91C1C critical, warn-mark #B45309 high, plain ink medium/unset)
    limit: one per screen — the active editor (e.g. expanded question card in Template Studio); a surface behind an active editor hands its rule over and drops to a hairline
  table-header:
    text: 14px/600 text-2, sentence case
    rule: 1px solid #CBD5E1
  table-row:
    line: 1px solid #EEF3F8
    text: "16px; 17px at >=1920px"
    padding-y: "18px; 20px at >=1920px"
    hover: alpha tint, transition colors 150ms
    activation: "one view path only; whole-row activation ignores interactive descendants"
    actions: "always reachable, never hover-only"
  table-sheet:
    surface: .data-table-surface — canvas, 1px hairline border, rounded-lg, overlow-hidden
    title-block: "px-6 pt-5 pb-4; title 16px/600 text-highlighted, no survey tick; console (search+filters) right, gap-3; border-b row-line under"
    footer-rail: "border-t row-line, px-6 py-3, min-h-14 (sized to a 32px control row so pagination adds zero shift); count left, #footer-trailing slot right"
    filter-chip: "selected bg-primary/10 text-primary font-medium; unselected text-muted hover:text-default, transparent, no border; text-sm px-3 py-1.5 rounded-[7px]; focus-visible ring"
    action-compression: "row's own link is the view action; at most one quiet visible action (ghost primary); everything else in one ⋯ overflow (ghost neutral, aria-label More actions); destructive only inside the menu, color=error, still confirms"
    count-grammar: "\"{N} {noun}\" normally; \"{K} of {N} {noun}\" once search/filter narrows the set"
    pagination-reserved: "footer rail right side — range (\"1–25 of 118\", 14px tabular), ghost prev/next, optional page-size select; designed now, wired later; export shares #footer-trailing"
  dropdown-menu:
    background: canvas
    border: 1px solid #DDE6EE
    radius: 8px
    shadow: overlay
    option: 15px, sentence case
    selected: sky-tint background + check mark
    dots: leading colored dots only when semantic (risk levels)
  status-badge:
    radius: rounded-full
    variant: subtle
    ready-completed: success
    active-operational: success
    in-progress: primary
    draft-inactive-archived: neutral
    action-needed-blocked-failed: error
    pending-waiting: warning
  severity-badge:
    critical: "color=error with dot indicator"
    high: "color=warning with dot indicator"
    medium: "color=warning variant=soft"
    low: "color=neutral"
  avatar:
    radius: rounded-full
    size: 32px
    group-overlap: -8px
  question-id-badge:
    background: sky-tint
    text: action
    fontFamily: ui-monospace
    fontSize: 13px
    radius: rounded-md
  event-category-chip:
    system: "color=success variant=subtle"
    review: "color=neutral variant=subtle"
    integration: "color=primary variant=subtle"
---

## Overview

**Human-centred first.** Make things obvious, then make them feel cared for — the smallest detail is part of the product. Nothing ships looking "stock": if a component renders with framework defaults, it isn't finished.

Peaky is a structured, decision-oriented tool — every screen exists to move a review forward or surface a risk. The UI prioritises density with clarity: no decorative chrome, every element earns its place. The palette is cool and neutral with one action colour so primary actions are instantly identifiable.

**The light theme is "Cartographer".** One white canvas (`#FFFFFF`) is both the page background and the surface — there is no separate "card" tone, and the app shell ground itself is white (the well is never a page ground). Hierarchy comes from structure: the survey tick above section titles, type scale, whitespace, and hairlines. The only tinted surface is the well (`#F4F5F7`), used for inputs, textareas, search, and quiet zones — never as a card background. Wells and hover washes are neutral, not blue-tinted: sky belongs only to elements that mean something — actions, selection, index numerals, route lines. (The stat strip's chart paper is the one other tinted surface, and it is StatStrip-only.)

**Light-first.** The app defaults to light mode (`colorMode.preference: "light"`); existing users keep their stored choice. Every component must work in both modes — dark is not an afterthought. All Cartographer type, spacing, weight, and structure rules apply to dark mode unchanged; only colors remap (see Dark Mode).

**Rollout.** Cartographer applies app-wide. One exception: the Applications subject pages inherit shared-component updates only and have not themselves been visually redesigned. (Template Studio's rules editor, once the other exception, is fully removed — canvas, route, tab, and command palette entry.)

**Structure, not tone** — how a light-mode screen holds together:

```text
Canvas #FFFFFF (page AND surface)
  ├── Wells #F4F5F7 — inputs, textareas, search, quiet zones only
  ├── Survey tick + title scale + whitespace — section separation
  ├── Tables — the only full-width horizontal lines
  └── Overlays (menus, popovers, modals) — the only shadows
```

## Dark Mode

Light is the default; dark mode is a first-class choice via the moon/sun toggle in the top-right header.

- Dark page canvas: `#020617` (slate-950) — very deep navy, almost black
- Dark card surface: `#1e293b` (slate-800) — clearly distinct from canvas
- Dark borders: `#334155` (slate-700)
- Dark text default: slate-200 / slate-300 range
- Light page canvas: `#FFFFFF` — pure white; the canvas is the surface. There is no light "card" tone — separation comes from structure, not tone shifts.
- Light well: `#F4F5F7` — inputs, textareas, search, and quiet zones only

Dark mode is **not redesigned**. All type, spacing, weight, and structure rules above and below apply to it unchanged. Only colors remap:

- Keep the existing dark palette hues.
- Survey ticks and Index accents may need sky-400/500 for contrast.
- Wells become slightly-elevated dark surfaces.
- Table lines become low-alpha white.

When writing new UI, always verify both modes.

## Colors

In light mode, every colour has one job. Do not mix jobs.

- **Ink (`#0F172A`):** Headings and body text (~17:1 contrast).
- **Text-2 (`#475569`):** Secondary copy (7.5:1) — the darkest grey allowed for copy. **Faint (`#64748B`)** is allowed only at 14px and above.
- **Action (`#0369A1`):** Buttons and links. Hover `#075985`. Also the 2px focus ring. There is one action colour; do not introduce a second.
- **Index (`#0284C7`):** Large numerals, route/progress lines, survey ticks. Never body text.
- **Confirm (`#15803D`):** Done/saved states only.
- **Warn:** Text `#92400E` on tint `#FDF3E3` with border `#EDDCC0`. Icons and marks use `#B45309`.
- **Error (`#B91C1C`):** Destructive actions, Action-Needed status, CRITICAL severity.
- **Sky tint (`#EAF3FA`):** Selected states and zoning — active tabs, selected menu options.
- **Purple and pastel washes are banned outright.** This retires the violet chart accent and every lavender/pastel background.
- **Dark mode keeps its existing hues:** sky-500 primary, green-500 success, red-500 error, amber-500 warning, and the near-white neutral solid CTA. Only light mode uses the deeper Cartographer values above.
- **Slate surfaces:** Never use raw `slate-*` or `gray-*` classes for text. Use the semantic tokens: `text-highlighted`, `text-default`, `text-muted`, `text-dimmed`.

**Extension colours** (approved bespoke use):

| Colour | Use case |
|--------|----------|
| `amber-*` | Dark-mode warning states, HIGH severity dot indicators. Light mode uses the fixed Warn set above. |
| `emerald-*` | Dark-mode healthy status alternative when green-500 conflicts with the background |

`orange-*` (low-value progress bars) and `violet-*` (chart accents) are retired. Progress lines fill with Index `#0284C7` and turn `#15803D` at 100%; charts use Index sky.

## Typography

Public Sans (self-hosted via `@fontsource/public-sans`) is the only typeface. Weights in use: 400, 500, 600, 700, 800. The scale is **theme-agnostic** — it applies to light and dark mode alike.

- **Page title** (30px/800, letter-spacing -0.015em): Single per-page heading
- **Section title** (26px/800): Named sections within a page, under a survey tick
- **Body** (16px/400, line-height 1.6): All prose, table cells, descriptions. Shell/marketing surfaces run 18–20px.
- **Label** (14px/600, sentence case): Table column headers, form labels, card section labels
- **Meta** (13px): The floor. 10–12px text is retired everywhere.
- **Assessment question** (17px/400 with relaxed leading; 18px at 1920px): Multi-question scan and edit views.
- **Survey question** (34px/700; 44px at 1280px; 48px at 1536px): One-question focus and kiosk views only.
- **Metric** (32px/800, leading-none, tabular; 40px at 1920px): Stat values in ink. Suffixes and denominators stay 18px/500; attention values use Warn. Index/ornamental numerals remain sky and never become body text.
- **Code badge** (13px monospace): Question IDs, resource identifiers, on a sky-tint background

**Two-weight law:** regular (400) for data and content; semibold (600) for structure and labels. 700–800 is reserved for numerals, titles, and primary actions.

**Eyebrow micro-caps are banned.** No uppercase + tracking + tiny-size labels anywhere — use 14px/600 sentence-case labels instead.

## Structure

**The survey tick** — a 40×3px mark in Index sky (`#0284C7`), radius 2 — sits above section titles and replaces **all** full-width section rules. Sections separate through tick + title scale + whitespace: 48–56px gaps, and ~80px before a section that follows large numerals.

```vue
<!-- index #0284C7 — swap the raw hex for the semantic token once it lands in app.config -->
<div class="mb-3 h-[3px] w-10 rounded-[2px] bg-[#0284C7]" />
<h2 class="text-[26px] font-extrabold text-highlighted">Review history</h2>
```

**Full-width horizontal lines live only inside tables:** 1px `#CBD5E1` under the header row, 1px `#EEF3F8` between rows. Nowhere else.

**No resting shadows anywhere.** Elevation exists only on floating overlays (menus, popovers, modals, the FAB): `0 8px 24px rgba(15,23,42,.10)`. Radius is 6–8px. Focus ring is 2px `#0369A1`.

**Cards are the last resort.** The one sanctioned heavy line per screen is the **active editor card**: white, 1px `#CBD5E1` border, 2px ink top rule — e.g. the expanded question card in Template Studio. Everything else sits directly on the canvas. That rule may be **inked by meaning, never by decoration**: where the thing being edited carries a state worth reading at a glance, the state colours the rule instead of plain ink — today the only such case is the question card, inked by severity (see Compact Mode).

## Spacing & Layout

4px grid. All spacing values are multiples of 4px. The most used: `p-4` (16px), `p-6` (24px), `gap-4` (16px), `space-y-6` (24px).

**Page structure:**

```text
┌─ Fixed sidebar (80px wide) ─┬─ Header (breadcrumb + actions) ─────┐
│  Peaky logo + wordmark       │                                       │
│  ────────────────────        │  ─────────────────────────────────── │
│  Nav icons (icon-only)       │  Content sits on the canvas          │
│  ────────────────────        │  (dark keeps its layered surfaces)   │
│  Settings / Profile          │                                       │
└──────────────────────────────┴───────────────────────────────────────┘
```

The Profile modal includes a temporary **Access on this device** disclosure until `/system` owns authorization diagnostics. It shows only the current actor's snapshot status, version, refresh and expiry times, and sorted View/Edit grants. It is read-only and never exposes another actor, credentials, tokens, or unrelated local data.

- Page padding: `p-6` (24px) standard, `p-8` (32px) for spacious pages
- Spacious default-layout data pages account for the fixed 80px sidebar with `pl-32 pr-12` (48px visible gutters), stepping to `pl-36 pr-16` (64px) at 1920px; do not combine that inset with root `ml-*` or `mx-*` margins, which makes the visible gutters unequal
- Internal padding of tables and editor cards: `p-4` to `p-6`
- Section gaps: 48–56px (`space-y-12` to `space-y-14`)
- Before a section that follows large numerals: ~80px (`pt-20`)

**Wide desktop starts at 1920px, not at Tailwind's `2xl` breakpoint.** Below it, preserve each page's normal content cap. At 1920px, dense list and table pages may relax outer margins and widen to a 1920px cap. Reading and editing pages keep narrower caps. Every page retains an explicit maximum width; extra screen width must not stretch controls away from the content they affect.

Assessment uses one grid below the app navigation. Below wide mode it has a 232px template rail and a workspace capped at 1152px; compact mode uses a 96px rail. At 1920px it becomes a 264px rail plus a 1600px content grid: 1248px workspace, 320px progress rail, and a 32px gap. Flexible tracks use `minmax(0,1fr)` and children use `min-w-0`. The saved rail preference wins; only viewports below 1280px default to compact when no preference exists.

## Border Radius

| Token | Value | Use |
|-------|-------|-----|
| `rounded-md` | 6px | Chips, badges, small controls |
| `rounded-[7px]` | 7px | Buttons only — see Buttons below |
| `rounded-lg` | 8px | Inputs, menus, editor cards |
| `rounded-full` | pill | Status badges, avatars, filter pills |

Radius is 6–8px everywhere. `rounded-xl` (12–16px) is retired. Do not mix radius levels on a single page.

## Components

### Buttons

"Instrument keys" — every button reads as one system, and a solid button reads as a key you press. Geometry is shared across all three variants; only color and state behavior change. Configured once in `app.config.ts` (`ui.button`) so every `UButton` inherits it — hand-rolled CTAs (all three of the shell's Okta buttons — nav, hero, footer — are raw markup, not `UButton`) are hand-matched to the same values instead of drifting.

**The shell keeps exactly one solid action per viewport.** The hero CTA is the only filled button on the page — `h-12`, `rounded-[7px]`, `border-[1.5px]`, Action fill (`#0369A1` light / `sky-400` dark on `#082f49` ink), `translate-y-[0.5px]` press nudge, no gradient, no shadow. The nav and footer CTAs are drafted outlines instead of a second and third solid slab — `h-11`/`h-12`, 1.5px `#CBD5E1` (dark: `slate-600`) border, ink text, `hover:bg-[#F4F5F7]` (dark: `white/[0.04]`) well fill — so nav and footer rhyme as the same instrument and only the hero reads as "press me."

- **Geometry (all variants):** radius `rounded-[7px]` — a deliberately distinct value from the 8px card/input radius, so buttons read as their own species of control. Heights: `sm` 36px, `md` 44px, `lg` 48px, padding to match. Label 15px at `md`, 16px at `lg`, sentence case. Icons 16–18px with `gap-2`. Focus ring: 2px Action, offset 2, on every variant. Transition: 150ms on colors and transform only — never layout.
- **Primary** (`variant="solid"`, `color="primary"`): fill is Action (`#0369A1`), text white/700. Hover **darkens the fill** to Action-hover (`#075985`) — never an opacity fade (`hover:bg-primary/75` is banned on buttons). Active darkens one step further with a 1px press nudge (`translate-y-[0.5px]`). Disabled: 45% opacity, no hover change.
- **Secondary** (`variant="outline"`, `color="neutral"`): white/transparent fill, 1.5px Border-strong ring, ink text/600. Hover fills the well (`bg-muted`) and darkens the border one step. Active adds the same press nudge. No color tints.
- **Ghost / Text** (`variant="ghost"` / `variant="link"`): Text-2/600, no border ever. Hover resolves to ink text plus a well fill (ghost) or just darkens to ink (link).
- **The one exception to "no resting shadows":** the primary fill's machined bottom edge — a subtle inset shadow (`shadow-[inset_0_-1px_0_rgba(2,44,69,0.45)]`) that reads as a pressed key, not a drop shadow. Nothing else on a button carries a resting shadow.
- **Dark mode:** same geometry and state behavior; dark keeps its existing primary hue (sky) and the hover/active darken steps move within that hue. Verify every new button in both themes.

```vue
<!-- Primary — the default; most buttons need nothing but the label -->
<UButton>Continue with Okta</UButton>

<!-- Secondary — cancel / secondary actions -->
<UButton variant="outline" color="neutral">Cancel</UButton>

<!-- Ghost — icon-only row actions -->
<UButton variant="ghost" color="neutral" icon="i-lucide-more-horizontal" size="sm" />
```

### Stat Blocks

Three-up row at the top of dashboard and detail pages. **No border, no card, no shadow** — the numbers do the work. This replaces the old gradient/bordered stat cards.

- Label: 15px/500 in Text-2
- Value: 40px/800 tabular ink; amber (`#B45309`) for attention counts
- Sub-label: 14px
- Optional progress line: 4px — track `#DDE6EE`, fill `#0284C7`, `#15803D` at 100%

```vue
<div>
  <div class="text-[15px] font-medium text-muted">Open follow-ups</div>
  <!-- Value: ink; #B45309 amber for attention counts -->
  <div class="mt-1 text-[40px] font-extrabold tabular-nums text-[#0284C7] dark:text-sky-400">42</div>
  <div class="text-sm text-muted">across 3 reviews</div>
  <!-- Optional progress line: track #DDE6EE, fill #0284C7 (index), #15803D at 100% -->
  <div class="mt-3 h-1 w-full rounded-full bg-[#DDE6EE]">
    <div class="h-1 rounded-full bg-[#0284C7]" style="width: 65%" />
  </div>
</div>
```

### Stat Strip — the Surveyor's Plate

The row of Stat Blocks sits inside one deliberate exception to "no border, no card": `StatStrip.vue` is a drafted survey plate, not a tinted card. This is the **only** StatStrip look — there is no bare/plain variant to opt out to.

- **Ground:** chart-paper cream `#F9F7F2`, border `#E8E3D9`, bottom edge `#DBD4C4` — a deeper warm on the bottom only, reading as the plate's thickness (print-bevel, zero shadow). 2px ink top rule, editor-card vocabulary. A second inner hairline (`#E3DDD0`, inset 6px — a "neatline") quotes a drafted map's frame. Dark mode shares the elevated `primary/10` ground and skips the neatline/edge nuance; contour linework alone carries it there.
- **Engraving is drafted chart geometry, not generated organic curves.** An earlier pass baked wobbled-ellipse contour rings and terrain lines from splines; at page scale those read as wood grain and knots, not a chart. The engraving is three plain elements, lifted to page-scale presence (v4 — the whisper-quiet v3 pass only rewarded zooming in): a **graticule** (a regular grid of small "+" crosses, the lat/long marks every chart carries, 0.12 light / 0.09 dark); an **edge-cropped compass rose** anchored just outside the plate's top-right corner so only a wedge shows — inner circles and degree ticks (0.12/0.09), radial spokes (0.18/0.14), and the outer ring (0.26/0.20) as the strongest blue element; and one **dotted route** with 3 waypoints, confined to the lower-right quadrant so it never crosses under the first two columns' numerals (0.22 light / 0.16 dark). A horizontal mask holds ~35% line visibility at the far left, ramping to full strength by ~55% width — one continuous plate, never faded to nothing, while the numeral zone stays quiet. A fully-visible rose or ring reads as a sticker; edge-cropping reads as a window into a larger chart sheet.
- **Two-ink printing:** the needle diamond — the rose's "jewel" — takes a muted warm amber (the warning family's ink) at 0.38 light / 0.30 dark; real compass roses mark north in red, this one takes a quieter accent instead. The destination ring takes a confirm green (the success family's ink), also 0.38/0.30, echoing the landing route map's own arrival ring and the pillar-complete bars. Everything else in the engraving stays index blue — three inks total, no new hues introduced.
- **The plate comes alive once.** On first scroll-reveal (never re-triggered) the route mask-wipes in over ~900ms — the same mask-wipe recipe `LandingRouteMap.vue` introduced, on the plate's own clock (the landing map itself now draws over ~1100ms) — and the compass needle fades + scales into place over ~400ms — not the rotation settle `LandingCompassRose.vue` uses on the landing page, because that recipe's full swing carries this needle's thin edge-cropped sliver off-plate for most of the animation instead of visibly settling. The destination ring appears once the draw finishes. Everything else in the engraving simply arrives with the plate — no extra choreography — and nothing loops after settling. `prefers-reduced-motion` snaps straight to the fully-settled plate.
- **Dividers are scale ticks, not borders:** a 1×10px tick (ink 30% light / white 35% dark) hangs from the top rule at each column boundary. No full-height `border-l` — on chart paper that reads as a table rule, not an instrument.
- **Chart paper is a StatStrip-only material.** `#F9F7F2` never spreads to cards, wells, or any other surface, and must read as visually distinct from the Warn tint (`#FDF3E3`) — both are warm, but they are unrelated systems and must never be mistaken for one another.

### Tables

The only place full-width horizontal lines are allowed.

- Header row: 14px/600 Text-2, sentence case, over a 1px `#CBD5E1` rule
- Rows: separated by 1px `#EEF3F8` lines, `py` ≥ 18px
- Cells: 16px ink
- At 1920px, headers and supporting values may step to 16px, primary cells to 17px, and row padding to 20px
- A clickable row is keyboard reachable and responds to Enter. It ignores activation from links, buttons, form controls, and the actions cell
- Give each row one view path. Do not combine whole-row activation with a duplicate View button
- Row actions stay visible and reachable; they are never hover-only

### Tables — Sheets

Every table is a bounded **sheet**, not a canvas that search and filters float above. The existing `.data-table-surface` (canvas, 1px hairline, `rounded-lg`) owns a title block and a footer rail inside its own border, so the whole thing reads as one object the page hands off to: title, search, data, count.

- **Title block** — inside the border, `px-6 pt-5 pb-4`, title 16px/600 `text-highlighted` with no survey tick (ticks are page-section vocabulary; sheets carry their own title). The **console** — search plus filters — sits to its right in a `gap-3` row. A `border-b` in row-line separates the title block from the header row.
- **Footer rail** — inside the border, `border-t` row-line, `px-6 py-3`, `min-h-14` (sized to fit a future 32px control row so turning on pagination adds zero vertical shift). Left: count text, 14px `text-muted` tabular-nums, reading `"{N} {noun}"` normally and `"{K} of {N} {noun}"` once a search or filter narrows the set. Right: reserved for export/pagination controls (`#footer-trailing`).
- **Filter chips** (`FilterChips.vue`) — the one canonical chip, replacing every hand-rolled toggle: selected `bg-primary/10 text-primary font-medium`; unselected `text-muted hover:text-default`, transparent, no border; `text-sm px-3 py-1.5 rounded-[7px]`, focus-visible ring.
- **Action compression** — the row's own link (usually the name cell) is the view action, so it never needs a duplicate button. At most one quiet action stays visible on the row (`variant="ghost" color="primary"`, e.g. "Start review"). Everything else — Archive, Restore, Delete — folds into a single `⋯` overflow (`variant="ghost" color="neutral"`, `icon="i-lucide-ellipsis"`, `aria-label="More actions"`). Destructive actions live inside that menu only, styled `color="error"`, and still confirm before acting — never a bare destructive button on the row.
- **Reserved: pagination.** Designed now, wired later. Footer rail, right side: a range string ("1–25 of 118", 14px tabular), ghost prev/next instrument keys, and an optional page-size select. The rail is already sized for this, so switching it on later costs no layout shift. The CSV export control's future home is the same slot, `#footer-trailing`.

The Template library uses its whole row as a safe view action. It opens the current published Revision when one exists, otherwise it opens the draft in explicit view mode. The table never shows Edit or duplicate View buttons. Actors with draft edit access get one "Edit draft" action in the read-only notice, making the transition into authoring deliberate and keeping it close to the state it changes. The same transition is available as "Edit draft template" in the command palette only while that Template Studio view is read-only and the actor has edit access; Template library commands remain View actions.

### Dropdown / Select Menus

White, 1px `#DDE6EE` border, radius 8, overlay shadow (`0 8px 24px rgba(15,23,42,.10)`). Options are 15px, sentence case. Selected option: sky-tint (`#EAF3FA`) background plus a check mark. Leading coloured dots only when they carry meaning (risk levels) — never as decoration.

### Status Badges

Always use `variant="subtle"` with the semantic colour mapping:

| Meaning | NuxtUI colour |
|---------|---------------|
| Ready, Completed | `success` |
| Active, when it means available or operational | `success` |
| In Progress | `primary` |
| Draft, Inactive, Archived | `neutral` |
| Action Needed, Blocked, Failed | `error` |
| Pending, when waiting or caution is the point | `warning` |

Map status by meaning, not spelling. Work underway is In Progress and Primary. Warning is for waiting or caution. No and N/A answers are never Error states.

### Severity Badges (Template Studio)

Dropdown selectors with a coloured dot prefix: `• CRITICAL`, `• HIGH`, `• MEDIUM`, `• LOW`.

| Severity | Dot colour |
|----------|-----------|
| CRITICAL | `text-error` (`#ef4444`) |
| HIGH | `text-warning` (`#f59e0b`) |
| MEDIUM | `text-warning` muted |
| LOW | `text-dimmed` |

### Question ID Badges

Monospace identifier badges at the left of each question row (`REL-1`, `Q-INF-001`). Background: sky tint (`#EAF3FA`), text: Action, font: `font-mono` at 13px, radius: `rounded-md`.

### Avatar Groups

Circular initials avatars overlapping by 8px. Each user gets a consistent generated colour (green, teal, sky, amber — purple is banned). Groups of 3–4 with `+N` overflow badge.

```vue
<div class="flex -space-x-2">
  <div class="h-8 w-8 rounded-full bg-green-500 ring-2 ring-elevated flex items-center justify-center text-[13px] font-semibold text-white">SC</div>
  <div class="h-8 w-8 rounded-full bg-sky-500 ring-2 ring-elevated flex items-center justify-center text-[13px] font-semibold text-white">MJ</div>
</div>
```

### Identifier / Tag Chips

Small neutral chips for team slugs, app IDs, origin labels, and repeated metadata such as templates used by a review (`team-customer-portal`, `Bespoke`, `app-001`). These are informational, not interactive. Render each template as its own quiet chip instead of one comma-separated string so the set remains scannable. Chip text is 13px, the meta floor; avoid borders when several chips share one table cell.

```vue
<span class="inline-flex items-center rounded-md border border-default bg-muted px-2 py-0.5 text-[13px] text-muted font-medium">
  team-customer-portal
</span>
```

### Event Category Chips

Prefix chips in the events feed that categorise each event:

| Category | Style |
|----------|-------|
| System | `color="success" variant="subtle"` |
| Review | `color="neutral" variant="subtle"` |
| Integration | `color="primary" variant="subtle"` |

### Sync Status Chips

Small status chips in the events feed: `synced` (success), `local` (neutral), `pending` (warning). Always `variant="subtle"`, chip text at the 13px floor.

The header connection dot reports verified connectivity, not local database readiness. Green requires a successful API sync and an active SSE stream. Amber means API sync works while SSE or pull is degraded. The primary spinner means a sync is running. Gray means no successful sync yet or the server is unreachable. A non-2xx or non-`text/event-stream` SSE response must never turn the dot green.

### Delta Badges

Percentage-change indicators on stat blocks (`+2%`, `-1%`). Green for positive, red for negative, muted for zero.

```vue
<span :class="delta > 0 ? 'text-success' : delta < 0 ? 'text-error' : 'text-dimmed'" class="text-[13px] font-medium">
  {{ delta > 0 ? '+' : '' }}{{ delta }}%
</span>
```

### Tabs and Filter Chips

Filters are chips, not tabs. Use `FilterChips` for query and surface filters; chips wrap, expose `aria-pressed`, and use tabular numerals for counts. Use tabs only to switch one content region, such as templates in a breakdown or pillars when the assessment rail is compact. Tabs need a structural active cue, keyboard selection, and horizontal scrolling when labels do not fit.

### Template Studio Pillar Tabs

Draggable horizontal tabs keep their drag handle, visible active rule, 13px tabular count, horizontal scrolling, and keyboard selection. Dragging is an extra editing affordance, not the only way to select a pillar. Editable tabs reserve a fixed delete gutter, so revealing the trash icon changes opacity without moving neighboring tabs. Deletion always uses a standard confirmation modal outside the scrolling tab strip. Read-only tabs keep Add pillar visible but disabled, with the restriction reason available on hover and keyboard focus.

### Template Studio — the Drafting Table

The studio's questions editor (`/templates/{id}/edit`) is staged on the same material as the Guided Drafting Room, one level out: the work area under the pillar tabs is a cutting mat (identical dot-grid recipe), and the active pillar's editor is a **sheet** lying on it — white paper, the 2px ink top rule, hairline registration marks in the corners, and `Pillar {n} of {m}` (13px, dimmed, tabular) on the header's right baseline, the room's "Section n of m" grammar one level up. Opening a question then reads as that sheet taking over the screen, not a scene change.

Studio width follows the task. A resting question list caps at 60rem, stepping to 72rem at 1600px and 80rem at 1920px. An expanded Compact editor caps at 72rem, then 88rem and 96rem at the same breakpoints. Above 1600px, retain at least 48px of cutting mat on each side. The Compact identity band stays stacked below 1280px; above it, Resources takes two-fifths of the band with a 24rem floor. The Guided sheet caps at 880px normally and 1200px at 1920px. Resting-to-expanded width and body disclosure use the emphasized 500ms easing curve, with reduced-motion users getting an immediate state change.

**The mat has to be visible to be material.** Resting mode keeps the narrower cap because a short question list is a reading surface. Expanded mode deliberately grows because multi-field authoring benefits from width; even then, the explicit cap and side gutters preserve enough dot grid for the sheet-on-table metaphor to remain visible.

**The rule is handed over, never stacked.** While a question is expanded, that card is the screen's active editor, so the pillar sheet drops its 2px ink top rule to a hairline and reads as the table the card lies on. Exactly one heavy ink rule is painted at any moment (see Active Editor Card): the sheet's when the list is at rest, the card's while a question is open.

The template's identity — its name and the **description** the review wizard's template cards display — is edited in one place: clicking the template name in the studio header opens the **Template details** modal. The name carries a quiet dotted underline at rest (border-strong gray, the same mark as the PM/EL identity links), strengthening to Action ink on hover alongside the pencil. No resident field parks in the studio, so the Maturity score & Follow-ups overview can use the top space without competing with template metadata. In the modal: a Name field that commits live while trimmed non-empty (clearing it mid-thought never writes an empty name), and a Description capped at **160 characters** to match the wizard card's two-line clamp, with a live `{n}/160` counter (amber at the limit) and a helper line saying exactly where the text shows up. Edits apply live and ride the draft autosave; the single action is Done. The name is plain text — no pencil, no modal — on non-draft revisions. The header shows one Revision badge only: Draft or Published · vN. Template lifecycle, ownership, and storage details belong in Template details, not as an undifferentiated metadata sentence beside the name. When editing is unavailable, a persistent lock notice above the pillar tabs states why and keeps affected add actions visible but disabled.

### Compact Mode — the Active Editor Sheet

Compact Mode (`QuestionCardCompactView.vue`) is the in-place editor for authors who already know the question schema. It never opens a modal and never leaves the list: expanding a row turns that row into the sheet being worked on, in place.

- **The card is the sheet.** Expanded, the card takes white paper (`bg-default`), the 1px `#CBD5E1` border, the screen's one 2px top rule, and the same hairline registration marks as the pillar sheet and the room's paper — at card scale (10px arms, inset 8px). Collapsed rows stay bare hairline-separated lines on the pillar sheet, so the collapsed→expanded move reads as one line becoming the active sheet.
- **Severity inks the sheet's one heavy rule.** The question already carries Critical / High / Medium, and its risk is the one thing a template author wants to read across a pillar without opening anything, so severity — not decoration — is what puts colour on this card. Expanded, the 2px top rule (the active-editor mark) takes Error `#B91C1C` for Critical and the Warn mark `#B45309` for High (dark: `red-400` / `amber-400`); **Medium leaves it plain ink**, because "no alarm" is the reading, not a missing style. Collapsed, the same reading is a 3×20px tick flush to the row's leading edge — the same two inks, with pencil `#94A3B8` (dark `slate-500`) for Medium — so a pillar's risk profile scans straight down the left margin. The brighter badge hues (`#ef4444` / `#f59e0b`) are deliberately not used here: these are 2–3px structural marks on white paper, and at that size a candy amber reads as decoration. An unrecognised severity renders **no mark at all** rather than borrowing one.
- **Two bands, two materials.** The **identity band** on top is two columns of one sheet, not two panels: a single vertical hairline divides them and nothing inside is washed, tinted, or boxed. The split is semantic, not an even balance: Type, Question, and Why this matters are the question's own words and sit together on the left; Resources is the one section that points off the sheet, so it sits alone on the right and takes two-fifths of the identity band with a `24rem` floor. The **answer band** below it is Leading practices at the card's full width, and it sits on the **cutting mat**: the well (`#F4F5F7` / `slate-800/40` dark) under the studio's own dot grid — the `.studio-table` recipe verbatim, 1px radial-gradient dots on a 24px grid, `#E4E7EB` light / `rgba(51,65,85,.5)` dark. Every row in that band is a textarea, which is exactly what the well is for, so this is the sanctioned quiet-zone use and not a card wash: the paper above is what the question *says*, the mat below is where it gets *filled in*. **The dots are load-bearing, not texture.** Flat well alone reads as a panel switched off, and the leading practices are the opposite of deprioritised; dots read as material under paper, which is the same sentence the page says one level out — the card is a sheet on the drafting table, and its lower half is that table showing through. The mat is painted once, on a wrapper around the answer band's own content (Leading practices and, on a yes/no question, the live Follow-up placement block), so the grid keeps one rhythm through the hairline between the two rather than restarting at that seam. The footer rail is not part of this band — see Footer rail below. Each practice sits on an elevated paper row with a hairline, small radius, and quiet shadow. That contrast keeps editable rows distinct from the dotted mat without adding another hue. Flipping the question type moves nothing: only the rows inside the answer band change.
- **Leading practices is one section under one name.** A checklist question has the reviewer tick the practices off one at a time; a yes/no question asks for one call over the whole list. That is the only difference, so the editor names the list once (see Naming — leading practices). Practice lines from template authors run to two sentences, so the rows are wrapping textareas at the card's full width in both cases — never single-line inputs that clip what was typed. Enter commits the line and opens the next one.
- **Every content section opens with the index tick.** A sky `h-[3px] w-6` mark above a 14px/600 sentence-case label — the drafting room's sheet-header grammar at field scale, and the one mark that replaces the old run of differently coloured section icons. Sections are separated by spacing alone; the band boundary is the one hairline, because full-width rules otherwise stay inside tables and the answer band's own table-header rule is the line that opens it.
- **Repeated rows need separation.** List headers keep the table voice. Leading-practice rows use elevated paper, 8px vertical gaps, hairlines, and a quiet shadow over the mat. Guided practices and resources use the same row spacing. Row controls stay in fixed gutters, appear on hover or focus, and reach for Error ink only on destructive hover.
- **Type is a control row, not a section.** Its 14px/600 label sits **inline** with its two buttons (`gap-x-3`, center-aligned) and it is the one section that carries **no index tick** — a tick announces a section of the question's own content, and Type announces a setting. Inline, the identity band starts ~40px tighter and Question and Why this matters move up with it; Compact Mode is where vertical space is scarce, so the Guided Drafting Room keeps its stacked type control unchanged. Selection is still the sky recipe: two `rounded-lg` buttons, selected `border-sky-600 bg-[#EAF3FA] text-sky-700` (dark: `border-sky-400 bg-sky-400/10 text-sky-300`) plus a check.
- **Validation states speak in their own ink.** `Required: at least {n} leading practices` is a warn mark — Warn `#B45309` at 13px/500 with the alert glyph — not dimmed prose; the footer's error count and its blocked Done stay Error ink. Amber means "needs attention before this is finished", red means "this is wrong now"; neither is ever a tinted pill on this card.
- **Footer rail.** A hairline top edge, back on the card's own white paper (`bg-default` / dark equivalent) rather than on the answer band's mat: Delete question and Done act on the whole question, not on the leading practices list, so the footer differentiates from the mat instead of sharing it — the card reads paper, then mat, then paper again, never three surfaces pretending to be two. A flat well footer with no dots was tried and rejected: without the dot grid the well's flat tint is indistinguishable from the mat above at a glance, so the footer still read as scoped to the practices list — exactly the ambiguity this fix exists to remove. Delete question sits as a quiet ghost aligned to the card's content left edge — the same optical left as Leading practices and the sheet's other section labels, not the button's own hit-box padding — with the error count and Done right-aligned. Count grammar throughout: `{n} practices`, `{n} links`, `{n} errors`.

**Maturity score and Follow-up placement.** The stored definition calls this value a stage association. Authors see two clearer terms. Answers and severity-derived weights set the Score stage; Follow-up placement only decides whether an explicit gap appears in the Earlier-stage, Current-stage, or Later-stage group. Placement never changes the score or Score stage.

- **The overview stays compact.** `MaturitySection.vue` shows all five Score stages and ranges on one raised spectrum plate: a shared paper surface, hairline dividers, quiet shadow, and a restrained pencil-to-Index-blue progression across the top edge. Stage names use 18px type, stage numerals 17px, ranges 16px, and every name trigger is at least 44px high. Hovering or focusing a stage opens the shared Cartographer popover with its canonical meaning, proportional bands, range, and next threshold. The default stage starts are 5, 25, 50, and 75 percent, keeping **Not implemented** below 5 percent. **Test maturity scoring** opens the ordinary Template Preview so authors can answer the draft and watch the score move.
- **The spectrum is the range editor.** **Adjust score ranges** adds one proportional rail and four grippable seam sliders to the same plate. Each slider displays only its percentage. Focus or selection persists while one inline editor says **Ad-hoc starts at**, **Defined starts at**, **Measured starts at**, or **Optimized starts at**. Drag, Arrow keys, Page keys, Home, End, and numeric entry all update the same stage start. The editor lane keeps a fixed height; the equal-width legend drops its full bars and dividers while editing. **Use default ranges** restores all four starts atomically.
- **The scoring reference stays static.** **How scoring works** uses the Preview vocabulary in bare Formula, Question weights, and Answer rules rows. It never invents answers, point totals, coverage, percentage, or a Score stage.
- **Checklist questions** put a `Follow-up placement` select at the right end of every practice row. The `10.5rem` track and right alignment keep wrapped text clear. `Set all Follow-up placements` is the quiet bulk control beside the practice count.
- **Yes/no questions** get one `Follow-up placement` block after Leading practices. One answer represents the whole question, so its practice rows carry no extra placement control.
- **Both editing modes use the same contract.** Compact keeps the controls in the active sheet. Guided adds Follow-up placement as its final route section, with the same one-control Yes/No shape and the same per-practice plus bulk checklist shape.
- **Compatibility stays honest.** Checklist practices normally divide their severity-derived question weight equally. No custom-share or guidance editor exists. Valid legacy custom weighting and guidance continue to round-trip. A compatibility notice offers **Use equal weighting**, and invalid hidden guidance has an explicit removal recovery.

### Naming — leading practices

A checklist question and a yes/no question hold the same thing: the leading practices a team is expected to have in place. The checklist question has a reviewer confirm them one at a time; the yes/no question takes one call over the list. That is a difference in how the answer is given, not in what is being listed, and two names for one concept ("checklist items" against "leading practices") made authors think they were two features.

**One name, everywhere a person reads it: leading practices.** The section heading, the row placeholder, the add button, the counts, and the validation messages all say it in both modes and both question types.

Three things deliberately keep the older word, because in each of them "checklist" names the answer mechanic rather than the list:

- **The `Checklist` question type.** It names how the reviewer answers — tick each practice — which is exactly the distinction the rename is not trying to erase.
- **The internal `checklist-gap` ImprovementPlan state.** Follow-ups derives it when a recorded checklist still has applicable unchecked practices. The code name remains because it describes the answer mechanic, not the visible product name.
- **The Markdown interchange token.** `**Checklist Items:**` is a parse token, not a label — `app/utils/templateMarkdown.ts` matches that string exactly on import. Renaming it would stop every already-exported template from importing. It changes with the template-model migration that gives the two lists one field, not before.

Code identifiers, schema columns, event names, and test fixtures keep `checklistItems` for the same reason: the storage split is real until the model merges the two lists.

### Markdown Transfer

Import and export use one bounded Cartographer dialog: maximum 72rem wide and 52rem tall, with 32px viewport gutters. Header and footer stay fixed while the monospace editor scrolls inside a well. Never combine `autoresize` with a clipped modal body. Import is two-step: Review import parses and summarizes current versus incoming pillar and question counts; Replace template is the only destructive commit action. Parsing errors preserve the pasted Markdown.

### Guided Drafting Room

The full-screen guided question editor (`GuidedDraftingRoom.vue`) is staged as a drafting room, not a generic modal: a rail of route waypoints, a cutting-mat table, and a sheet of paper being filled in. Expanding a question never opens the room automatically; the author must choose Guided or Open drafting room. Escape and Back to template both close it and return focus to the originating question. Follow-up placement is the final section.

Preview template opens the full-template test view above the room and restores focus on exit. `MaturityPreview.vue` runs temporary answers through the production calculator. Its resting line shows score, exact Score stage, coverage, and the provisional or no-result qualifier. **How scoring works** keeps a stable label beside coverage and uses a trailing down/up chevron to show its closed/open state. It opens a **Live calculation** section labelled **Updates with every answer**. One raised plate holds the earned ÷ available = maturity equation. Two compact labelled rows follow the plate. **Current question mix** renders only nonzero severity counts and multipliers. **Scoring rules** keeps checklist, unanswered, and N/A cues on one wrapping icon-led row. Neither row adds a panel, border, divider, or shadow. The available operand states how many questions supply the weighted total. Hovering or focusing the live stage shows its canonical meaning, proportional score bands, the current percentage, and the next threshold. The fixed Preview header warns before any answer control: **Answers are not saved. Reloading this page clears them.** Checklist item editors wrap long text, resource titles wrap instead of truncating, and risk-menu options use standard menu type.

- **Cutting-mat table** is the room's own signature material — what chart-paper is to the Stat Strip's plate. A quiet dot grid sits under the sheet: `radial-gradient` dots, 1px, on a 24px grid (`#E4E7EB` light / `rgba(51,65,85,.5)` dark) over the existing table well. Barely-there at arm's length; the sheet's own background paints over it, never the reverse.
- **Action top rule.** The room root carries a 2px Action blue rule. It replaces the obscured question card rule and marks the full-screen authoring state without adding a second heavy line.
- **Functional color carries the route.** The header uses the approved sky wash. The rail stays on the canvas with a neutral dashed connector, matching the product setup rail. The current row uses sky tint with an Action label, and started sections use a quieter blue waypoint. Confirm green appears only after section content passes validation, paired with a check rather than color alone.
- **Sheet header.** A small sky index tick sits above the section title. Required uses a blue status badge, Recommended uses Warn, and Optional remains neutral. The right side shows a 32px Index numeral plus the smaller total, with one accessible `Section n of m` label.
- **Registration marks.** Hairline L-marks in each of the sheet's four corners — 12px arms, 1px, `--ui-border` light / slate-700 dark, inset 10px. Decorative, `aria-hidden`, pointer-events-none — the drafted touch you only notice on lean-in.

**The Drafting Room Ceremony** plays once when the room opens, and never blocks: the first field is focused and typeable from the first frame regardless of where the choreography is.

| Act | What happens | Starts | Duration |
|-----|---------------|--------|----------|
| Room enters | Existing fade + scale from 98.5% scale (unchanged) | 0ms | 250ms |
| Paper laid down | Sheet rises 12px into place on the table | 80ms | 420ms |
| Route draws | Rail's dotted connector wipes top→bottom; waypoints step in behind it | 120ms | 500ms (+70ms/row) |
| You are here | The current waypoint pulses once, sky ink | 640ms | 600ms |
| Section inks in | Title, description, and editor rise with the entrance-reveal recipe (see Motion) | 200ms | 700ms, 70ms stagger |
| Chevron hand-off | Abbreviated variant: rail and sheet hold still, only the section's own content inks in, faster | on ‹ › | 450ms, 60ms stagger |
| Section earns green | A completed waypoint gains a confirm-green check plus one soft pulse | when section validation first passes | 450ms |
| Paper filed | Back to template: a quick settle down + fade, no lingering | on exit | 200ms |

The full entrance plays on a fresh open; the abbreviated hand-off plays when the header's ‹ › chevrons move to a neighbouring question instead. Each question owns its own room instance, so a chevron hand-off actually closes one room and opens a sibling a beat later — `useDraftingRoomHandoff()` bridges that gap with a module-level timestamp: the closing room marks the moment, and the opening room checks whether that was under 600ms ago. The section-earns-green reward fires at most once per section per room-open, when that section first satisfies its content and length requirements. `prefers-reduced-motion` snaps every act above straight to its settled state.

### Review Wizard — Template Selection

The New Review wizard's first step (`ReviewWizardTemplateStep.vue`, one component shared by the team and product wizards) presents templates as ranked groups, not a flat paginated list. Group order is an editorial ranking — what the organisation wants chosen sits closest to the hand:

1. **Featured** — campaign templates declared in `app/constants/featuredTemplates.ts` (`FEATURED_TEMPLATES: { templateId, note }[]`), under their own "Featured" header like every other group — an unlabeled hero reads as a loose card or a mistake, and the group stacks naturally when two or three campaigns run at once (each entry brings its own amber note). Each hero is a full-width real `<button>` carrying the editor card's 2px ink top rule (`border-t-2 border-t-inverted`), a 17px/700 title, the mono `v{n}` chip, an amber campaign chip carrying the note (e.g. "Peak season · required"), the full metadata line, and a solid Select affordance — a non-interactive `<span>` (`pointer-events-none`) styled as the Action button so the whole hero stays one focusable control; selected swaps it to sky tint plus a check. A featured entry that doesn't resolve in the catalog is silently skipped — never a broken hero.
2. **{Team} templates** — templates whose `ownerTeamId` matches the wizard's team context. Team wizard only; the group simply doesn't render elsewhere.
3. **All templates** — every remaining published template, sorted by `reviewsCount` desc, then `publishedAt` desc. Popularity is real usage — never a fabricated ranking signal.
4. **Drafts** — always the last group, cards with dashed borders (dashed = provisional, see Motifs). The group explains itself: drafts are there to try a template in a real review *before* publishing, because a published Revision is immutable. A draft lives only in its author's local database until draft sync ships, so a draft-backed review is a this-device trial — the UI must never imply otherwise.

**Groups are cutting mats.** Each group's cards (the hero included) sit on a `.shelf-mat` — the Guided Drafting Room's signature material at catalog scale: the well (`#F4F5F7` light, `slate-800/30` dark) under the room's 1px radial-gradient dots on a 24px grid, `p-3`, `rounded-lg`, no border and no shadow. Template cards read as sheets lying on the table, and the sheet's background always paints over the mat, never the reverse. Each card opens with the sheet-header **index tick** (`h-[3px] w-6 rounded-full`) — Index sky for published sheets, pencil-gray border-strong (`#CBD5E1` / slate-600) for drafts. The reveal toggle sits on the mat with the sheets it reveals.

**Cards** (`ReviewWizardTemplateCard.vue`) sit in a two-column grid (`grid gap-3 sm:grid-cols-2`; single column on mobile) — only the featured hero spans the full width. Each card is metadata-rich so two templates with the same name disambiguate at a glance: name + mono `v{n}` chip (drafts get a neutral "Draft" chip instead) on the title row, then "by {owner} · updated {relative}" — the owner segment is omitted entirely when the owning team can't be resolved, never a raw id — then a two-line (`line-clamp-2`) description. The "{n} pillars · {n} questions · {n} reviews" line is pinned to the card's bottom edge (`mt-auto` on an `h-full flex-col` card) so the stats align across every card in a grid row and the group reads as a comparison table. A draft card never borrows its template's review count — those reviews belong to the published revisions, and a draft has never been reviewed. Selection is the sky-tint recipe: `border-sky-600 bg-[#EAF3FA]` plus a check-circle icon (dark: `border-sky-400 bg-sky-400/10`); a selected draft trades its dashed border for the solid sky one.

**Long groups preview, then reveal.** "All templates" previews its 6 most-used cards and Drafts previews 4; anything longer adds a quiet centered toggle below the grid — 13px medium, chevron, no border. A group hiding only a handful (≤12) opens in one click ("Show all {N} templates"); past that it reveals a page of the grid at a time ("Show 24 more"), so a hundred-template catalog never lands as one dump. Fully revealed, the toggle becomes "Show fewer". Both capped groups keep a header count in the K-of-N grammar ("6 of 24 templates", "4 of 31 drafts") while truncated — the truncation is never silent. The team-templates group and search results are never capped: a team's own set is naturally small, and a search is an explicit ask for everything that matches. Question counts are fetched only for the cards actually rendered, so a large catalog doesn't turn into a hundred detail requests on open.

**The toolbar stays within reach.** Search, the filter chips, and the Selected Revisions tray sit in a block pinned below the app header (`sticky`, solid `bg-default`, a bottom hairline as its own edge) — deep in a revealed group, the way back out and the 3-slot selection state never scroll away. The band is opaque on purpose: translucency smears passing cards into ghost text. (The app layout's `<main>` must stay `overflow: visible` for this — the window is the app's one scroller, and any overflow value on `main` silently kills `position: sticky` for every descendant.)

**Entrance.** One quiet settle when the step first paints — the toolbar and each group block rise 6px over 240ms with a 40ms stagger, armed after hydration, snapped to the finished state under `prefers-reduced-motion`. Then stillness; the only standing motion is the 150ms press acknowledgment on cards (`active:scale-[0.99]`).

Above the groups sit **All · Published · Drafts** filter chips and the search field. A search query flattens the groups into one grid headed by the count grammar — "{K} of {N} templates" — because a ranked list answers "what should I pick?" while a search answers "where is the one I named?".

**Scope steps speak plainly.** The team wizard's scope step leads with "Most team reviews cover the team as a whole." and offers applications as the exception, not the default; when the team owns no applications, the picker says so plainly ("This team doesn't own any applications yet — showing the full catalog") instead of implying ownership. The confirm step describes a team scope as "Team-scoped — covers the team as a whole." — never "No applications linked.", which reads as an error the user has to fix.

### New Product Wizard — the Route Rail and the Sheet

`/products/new` is staged like the Guided Drafting Room one level out: a rail of route waypoints on the left, a cutting mat on the right, and one sheet of paper on the mat holding the step being filled in. The stock stepper bar is retired — the rail says both where you are and what you have entered so far.

- **The rail** (`product-wizard/StepRail.vue`) is the assessment sidebar's waypoint vocabulary at wizard scale: a dashed vertical connector threads one `h-2.5 w-2.5 rounded-full border-2` waypoint per step — confirm green once the step has the input it needs, Index sky filled on the step you are on (its row takes the sky-tint selected background `#EAF3FA` / dark `sky-400/10`), a hollow sky ring for a step already reached, hollow gray for a step still ahead. Each row carries a 14px/600 title and a 13px sub-line that starts as the step's ask ("Name, origin, and contacts") and is replaced by what was actually entered ("Checkout · Bespoke", "2 teams", "3 applications"), in the "{N} {noun}" count grammar. Steps past the furthest one reached are `disabled`, so the rail walks back but never skips ahead.
- **The mat and the sheet.** The work column is a cutting mat — the room's dot-grid recipe (`#F4F5F7` under 1px `#E4E7EB` radial-gradient dots on a 24px grid; `#020617` under `rgba(51,65,85,.5)` dots in dark), `p-4`, `rounded-lg`, no border, no shadow. One sheet lies on it: white paper, 1px `#CBD5E1` border, the 2px ink top rule, hairline registration marks in the four corners. That rule is the page's one heavy line.
- **Sheet header.** The sky index tick (`h-[3px] w-6`), then a baseline row — step title at 20px/700 left, `Step {n} of 4` (13px, dimmed, tabular) right — then the step's one-sentence ask. Same grammar as the room's `Section {n} of {m}` and the studio's `Pillar {n} of {m}`.
- **Identity has room to work.** The page caps at 1440px without extra desktop side margins. Decision contacts and optional Working links become two balanced sections only at `xl`; below that they stack. Fields inside both sections stay vertical, so person search and URLs never collapse into narrow three-column inputs.
- **Actions sit on the sheet**, separated by whitespace only: Cancel (ghost) far left, Back / Skip / Continue or Create product on the right. No rule above them — full-width lines stay inside tables.
- **Step hand-off.** Moving between steps holds the rail and the sheet still and inks only the step's content in (6px rise over 260ms), the abbreviated hand-off the drafting room uses on its chevrons. On first paint the legend, rail, and mat rise 6px with a 40ms stagger, armed after hydration; `prefers-reduced-motion` snaps straight to the settled page.
- **The legend** (`ProductMentalModel.vue`) sits above the wizard on plain canvas — no card, no wash — and is built as a keyed map legend, not four mini-articles. One intro line, then four parts named after the wizard's own steps (Identity, Teams, Applications, Links). Each is keyed by a small icon chip — `h-7 w-7 rounded-md bg-primary/10` with a 16px glyph in Action ink, **one tint across all four** so the glyphs do the telling and the row never turns into colour-coded badges (the one place the laws allow a tint fill is exactly this: a small icon chip, never a card). Beside the key: a 14px/600 name, a meaning of a few words — worded to match the rail's own step lines below, so the legend keys the route — and the worked Checkout example as identifier chips. All four parts carry chips, so the block reads as one rhythm instead of mixed prose and pills. Each part is its own `content-start` grid, which keeps the name, meaning, and chip rows aligned across the four even when one part's chips wrap. A quiet Show/Hide toggle stores the reader's choice in `localStorage` (`peaky:product-legend-open`); the section renders open on the server and pre-hydration.
- **Pickers preview, then reveal.** The Teams and Applications steps (`product-wizard/StepEntityPicker.vue`) drop the 4-per-page pager for the review wizard's shelf recipe: a two-column card grid previews 6 and reveals 12 at a time ("Show all {N} teams" while 12 or fewer are hidden, "Show {n} more" past that, "Show fewer" once open), with a K-of-N header count so truncation is never silent. Each card is the sky selection recipe over a `rounded-lg` hairline, with the directory id pinned to the card's bottom edge as a mono identifier chip so ids line up across a grid row. Above the grid, the selection tray lists what is picked as removable pills. When teams are already chosen the applications list is scoped to them and says so: "Showing applications owned by the selected teams. Search to reach the full catalog."
- **The review step is a manifest, not nested cards.** `StepReview.vue` lays Identity out as a `dt`/`dd` grid, then Teams and Applications as chip groups (`SummaryList.vue`), then Links. Every group header carries an Edit link that sends the rail back to that step. Teams, applications, and people render by display name, never a raw directory id; a field with no value reads "Not set" in dimmed text rather than a dash. An empty Applications group is a dashed box — dashed is still-to-decide, and applications are optional.
- **No visibility control.** Products are internal-only today, so the wizard offers no internal/external choice and the review step states none.

### Product Overview

`/products/{id}` is the product's record: identity chips, the survey plate, the title block, and the reviews sheet — three drawn objects stacked down the page. The bordered "Architecture" and "Resources" panels are retired, and so is the bare four-column band that briefly replaced them: labelled columns floating on canvas read as unstyled text, not as a designed object.

- **Header.** The section header's tick plus the product name, with Edit and Follow-ups as ghost keys and Start new review as the page's one solid action. Under it a chip row: the origin as an identifier chip, an "External" chip only when the product actually is external, and "Created {relative}" at 14px dimmed. There is no "Internal" chip — every product is internal today, and a chip there would imply a choice that does not exist.
- **Stat strip.** Active reviews (sub-label "draft or in progress"), Total reviews (sub-label "{N} reviews archived", only when something is archived), Last activity. Nothing is stated that the local data cannot back.
- **The title block** (`ProductTitleBlock.vue`) is the page's ownership panel. On a drafted map or an engineering drawing, the title block is the ruled panel that names who drew the sheet, who approved it, and which documents it references — which is exactly this content, so it is drawn the way one is drawn rather than styled as a card:
  - **Frame and neatline.** An outer 1px `#CBD5E1` frame at `rounded-lg`, and inside it a second hairline frame inset 5px (`rounded-[4px]`, `#DDE6EE` / slate-700) — the same neatline device the stat plate carries, in the standard hairline because this panel sits on white, not chart paper. The neatline clips the panel's contents, so every internal rule stops at it and the edge reads as double-ruled instead of crossed.
  - **No fill, no top rule, no shadow.** The lines do all of it. The page's one ink top rule already belongs to the stat plate above; a second here would make two.
  - **Caption row.** Inside the frame: `px-6 py-4`, "Ownership and resources" at 16px/600 `text-highlighted` with **no survey tick** (the panel carries its own caption, the same allowance a table sheet has), and the drawn-by field on the right — "Added by {name}", 13px dimmed, resolved from `createdBy` and falling back to the stored id rather than a blank. A `border-b` hairline separates it from the cells.
  - **Ruled cells.** Four cells: Contacts, Teams, Applications, References. One column stacks them with horizontal rules; two columns and four columns rule vertically, and only where cells actually sit side by side. At `xl` the tracks are deliberately uneven — `1.15fr 1fr 1fr 1.15fr` — the way a drawn title block rules unequal fields, so the stacked contacts and the reference lines get the room their content needs. These divisions are internal to a bounded object, the same allowance tables and sheets have; they are never page-level section rules.
  - **Contacts is the human-first cell** and comes first: the drawn-by / checked-by stack a real title block opens with. Product manager and Engineering lead each get a 13px dimmed sub-label above a 15px/600 Action link into the directory.
  - **Field names** are 14px/600 `text-muted` — the table-header voice, because this is a ruled object. Teams and Applications right-align a "{N} {noun}" count on the field row. Team and application values are identifier chips that link into the directory; references are `dt`/`dd` lines pairing the field name with a real link.
  - **Empty fields are dashed.** A cell with nothing in it shows a dashed 13px pill — "Not set", "None linked", "No links added" — an unfilled field on a drawing. Dashed means nothing is entered here yet and nothing has to be.
- **Loading is a skeleton of the real page** — tick, title, chip row, plate, ruled panel, sheet — not a centered "Loading product..." line.
- The reviews list is the shared `SubjectReviewsSection` sheet, unchanged. The title block sits 64px below the plate and 48px above it.

### Floating Action Button (FAB)

Round button (`h-12 w-12 rounded-full`) fixed to the bottom-right of the screen for primary in-context actions (Preview in template studio). It floats over content, so it takes the overlay shadow (`0 8px 24px rgba(15,23,42,.10)`). Action colour in light, primary sky in dark. Do not use for page-level navigation.

### Assessment / Survey UI

Assessment is the multi-question scan and edit mode. It uses one grid below the app navigation: a template and pillar route rail beside a bounded workspace. The expanded rail owns template identity and pillar navigation. Keep template name, version, and status separate; inactive templates are real switches, not decorative buttons. Pillar names wrap, progress uses tabular numerals, and the active state combines text, tint, and a waypoint. When the rail is compact, pillar tabs replace the hidden navigation.

Each assessment row uses a stable 56px reference column and one flexible reading column. Question text is 17px regular, increasing to 18px at 1920px, and the row caps at 960px. Keep the information action beside the question and put answer controls directly below it on the same reading axis. Do not pin controls to the far edge of a wide row. A pillar header shows one answered/total summary, not a second percentage.

Yes, No, and N/A share one neutral selection recipe: solid when selected, outlined when unselected, with `aria-pressed` for state. No and N/A are not error states. An N/A row may use a quiet neutral background, but never fade or grayscale its text.

Checklist groups use a `fieldset` and screen-reader legend. Each item uses a native checkbox with an explicit label and a separate N/A button named with the item text. The item container itself is not interactive. A collapsed checklist row prioritises its progress and Expand action; whole-checklist N/A appears only after expansion, inside the checklist header. Disclosures expose `aria-expanded` and `aria-controls`; controls are siblings, never nested.

Survey is the one-question focus mode. Its question type scales from 34px to 44px at 1280px and 48px at 1536px. Do not reuse survey display type in assessment mode. Whole-question N/A stays inside the answer area: it is the third option beside Yes and No, or sits with the checklist instructions before the item list. Below `xl`, Question information uses a bounded slideover with the question as context, 16px body copy, numbered practices, and three-item disclosure. Wider survey views keep the teaching rail beside the question.

### Review maturity and Follow-ups

**Review Details is the ledger.** Maturity stays inside Breakdown for the active template. One inline line shows percentage, stage, and whether the result is settled or provisional. The existing pillar table owns the detailed comparison through one Maturity column. Its values open a viewport-contained popover with stage meaning and one confidence statement. Do not add score arithmetic, question weights, practice shares, another card, or another assessment action. Below `sm`, template tabs become one full-width labeled selector. Milestones and Recent Changes keep their established behavior.

**Review Follow-ups is a work queue and handoff composer.** A labeled template selector and compact result line establish scope. Needs attention groups recorded gaps by source-question severity, Critical then High then Medium. Authored stage placement remains muted row context and never controls grouping or priority. Unanswered questions appear once in a separate non-selectable section. N/A evidence stays absent. More information keeps question guidance in context and offers the exact assessment link.

At desktop widths, the queue sits beside a sticky in-page Handoff composer. The composer keeps selected work in visible delivery order and exposes keyboard or pointer reorder, optional notes, removal, copy, and one existing-ticket association. At narrow widths, one two-view switch moves between Needs attention and `Handoff {n}`. Never use a fixed bottom bar, duplicate practice list, maturity-stage explorer, or draft slideover in this journey. Selection, order, notes, and copy remain local when sync is degraded; ticket association waits until duplicate checking is available.

### Progress History Chart

Line chart with circular data-point markers in Index sky (`#0284C7` light; sky-400/500 in dark — violet is retired). Appears on the Review Details page below the pillar breakdown table. Axes: date (x), completion % (y). Chart sits on the canvas.

### Recent Changes Feed

The Recent Changes feed on the Review Details page shows field-level answer changes from all participants. It reads from the local `field_version_events` SQLite table and cross-references the outbox to surface sync conflict state (e.g., the "Overridden" badge when a local write was rejected because another actor's change won). The configured local window is 14 days; `sweepLocalTTL()` permanently removes older rows without archiving them when invoked. Automatic startup or post-sync invocation is not currently wired, so enforcing that window remains a known runtime gap.

**What is a "field change"?** Each question has a single `answer` field tracked by the sync engine. For Yes/No questions, the answer field holds a string (`"yes"`, `"no"`, `"na"`). For checklist questions, the answer field holds the entire checklist state as one JSON object (`{checked: ["item-1", "item-3"], na: ["item-2"]}`). Checking or unchecking one item produces a new entry for the whole checklist answer — individual checklist items are not separate fields. The per-item diff displayed in the UI is computed at render time by comparing the previous and current JSON states.

**Terminology:**

- **Entry** — one row in the Recent Changes feed, representing a single field change by one actor at one point in time. Each answer modification that occurs more than 5 seconds after the previous one produces a separate entry. This is intentional: entries are bounded operational edit history, not a current-state view or permanent compliance audit evidence.
- **Intermediate trail** — when rapid clicks by the same actor on the same field occur within 5 seconds, they are collapsed into a single entry. The individual changes within that burst are preserved as the intermediate trail, visible in the UI for checklist questions (showing which items were toggled in what order).

**One entry per change, not one entry per field.** If a user changes the same answer three times over several minutes, Recent Changes shows three entries — one per change. This provides complete operational history within the retained window. The `previousValue → currentValue` diff on each entry shows that specific transition.

**Answer cells** use a `prev → curr` format with directional color:

| Answer type | Display | Example |
|-------------|---------|---------|
| Yes/No/N/A (first answer) | `new → Yes` | dimmed "new", green "Yes" |
| Yes/No/N/A (changed) | `No → Yes` | dimmed "No", green "Yes" |
| Checklist (first answer) | `new → 3/5` | dimmed "new", green fraction |
| Checklist (count changed) | `1/5 → 3/5` | dimmed prev, green/red curr |
| Checklist (items swapped) | `2/5 → 2/5` | popover shows +1/−1 item diff |

Checklist cells are clickable — a popover shows the full checklist with per-item diff badges (`checked` in green, `unchecked` in red). Checked items always get green bordered cards (`border-success/40 bg-success/5`) even without a diff, so the current state is always scannable.

**5-second editing window (write-side baseline, read-side grouping).** The `previousValue` column (local-only, never synced) captures the "before" state for diffs. Rapid edits by the **same actor** within 5 seconds preserve the state before the first click as their shared baseline. The individual history rows remain stored and are grouped into one displayed burst by `groupRecentChangeEntries()`. After 5 seconds of inactivity, the next write starts a new entry. Cross-actor changes always capture a fresh "before" regardless of timing. Baseline selection is enforced by `computePreviousValue()` in `services/sync/inbound/helpers.ts`; presentation grouping is enforced by `groupRecentChangeEntries()` in `composables/sync/fieldVersionChangeFeed.ts`.

**Checklist write-side deduplication.** For checklist questions, rapid toggling that results in the same final JSON state (e.g., check→uncheck→check the same item) produces no new entry — `areJsonFieldValuesEqual()` detects that the value hasn't changed and skips the insert entirely.

**Row animation.** New rows added via "Load more" fade in with `opacity 0→1` over 200ms. No `translateY` — it causes border flash artifacts with `divide-y` table layouts.

## Language

- **"Follow-ups" replaces "Improvement Plan"** as the UI label. The deeper rename (routes, code, domain model) is a separate future change.
- Sentence case throughout — labels, buttons, menu options, table headers.
- The non-judgment stance is structural: **"A 'No' isn't a failure — it's a signal."** Copy and styling must never make an answer feel like a grade.
- Copy style: simplified technical language. Short sentences. No walls of text.
- Avoid launch-only framing — templates set the bar for anything: a launch, a process, an engineering baseline.

## Motifs

The illustration language is cartography — journeys across terrain, not climbs up a mountain.

- **Journey line:** the logo's sky→green gradient line.
- **Compass rose:** the shell hero.
- **Route map:** a top-down dotted route through contour fields with waypoints and a green destination ring (shell "how it connects").
- **Progress track:** a flat track with a waypoint circle (survey mode).
- **Survey plate:** the StatStrip's chart-paper ground — a graticule, an edge-cropped compass rose, and a dotted route made literal as a drafted instrument backdrop (see Stat Strip — the Surveyor's Plate).

**Never ascending elevation profiles or mountain-climb charts.** An ascent chart reads as a performance grade and evokes being judged. Contours and routes are the only texture, at most ~4% ink.

## Shell Page

The shell is the front door — unauthenticated visitors land here, and signed-in teammates can revisit it via the sidebar logo. Light theme, white canvas, no product chrome.

1. **Nav:** logo + Docs + auth-aware CTA ("Continue with Okta" signed out, "Go to Teams" signed in — the landing stays reachable as the concept page), drafted-outline construction (see Buttons)
2. **Hero:** compass rose motif — survives down to `lg`, scaled ~0.8 and pulled toward the corner below `xl` so it never collides with the headline (`max-w-[660px]`) — plus a handful of aria-hidden graticule crosses scattered in the upper-right air (same vocabulary as the route map's crosses); headline "Every "ready" has blind spots.", a one-sentence breadth sub-line, the one solid CTA on the page + "How it connects" anchor, one meta line with drafted tick separators (`│`, not middots) between its three phrases when signed out
3. **"How the pieces connect":** route map + 01–04 Define / Review / Learn / Act columns — each carries its persona's substance (author / run / advise) in one or two sentences plus one signal line ("Start with one pillar." / "A "No" isn't a failure — it's a signal." / "Teaching, not grading." / "Follow-ups, not blame."). The flowline's `→` glyphs pick up the index ink; the words stay muted. One story, told once — no separate personas section.
4. **Footer:** dark ink, with exactly one local-first sentence: "Work saves to this device first and syncs in the background. Offline is fine — nothing is lost."

No sync jargon, no SQLite/WASM talk on the front door.

## Sync Cursor & Bootstrap

The local-first sync engine uses a **composite cursor** to track which server events have already been pulled into the local SQLite database. The cursor format is `RFC3339Nano:EventUUID` (e.g. `2026-01-01T12:00:00.123456789Z:evt-abc-123`).

### Cursor as a stream pointer

Think of the server's event log as a time-ordered stream. The cursor is a pointer that slides forward as the client pulls events:

```text
Server event stream (time →)
  ├─ evt-1  2026-01-01T10:00:00Z
  ├─ evt-2  2026-01-01T10:00:01Z
  ├─ evt-3  2026-01-01T10:00:02Z  ← cursor (already pulled)
  ├─ evt-4  2026-01-01T10:00:03Z  ← next pull returns this
  └─ evt-5  2026-01-01T10:00:04Z

Client pull: GET /api/sync/pull?after=2026-01-01T10:00:02Z:evt-3
              → returns [evt-4, evt-5]
              → cursor advances to "2026-01-01T10:00:04Z:evt-5"
```

The composite format (`time:id`) prevents a pagination boundary bug: two events with the same timestamp would be skipped if the cursor only tracked time. The tuple comparison `(time, id) > ($1, $2)` in PostgreSQL ensures no event is lost or duplicated.

### Two cursors, two purposes

| Cursor | Stored in | Purpose | Who advances |
|--------|-----------|---------|-------------|
| `localCursor` | `sync_cursors.local` | Push deduplication marker — tracks which outbox items the server has already accepted | `pushChanges()` after a successful push |
| `remoteCursor` | `sync_cursors.remote` | Pull window — tracks how far the client has read from the server event stream | `pullChanges()` after a successful pull |

### Bootstrap lifecycle

On first load (or after `clearLocalData()`), the client runs `bootstrap()`:

1. **Entitlements** — fetches the actor's access snapshot from the server and caches it in SQLite (`entitlement_snapshots`). Static in Phase 1; refreshed on tab focus in Phase 4.
2. **Local cursor only** — the server returns a `local` cursor (push deduplication) but **not** a `remote` cursor. The client saves `localCursor` and sets `remoteCursor = null`.
3. **First pull fetches everything** — because `remoteCursor` is `null`, the next `pullChanges()` omits the `after` parameter, causing the server to return the full event stream from the beginning.
4. **Subsequent pulls are incremental** — `pullChanges()` now has a real `remoteCursor`, so it only asks for events newer than the last pull.

```text
Clear local DB → reload
  │
  ▼
Bootstrap: entitlements cached, localCursor saved, remoteCursor = null
  │
  ▼
First pull: GET /api/sync/pull?after=          ← empty = "give me everything"
  │
  ▼
Server returns events [evt-1 ... evt-N]
  │
  ▼
Cursor saved: remoteCursor = "time-of-evt-N:id-of-evt-N"
  │
  ▼
Next pull: GET /api/sync/pull?after=remoteCursor  ← incremental
```

### Why bootstrap must NOT inherit the server's remoteCursor

The server stores a cursor in its own `sync_cursors` table, but that cursor tracks the **server's view** of the client's position — which may be stale if the client was offline or has since cleared its database. If bootstrap copied the server's remoteCursor, a fresh client would start pulling from the middle of the stream and miss earlier events, leaving Teams, Products, and Reviews empty until the next server-side change.

### Cursor reset scenarios

| Scenario | What happens | Cursor state after |
|----------|-----------|-------------------|
| `clearLocalData()` + reload | Entitlements re-cached, remoteCursor = null | Full re-pull on first sync |
| `make watch` reseed | Server events recreated; client SQLite wiped by OPFS clear | Same as above |
| Page reload (normal) | Entitlements cache hit → bootstrap skipped; existing cursor used | Incremental pull continues |
| New device/browser | First-time bootstrap; remoteCursor = null | Full re-pull |

## Motion

- Micro-interactions (hover, focus): 150ms ease
- Content transitions (page changes, expand/collapse): 200–300ms ease-out
- Progress bar fills: `transition-all duration-500` for animated completions
- Dragging: instant (no transition while dragging, snap on drop)

All interactive elements need `transition-colors duration-150` at minimum. Hover states must be clearly visible — use alpha tints (`hover:bg-black/[0.03] dark:hover:bg-white/[0.04]`) on rows and clickable areas. Never add a shadow on hover; there are no resting shadows.

**Entrance reveal** (shell hero, scroll-triggered sections): `opacity 0→1`, `translateY 12px→0`, `blur(5px)→blur(0)`, 700ms `cubic-bezier(0.22, 1, 0.36, 1)`. Animate only `transform`, `opacity`, and `filter` — never layout properties.

**Progressive disclosure:** elements within a group stagger ~120ms apart (hero dash → headline → sub → CTA → meta; journey/way columns cascade left to right). One recipe, one curve — do not introduce a second easing function for reveals.

**Scroll-triggered, once:** sections below the fold arm via `useRevealOnce()` (`IntersectionObserver`) and reveal a single time when they cross into view. The composable takes an options object (`{ threshold, rootMargin }`, both optional, default `0.25` / `"0px"` — unchanged for existing callers); the shell's two below-fold sections pass `rootMargin: "0px 0px -20% 0px"` so a section has to scroll 20% up from the viewport's bottom edge before it fires, instead of the instant its first pixel appears. Motion never re-triggers scrolling back up. On the landing shell those sections rest as a ghost, not hidden: `opacity 0.45`, `blur(4px)`, 10px low — readable as words but clearly out of focus (depth-of-field, never fog), sharpening into place on reveal via `landing-sharpen`. The blur is tuned to the narrow band where it reads as intent: heavier smears into a rendering artifact, lighter gives the content away and the sharpen loses its payoff.

**Wayfinding beats** — the only two on-load/on-scroll set pieces, each fires once:

- Compass needle settles on load: 1500ms `ease-out`, with overshoot (rotates past rest, eases back).
- Route draws on scroll: a mask wipe over ~1100ms `cubic-bezier(0.22, 1, 0.36, 1)`, waypoints appearing as the wipe reaches them (275/495/825/1100ms), ending in one destination pulse.

**Journey columns get one progressive-enhancement exception to "never scrubbed":** where `@supports (animation-timeline: view())` is true, the four "How the pieces connect" columns swap their fixed post-reveal time stagger for `animation-timeline: view()` / `animation-range: entry 10% entry 45%`, so each column enters as it actually scrolls into view rather than all at once on a timer. Browsers without support keep the plain time-staggered reveal; either way the columns stay gated behind `.motion-armed .is-in` so SSR/no-JS renders them visible, and `prefers-reduced-motion` neutralizes both variants. This is the one place scroll position drives animation progress — everywhere else, motion still never ties to scroll position.

**Stillness after settle.** Nothing loops. Once the entrance and wayfinding beats finish, the page is completely still — no ambient motion, no idle pulsing, no infinite animation anywhere.

**`prefers-reduced-motion: reduce` is a hard requirement.** It must render the fully-settled page — final opacity, position, no blur — with every animation and transition disabled. Every new motion addition needs a reduced-motion override.

**Hidden states arm only after hydration.** Entrance states (`opacity: 0`, etc.) live behind an `armed`/`motion-armed` class set in `onMounted()`, never in the initial template. SSR output, no-JS, and the pre-hydration frame must always render fully visible content.

## Follow-ups

- Survey mode does not yet persist answers — the visual pass kept the in-progress copy accurate instead of implying a save that doesn't happen yet.
- Y/N keyboard shortcuts don't exist yet — the kbd hint chips are deferred until the shortcuts themselves ship.
- Post-auth "resume last location" is a cheap future win — land the user back where they left off instead of always the dashboard.
