<template>
  <!-- StatStrip always renders the "surveyor's plate": a chart-paper band
       (warm cream ground, ink top rule, deeper-warm bottom edge, inset
       neatline) with a survey-engraving backdrop behind the stats row only —
       never behind anything else on the page. There is no other look; this
       is the one and only StatStrip treatment. -->
  <div
    ref="rootRef"
    class="stat-strip border-t-inverted dark:border-default dark:bg-primary/10 relative overflow-hidden rounded-lg border border-t-2 border-[#E8E3D9] border-b-[#DBD4C4] bg-[#F9F7F2] px-9 py-8"
  >
    <svg
      class="stat-strip__engraving text-primary-600 dark:text-primary-400 pointer-events-none absolute inset-0 z-0 h-full w-full"
      :class="{ armed, 'is-in': revealed }"
      viewBox="0 0 1200 160"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <!-- Horizontal fade: a whisper (~35% line visibility) at the left
             edge ramping to full strength by ~55% width, so the field reads
             as one continuous plate — never hard-cut to nothing — while the
             numeral zone on the left stays quiet. -->
        <linearGradient :id="hFadeId" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#595959" />
          <stop offset="55%" stop-color="#fff" />
          <stop offset="100%" stop-color="#fff" />
        </linearGradient>
        <mask :id="hMaskId" maskUnits="objectBoundingBox">
          <rect width="1200" height="160" :fill="`url(#${hFadeId})`" />
        </mask>
        <!-- Route reveal mask: a plain rect that scales in from the left
             edge (CSS transform, not stroke-dashoffset — dashoffset on a
             dotted stroke reflows the dash pattern itself as it animates,
             which reads as flickering, not drawing). Spans the full plate
             width like LandingRouteMap's own wipe, so the route (which only
             occupies the lower-right quadrant) draws in at the correct
             relative pace. -->
        <mask :id="routeMaskId">
          <rect
            x="0"
            y="0"
            width="1200"
            height="160"
            fill="white"
            class="route-wipe"
          />
        </mask>
      </defs>
      <g :mask="`url(#${hMaskId})`">
        <!-- Graticule — a plain lat/long-style grid of + crosses, the
             calmest, most geometric texture a chart carries. Real charts
             print the grid under everything, including labels, so it's
             allowed to sit behind the numeral zone; at 0.12/0.09 it reads at
             page scale without fighting the type. Zero organic wobble
             anywhere in this composition — that's what read as wood grain
             before. Arrives with the plate itself — no extra choreography. -->
        <path
          :d="GRATICULE_PATH"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          :class="GRATICULE_CLASS"
        />

        <!-- Compass rose — edge-cropped at the plate's top-right corner
             (center sits just outside it, ~x=1215/y=-8 in the 1200x160
             viewBox) so only a wedge shows, like a window into a larger
             chart sheet. A fully-visible rose reads as a sticker; this crop
             reads as an instrument. Drafted geometry throughout: plain
             circles, radial ticks/spokes, no baked organic curves. Tiered
             opacity carries the hierarchy: inner circles + ticks quietest,
             spokes mid, the outer ring joins the needle as the boldest pair
             — the "instrument" reading, not a flat sticker. -->
        <circle
          v-for="(r, i) in ROSE_INNER_RADII"
          :key="`rose-circle-${i}`"
          :cx="ROSE_CX"
          :cy="ROSE_CY"
          :r="r"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          :class="ROSE_WEAK_CLASS"
        />
        <circle
          :cx="ROSE_CX"
          :cy="ROSE_CY"
          :r="ROSE_OUTER_RADIUS"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          :class="ROSE_BOLD_CLASS"
        />
        <!-- Degree ticks every 6° around the outer circle — SVG's own
             viewBox clip does the "in-plate portion only" work. -->
        <path
          :d="ROSE_TICKS_PATH"
          stroke="currentColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          :class="ROSE_WEAK_CLASS"
        />
        <!-- 8 radial spokes at the compass points; only one clears the
             corner crop with any length, exactly as a real edge-cropped
             instrument would. -->
        <path
          :d="ROSE_SPOKES_PATH"
          stroke="currentColor"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
          :class="ROSE_MID_CLASS"
        />
        <!-- The needle diamond — the rose's "jewel", boldest weight in the
             composition and the plate's one warm accent: real compass roses
             mark north in red, ours takes a quieter amber (the warning
             family's ink). Points NE (mostly off-canvas, authentic to a real
             rose); the SW tail is deliberately elongated so it clears the
             container's own aspect-ratio crop and actually reads. Two nested
             groups: the outer is the settle-animation's fade+scale wrapper
             (kept separate from the inner color/opacity tier so the two
             compose multiplicatively — see the style block); a rotation
             settle was tried first (matching LandingCompassRose exactly) but
             measured out: because only a thin edge-cropped sliver of the
             needle is ever on-canvas, swinging it through the recipe's full
             -140° start rotates that sliver clean off the plate for most of
             the animation, so it reads as "needle vanishes, then pops in"
             rather than settling. Fade+scale from the needle's own center is
             the documented fallback for exactly this situation. -->
        <g class="compass-needle-plate">
          <g :class="ROSE_NEEDLE_CLASS">
            <path
              :d="ROSE_NEEDLE_PATH"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          </g>
        </g>

        <!-- Route — the dotted route-map vocabulary (LandingRouteMap),
             quoted here confined to the lower-right quadrant, entering at
             ~45%/78% and ending at a small unfilled destination ring at
             ~93%/62% — never under the first two columns' numerals. The
             line + waypoints stay index blue; the destination ring alone
             takes the plate's other accent, a confirm green, echoing the
             landing route map's own arrival ring and the pillar-complete
             bars. Opacity/color live per-element (never on a wrapping <g>)
             so tiers never multiply against each other or the horizontal
             mask. -->
        <path
          :d="ROUTE_PATH"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-dasharray="1 6"
          vector-effect="non-scaling-stroke"
          :mask="`url(#${routeMaskId})`"
          :class="ROUTE_CLASS"
        />
        <g
          v-for="(pt, i) in ROUTE_WAYPOINTS"
          :key="`route-waypoint-${i}`"
          :class="['route-waypoint', `route-waypoint-${i}`]"
        >
          <circle
            :cx="pt[0]"
            :cy="pt[1]"
            r="1.5"
            fill="currentColor"
            :class="ROUTE_CLASS"
          />
        </g>
        <g class="route-destination">
          <circle
            :cx="ROUTE_DESTINATION[0]"
            :cy="ROUTE_DESTINATION[1]"
            r="4"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
            :class="ROUTE_DESTINATION_CLASS"
          />
        </g>
      </g>
    </svg>

    <!-- Neatline — a second, inner hairline frame inset from the plate edge:
         the drafted-map-frame cue. Content padding (px-9 py-8) already
         clears it. -->
    <div
      class="pointer-events-none absolute inset-[6px] z-[1] rounded-[4px] border border-[#E3DDD0] dark:border-white/[0.08]"
      aria-hidden="true"
    />

    <!-- Default (stretch) alignment, not items-end: content flows from the top,
         so blocks share the label line and — since every label+numeral stack is
         the same height — the numerals share a baseline too, while extras
         (route line, sub-labels) hang below. Stretch also keeps every scale
         tick's hanging point fixed relative to the top rule regardless of a
         block's own content height. -->
    <div
      class="stat-strip__row relative z-10 grid gap-x-0 gap-y-8"
      :class="layoutClass"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Composes StatBlock instances into one instrument panel: hairline vertical
// separators between blocks that sit side by side, only at the breakpoint
// where they actually do — never across a wrapped row. Each `layout` maps to
// the responsive grid-column pattern already in use at its call sites.
type StripLayout = "quad" | "quad-stacked" | "triple";

interface Props {
  layout: StripLayout;
}

const props = defineProps<Props>();

// Unique per-instance mask/gradient ids — more than one StatStrip can render
// on a page (e.g. a future dashboard with two strips), and SVG `url(#id)`
// references must not collide across instances.
const uid = useId();
const hFadeId = `stat-strip-hfade-${uid}`;
const hMaskId = `stat-strip-hmask-${uid}`;
const routeMaskId = `stat-strip-routemask-${uid}`;

// The plate comes alive once: armed after mount (so SSR/no-JS/pre-hydration
// always render the fully-settled plate), then the route draw + needle
// settle play the first time the strip crosses into view. Mirrors
// StatBlock's own armed/revealed pair exactly.
const rootRef = ref<HTMLElement | null>(null);
const armed = ref(false);
const revealed = useRevealOnce(rootRef);

onMounted(() => {
  armed.value = true;
});

// Engraving opacity/color tiers — applied per-element (not on a wrapping <g>)
// so tiers never multiply against each other or against the horizontal mask.
// Presence pass (v4): every tier lifted one notch so the plate reads as a
// printed chart at page scale, not a watermark that only rewards zooming —
// numerals stay unmistakably loudest throughout. Two-ink printing (v4): the
// needle and the destination ring each take one accent from the existing
// warning/success families — three inks total (index blue, warm amber,
// confirm green), no new hues.
const GRATICULE_CLASS = "opacity-[0.12] dark:opacity-[0.09]";
const ROSE_WEAK_CLASS = "opacity-[0.12] dark:opacity-[0.09]"; // inner circles + degree ticks
const ROSE_MID_CLASS = "opacity-[0.18] dark:opacity-[0.14]"; // spokes
const ROSE_BOLD_CLASS = "opacity-[0.26] dark:opacity-[0.20]"; // outer circle — strongest blue element
const ROSE_NEEDLE_CLASS = "text-warning opacity-[0.38] dark:opacity-[0.30]"; // the rose's jewel — warm amber ink, north's quiet accent
const ROUTE_CLASS = "opacity-[0.22] dark:opacity-[0.16]"; // route line + waypoints — index blue
const ROUTE_DESTINATION_CLASS =
  "text-success opacity-[0.38] dark:opacity-[0.30]"; // arrival — confirm green ink

// Divider technique: no shared `gap-x` — every non-first-in-row block gets a
// scale tick (a short vertical mark hanging from the plate's ink top rule,
// through the top of its own py-8 padding) at the breakpoint it starts
// sitting beside a neighbour, so the 36px rhythm comes entirely from that
// `pl-9` padding and never doubles up with a grid gap. No full-height
// dividers — those read as table borders on the chart-paper ground; a
// hanging tick reads as a measuring instrument instead. Written as literal
// strings so Tailwind's scanner picks up every class.
const LAYOUT_CLASSES: Record<StripLayout, string> = {
  // 2 cols -> 4 cols: tick on the 2nd/4th always; the 3rd only joins a row
  // (and gets its tick) once we're at 4 columns.
  quad: [
    "grid-cols-2 lg:grid-cols-4",
    "[&>*:nth-child(even)]:relative [&>*:nth-child(even)]:pl-9 [&>*:nth-child(even)]:before:absolute [&>*:nth-child(even)]:before:left-0 [&>*:nth-child(even)]:before:-top-[32px] [&>*:nth-child(even)]:before:h-2.5 [&>*:nth-child(even)]:before:w-px [&>*:nth-child(even)]:before:bg-[#0F172A]/30 [&>*:nth-child(even)]:before:content-[''] dark:[&>*:nth-child(even)]:before:bg-white/35",
    "lg:[&>*:nth-child(3)]:relative lg:[&>*:nth-child(3)]:pl-9 lg:[&>*:nth-child(3)]:before:absolute lg:[&>*:nth-child(3)]:before:left-0 lg:[&>*:nth-child(3)]:before:-top-[32px] lg:[&>*:nth-child(3)]:before:h-2.5 lg:[&>*:nth-child(3)]:before:w-px lg:[&>*:nth-child(3)]:before:bg-[#0F172A]/30 lg:[&>*:nth-child(3)]:before:content-[''] lg:dark:[&>*:nth-child(3)]:before:bg-white/35",
  ].join(" "),
  // Stacked on mobile (no ticks while single-column) -> 2 cols -> 4 cols.
  "quad-stacked": [
    "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    "sm:[&>*:nth-child(even)]:relative sm:[&>*:nth-child(even)]:pl-9 sm:[&>*:nth-child(even)]:before:absolute sm:[&>*:nth-child(even)]:before:left-0 sm:[&>*:nth-child(even)]:before:-top-[32px] sm:[&>*:nth-child(even)]:before:h-2.5 sm:[&>*:nth-child(even)]:before:w-px sm:[&>*:nth-child(even)]:before:bg-[#0F172A]/30 sm:[&>*:nth-child(even)]:before:content-[''] sm:dark:[&>*:nth-child(even)]:before:bg-white/35",
    "lg:[&>*:nth-child(3)]:relative lg:[&>*:nth-child(3)]:pl-9 lg:[&>*:nth-child(3)]:before:absolute lg:[&>*:nth-child(3)]:before:left-0 lg:[&>*:nth-child(3)]:before:-top-[32px] lg:[&>*:nth-child(3)]:before:h-2.5 lg:[&>*:nth-child(3)]:before:w-px lg:[&>*:nth-child(3)]:before:bg-[#0F172A]/30 lg:[&>*:nth-child(3)]:before:content-[''] lg:dark:[&>*:nth-child(3)]:before:bg-white/35",
  ].join(" "),
  // Stacked on mobile -> always exactly one row of 3 from sm up, so every
  // non-first block gets the tick at once.
  triple: [
    "grid-cols-1 sm:grid-cols-3",
    "sm:[&>*:not(:first-child)]:relative sm:[&>*:not(:first-child)]:pl-9 sm:[&>*:not(:first-child)]:before:absolute sm:[&>*:not(:first-child)]:before:left-0 sm:[&>*:not(:first-child)]:before:-top-[32px] sm:[&>*:not(:first-child)]:before:h-2.5 sm:[&>*:not(:first-child)]:before:w-px sm:[&>*:not(:first-child)]:before:bg-[#0F172A]/30 sm:[&>*:not(:first-child)]:before:content-[''] sm:dark:[&>*:not(:first-child)]:before:bg-white/35",
  ].join(" "),
};

const layoutClass = computed(() => LAYOUT_CLASSES[props.layout]);

// ---------------------------------------------------------------------------
// The engraving (v4) — drafted chart geometry, not generated organic
// texture. v1/v2 both baked ring/terrain shapes from wobbled-ellipse splines;
// at page scale those read as wood grain (wavy lines) and knots (fully-
// visible ring blobs) instead of a survey chart. v3 settled on the geometry
// a real chart is actually made of: a plain grid, circles/radial lines, and
// a dashed route. v4 keeps that composition exactly and adds three things:
// a page-scale-visible presence pass (opacity tiers lifted a notch, see the
// *_CLASS constants above), two-ink printing (the needle and destination
// ring each borrow one accent from the warning/success families), and a
// one-time reveal choreography (route mask-wipe + needle settle, see the
// armed/revealed refs above and the <style> block below) — the plate comes
// alive once, then holds still. Coordinates live in a 1200×160 viewBox;
// `preserveAspectRatio="xMaxYMid slice"` keeps the right-weighted
// composition anchored to the right edge as the strip's own aspect ratio
// changes across breakpoints.
//
// 1. Graticule — a regular 12x3 grid of "+" crosses (4px arms), ~100x52
// unit spacing, offset half a step from every edge so no cross hugs the
// plate border. One combined path (36 crosses, each a pair of M/L strokes).
const GRATICULE_PATH =
  "M 48,26 L 52,26 M 50,24 L 50,28 M 148,26 L 152,26 M 150,24 L 150,28 M 248,26 L 252,26 M 250,24 L 250,28 M 348,26 L 352,26 M 350,24 L 350,28 M 448,26 L 452,26 M 450,24 L 450,28 M 548,26 L 552,26 M 550,24 L 550,28 M 648,26 L 652,26 M 650,24 L 650,28 M 748,26 L 752,26 M 750,24 L 750,28 M 848,26 L 852,26 M 850,24 L 850,28 M 948,26 L 952,26 M 950,24 L 950,28 M 1048,26 L 1052,26 M 1050,24 L 1050,28 M 1148,26 L 1152,26 M 1150,24 L 1150,28 M 48,78 L 52,78 M 50,76 L 50,80 M 148,78 L 152,78 M 150,76 L 150,80 M 248,78 L 252,78 M 250,76 L 250,80 M 348,78 L 352,78 M 350,76 L 350,80 M 448,78 L 452,78 M 450,76 L 450,80 M 548,78 L 552,78 M 550,76 L 550,80 M 648,78 L 652,78 M 650,76 L 650,80 M 748,78 L 752,78 M 750,76 L 750,80 M 848,78 L 852,78 M 850,76 L 850,80 M 948,78 L 952,78 M 950,76 L 950,80 M 1048,78 L 1052,78 M 1050,76 L 1050,80 M 1148,78 L 1152,78 M 1150,76 L 1150,80 M 48,130 L 52,130 M 50,128 L 50,132 M 148,130 L 152,130 M 150,128 L 150,132 M 248,130 L 252,130 M 250,128 L 250,132 M 348,130 L 352,130 M 350,128 L 350,132 M 448,130 L 452,130 M 450,128 L 450,132 M 548,130 L 552,130 M 550,128 L 550,132 M 648,130 L 652,130 M 650,128 L 650,132 M 748,130 L 752,130 M 750,128 L 750,132 M 848,130 L 852,130 M 850,128 L 850,132 M 948,130 L 952,130 M 950,128 L 950,132 M 1048,130 L 1052,130 M 1050,128 L 1050,132 M 1148,130 L 1152,130 M 1150,128 L 1150,132";

// 2. Compass rose — edge-cropped at the top-right corner: center sits just
// outside the plate so only a wedge shows (see template comment). 3 plain
// concentric circles, 60 degree ticks every 6° around the outer one, 8
// radial spokes at the compass points, and one needle diamond along the
// NE<->SW axis. Every element is drawn in full (the ring, the full spoke,
// the full needle) and relies entirely on the SVG viewBox's own clip to
// show only the in-plate portion — no manual arc/segment trimming.
const ROSE_CX = 1215;
const ROSE_CY = -8;
const ROSE_INNER_RADII = [48, 78];
const ROSE_OUTER_RADIUS = 108;
const ROSE_TICKS_PATH =
  "M 1321,-8 L 1325,-8 M 1320.42,3.08 L 1324.4,3.5 M 1318.68,14.04 L 1322.6,14.87 M 1315.81,24.76 L 1319.62,25.99 M 1311.84,35.11 L 1315.49,36.74 M 1306.8,45 L 1310.26,47 M 1300.76,54.31 L 1303.99,56.66 M 1293.77,62.93 L 1296.75,65.6 M 1285.93,70.77 L 1288.6,73.75 M 1277.31,77.76 L 1279.66,80.99 M 1268,83.8 L 1270,87.26 M 1258.11,88.84 L 1259.74,92.49 M 1247.76,92.81 L 1248.99,96.62 M 1237.04,95.68 L 1237.87,99.6 M 1226.08,97.42 L 1226.5,101.4 M 1215,98 L 1215,102 M 1203.92,97.42 L 1203.5,101.4 M 1192.96,95.68 L 1192.13,99.6 M 1182.24,92.81 L 1181.01,96.62 M 1171.89,88.84 L 1170.26,92.49 M 1162,83.8 L 1160,87.26 M 1152.69,77.76 L 1150.34,80.99 M 1144.07,70.77 L 1141.4,73.75 M 1136.23,62.93 L 1133.25,65.6 M 1129.24,54.31 L 1126.01,56.66 M 1123.2,45 L 1119.74,47 M 1118.16,35.11 L 1114.51,36.74 M 1114.19,24.76 L 1110.38,25.99 M 1111.32,14.04 L 1107.4,14.87 M 1109.58,3.08 L 1105.6,3.5 M 1109,-8 L 1105,-8 M 1109.58,-19.08 L 1105.6,-19.5 M 1111.32,-30.04 L 1107.4,-30.87 M 1114.19,-40.76 L 1110.38,-41.99 M 1118.16,-51.11 L 1114.51,-52.74 M 1123.2,-61 L 1119.74,-63 M 1129.24,-70.31 L 1126.01,-72.66 M 1136.23,-78.93 L 1133.25,-81.6 M 1144.07,-86.77 L 1141.4,-89.75 M 1152.69,-93.76 L 1150.34,-96.99 M 1162,-99.8 L 1160,-103.26 M 1171.89,-104.84 L 1170.26,-108.49 M 1182.24,-108.81 L 1181.01,-112.62 M 1192.96,-111.68 L 1192.13,-115.6 M 1203.92,-113.42 L 1203.5,-117.4 M 1215,-114 L 1215,-118 M 1226.08,-113.42 L 1226.5,-117.4 M 1237.04,-111.68 L 1237.87,-115.6 M 1247.76,-108.81 L 1248.99,-112.62 M 1258.11,-104.84 L 1259.74,-108.49 M 1268,-99.8 L 1270,-103.26 M 1277.31,-93.76 L 1279.66,-96.99 M 1285.93,-86.77 L 1288.6,-89.75 M 1293.77,-78.93 L 1296.75,-81.6 M 1300.76,-70.31 L 1303.99,-72.66 M 1306.8,-61 L 1310.26,-63 M 1311.84,-51.11 L 1315.49,-52.74 M 1315.81,-40.76 L 1319.62,-41.99 M 1318.68,-30.04 L 1322.6,-30.87 M 1320.42,-19.08 L 1324.4,-19.5";
const ROSE_SPOKES_PATH =
  "M 1230,-8 L 1323,-8 M 1225.61,2.61 L 1291.37,68.37 M 1215,7 L 1215,100 M 1204.39,2.61 L 1138.63,68.37 M 1200,-8 L 1107,-8 M 1204.39,-18.61 L 1138.63,-84.37 M 1215,-23 L 1215,-116 M 1225.61,-18.61 L 1291.37,-84.37";
const ROSE_NEEDLE_PATH =
  "M 1253.89,-46.89 L 1219.24,-3.76 L 1165.5,41.5 L 1210.76,-12.24 Z";

// 3. Route — one dotted line (the LandingRouteMap vocabulary), 3 waypoints,
// and a small unfilled destination ring, confined to the lower-right
// quadrant so it never crosses under the first two columns' numerals.
const ROUTE_PATH = "M 540,124.8 C 700,128 950,112 1116,99.2";
const ROUTE_WAYPOINTS: Array<[number, number]> = [
  [674.16, 123.95],
  [825.75, 118],
  [978.47, 109.05],
];
const ROUTE_DESTINATION: [number, number] = [1116, 99.2];
</script>

<style scoped>
/* The plate comes alive once (v4): the route mask-wipes in, its waypoints
   and destination ring pop in behind it, and the compass needle fades +
   scales into place — all on first scroll-reveal, then everything holds
   still. The route draw reuses LandingRouteMap.vue's mask-wipe recipe
   exactly; the needle diverges from LandingCompassRose.vue's rotation
   settle for a measured reason (see the template comment by the needle).
   Every "hidden" declaration below lives behind `.armed` so SSR, no-JS, and
   the pre-hydration frame always render the fully-settled plate (design
   law). */

.compass-needle-plate,
.route-waypoint,
.route-destination {
  transform-box: fill-box;
  transform-origin: center;
}

.route-wipe {
  transform-box: fill-box;
  transform-origin: 0% 50%;
}

.armed .route-wipe {
  transform: scaleX(0);
}

.armed .route-waypoint,
.armed .route-destination,
.armed .compass-needle-plate {
  opacity: 0;
}

/* Fade + scale from the needle's own center (never a rotation settle here —
   see the template comment: a full rotation swing carries this edge-cropped
   sliver off-canvas for most of the animation). Animates the wrapping <g>
   only, never the shape's own color/opacity tier nested inside it, so the
   two compose multiplicatively and the needle arrives at its correct
   resting faintness instead of snapping to a flat full opacity. */
.armed.is-in .compass-needle-plate {
  animation: stat-strip-needle-in 400ms cubic-bezier(0.22, 1, 0.36, 1) 350ms
    both;
}

.armed.is-in .route-wipe {
  animation: stat-strip-route-wipe 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.armed.is-in .route-waypoint-0 {
  animation: stat-strip-waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 210ms
    both;
}

.armed.is-in .route-waypoint-1 {
  animation: stat-strip-waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 445ms
    both;
}

.armed.is-in .route-waypoint-2 {
  animation: stat-strip-waypoint-in 300ms cubic-bezier(0.22, 1, 0.36, 1) 685ms
    both;
}

/* Arrival, after the draw completes: opacity + scale only (never part of
   the route-wipe mask) since it's a discrete "you've arrived" beat, not
   more line being drawn. */
.armed.is-in .route-destination {
  animation: stat-strip-destination-in 200ms cubic-bezier(0.22, 1, 0.36, 1)
    900ms both;
}

@keyframes stat-strip-needle-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes stat-strip-route-wipe {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* These opacity keyframes animate the wrapping <g>, not the shape's own
   opacity tier (set via Tailwind classes on the shape inside it) — the two
   compose multiplicatively, so the dot/ring fades in to its correct resting
   faintness (e.g. 0.22) rather than snapping to a flat 1. */
@keyframes stat-strip-waypoint-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes stat-strip-destination-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .armed .route-wipe,
  .armed.is-in .route-wipe {
    transform: none;
    animation: none;
  }

  .armed .route-waypoint,
  .armed .route-destination,
  .armed.is-in .route-waypoint-0,
  .armed.is-in .route-waypoint-1,
  .armed.is-in .route-waypoint-2,
  .armed.is-in .route-destination {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .armed .compass-needle-plate,
  .armed.is-in .compass-needle-plate {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>
