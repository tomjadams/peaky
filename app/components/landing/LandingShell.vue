<template>
  <div
    class="landing bg-default min-h-screen"
    :class="{ 'motion-armed': motionArmed }"
  >
    <!-- Nav -->
    <header
      class="flex h-[84px] items-center justify-between px-6 sm:px-12 xl:px-[120px]"
    >
      <div class="flex items-center gap-2.5">
        <PeakyLogo :size="30" />
        <span
          class="text-highlighted text-[21px] font-extrabold tracking-tight"
        >
          Peaky
        </span>
      </div>
      <div class="flex items-center gap-4 sm:gap-6">
        <a
          href="/docs/"
          class="text-muted hover:text-default hidden text-base font-semibold transition-colors sm:inline"
        >
          Docs
        </a>
        <!-- the landing page opts out of the app shell (layout: false), so it
             carries its own theme control -->
        <ThemeToggle />
        <button
          type="button"
          class="focus-visible:outline-primary inline-flex h-11 items-center justify-center rounded-[7px] border-[1.5px] border-[#CBD5E1] px-5 text-base font-semibold text-[#0f172a] transition-[color,background-color,border-color,transform] duration-150 hover:border-slate-400 hover:bg-[#F4F5F7] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[0.5px] dark:border-slate-600 dark:text-slate-100 dark:hover:border-slate-400 dark:hover:bg-white/[0.04]"
          @click="handleCta"
        >
          {{ signedIn ? "Go to Teams" : "Continue with Okta" }}
        </button>
      </div>
    </header>

    <!-- Hero -->
    <section class="relative px-6 pt-16 pb-16 sm:px-12 xl:px-[120px]">
      <div
        class="hero-dash bg-primary-600 dark:bg-primary-400 h-[5px] w-16 rounded-full"
        aria-hidden="true"
      />
      <h1
        class="hero-h1 text-highlighted mt-8 max-w-[660px] text-6xl leading-none font-extrabold tracking-[-0.025em] xl:text-[84px]"
      >
        Every “ready” has blind spots.
      </h1>
      <p class="hero-sub text-muted mt-6 max-w-[660px] text-xl leading-[1.6]">
        Templates set the bar — for a launch, a process, an engineering
        baseline. Teams assess against it, and gaps show up early.
      </p>
      <div class="hero-cta mt-10 flex flex-wrap items-center gap-6">
        <button
          type="button"
          class="focus-visible:outline-primary inline-flex h-12 items-center justify-center rounded-[7px] border-[1.5px] border-[#02507c] bg-[#0369A1] px-6 text-[17px] font-semibold text-white transition-[background-color,border-color,transform] duration-150 hover:bg-[#025e90] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[0.5px] dark:border-sky-300 dark:bg-sky-400 dark:text-[#082f49] dark:hover:bg-sky-300"
          @click="handleCta"
        >
          {{ signedIn ? "Go to Teams" : "Continue with Okta" }}
        </button>
        <a
          href="#how-it-connects"
          class="text-primary text-[17px] font-semibold"
        >
          How it connects ↓
        </a>
      </div>
      <p class="hero-meta text-dimmed mt-8 text-[15px]">
        <span v-if="signedIn">You're signed in.</span>
        <span v-else
          >Single sign-on
          <span
            class="mx-3 inline-block h-[10px] w-px bg-[#CBD5E1] align-middle dark:bg-slate-600"
            aria-hidden="true"
          ></span>
          works offline in your browser
          <span
            class="mx-3 inline-block h-[10px] w-px bg-[#CBD5E1] align-middle dark:bg-slate-600"
            aria-hidden="true"
          ></span>
          nothing to install</span
        >
      </p>
      <svg
        class="hero-air pointer-events-none absolute top-4 right-4 hidden h-[70px] w-[460px] lg:block"
        viewBox="0 0 460 70"
        fill="none"
        aria-hidden="true"
      >
        <g stroke-width="1.25">
          <path
            class="cross stroke-[#dde6ee] dark:stroke-slate-800"
            d="M203 22h14 M210 15v14"
          />
          <path
            class="cross stroke-[#dde6ee] dark:stroke-slate-800"
            d="M263 55h14 M270 48v14"
          />
          <path
            class="cross stroke-[#dde6ee] dark:stroke-slate-800"
            d="M323 18h14 M330 11v14"
          />
          <path
            class="cross stroke-[#dde6ee] dark:stroke-slate-800"
            d="M383 50h14 M390 43v14"
          />
          <path
            class="cross stroke-[#dde6ee] dark:stroke-slate-800"
            d="M433 28h14 M440 21v14"
          />
        </g>
      </svg>
      <LandingCompassRose
        class="hero-compass absolute hidden origin-top-right lg:top-[110px] lg:right-[28px] lg:block lg:scale-[0.72] xl:top-[100px] xl:right-[110px] xl:scale-100"
      />
    </section>

    <!-- How the pieces connect -->
    <section
      id="how-it-connects"
      ref="connectsSectionRef"
      class="px-6 pt-20 pb-20 sm:px-12 xl:px-[120px]"
      :class="{ 'is-in': connectsRevealed }"
    >
      <div class="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <div
            class="bg-primary-600 dark:bg-primary-400 mb-4 h-1 w-12 rounded-full"
            aria-hidden="true"
          />
          <h2
            class="text-highlighted text-[40px] font-extrabold tracking-[-0.015em]"
          >
            How the pieces connect
          </h2>
        </div>
        <p class="text-muted text-base font-semibold">
          Define <span class="text-sky-600 dark:text-sky-400">→</span> Review
          <span class="text-sky-600 dark:text-sky-400">→</span> Learn
          <span class="text-sky-600 dark:text-sky-400">→</span> Act
        </p>
      </div>

      <LandingRouteMap class="mt-10" :start="connectsRevealed" />

      <div class="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <!-- flex column so the signal line pins to a shared bottom line
             across all four columns, whatever each body's length — grid
             rows already stretch to equal height. -->
        <div
          v-for="step in journey"
          :key="step.numeral"
          class="journey-col flex flex-col"
        >
          <p
            class="text-[44px] leading-none font-extrabold tabular-nums"
            :class="
              step.done
                ? 'text-success'
                : 'text-primary-600 dark:text-primary-400'
            "
          >
            {{ step.numeral }}
          </p>
          <h3 class="text-highlighted mt-4 text-[22px] font-bold">
            {{ step.title }}
          </h3>
          <p class="text-muted mt-2 text-base leading-[1.6]">
            {{ step.body }}
          </p>
          <p class="text-primary mt-auto pt-3 text-[15px] font-semibold">
            {{ step.tagline }}
          </p>
        </div>
      </div>
    </section>

    <!-- Footer — ink band in both themes -->
    <footer
      ref="footerRef"
      class="bg-[#0f172a] px-6 py-14 sm:px-12 xl:px-[120px]"
      :class="{ 'is-in': footerRevealed }"
    >
      <div
        class="reveal flex flex-col justify-between gap-10 lg:flex-row lg:items-center"
      >
        <div class="flex max-w-2xl items-start gap-4">
          <PeakyLogo :size="30" class="mt-1.5 shrink-0" />
          <p class="text-[21px] leading-[1.55] font-medium text-[#f1f5f9]">
            Work saves to this device first and syncs in the background. Offline
            is fine — nothing is lost.
          </p>
        </div>
        <button
          type="button"
          class="focus-visible:outline-primary inline-flex h-12 shrink-0 items-center justify-center self-start rounded-[7px] border-[1.5px] border-[#475569] px-5 text-base font-semibold text-[#f1f5f9] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#94a3b8] hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-[0.5px] active:border-[#cbd5e1] lg:self-auto"
          @click="handleCta"
        >
          {{ signedIn ? "Go to Teams" : "Continue with Okta" }}
        </button>
      </div>
      <div
        class="reveal mt-12 flex flex-col justify-between gap-2 border-t border-[#1e293b] pt-6 text-[13px] text-[#94a3b8] sm:flex-row"
      >
        <p>Peaky · Readiness assessment</p>
        <p>Single sign-on via Okta · Local-first by design</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** Whether the visitor already has a session — swaps both auth CTAs and
   * the hero reassurance line for a "you're already in" framing instead of
   * asking a signed-in teammate to sign in again. */
  signedIn: boolean;
}>();

const { login } = useAuth();

function handleCta() {
  if (props.signedIn) {
    navigateTo("/teams");
    return;
  }
  login("/teams");
}

// Gates every hidden entrance state — added in onMounted so SSR/no-JS output
// (and the brief pre-hydration frame) always renders fully visible content.
const motionArmed = ref(false);

// Retuned from the composable's default (fires at first-pixel intersection):
// the section must scroll 20% up from the viewport's bottom edge before
// revealing, so it visibly "arrives" instead of firing off-screen or the
// instant its top pixel appears.
const scrollRevealOptions = { rootMargin: "0px 0px -20% 0px" };

const connectsSectionRef = ref<HTMLElement | null>(null);
const connectsRevealed = useRevealOnce(connectsSectionRef, scrollRevealOptions);

const footerRef = ref<HTMLElement | null>(null);
const footerRevealed = useRevealOnce(footerRef, { threshold: 0.1 });

onMounted(() => {
  motionArmed.value = true;
});

const journey = [
  {
    numeral: "01",
    title: "Define",
    body: "Authors publish templates — pillars of questions that set the bar. Drafts stay versioned in Template Studio; nothing ships until you publish.",
    tagline: "Start with one pillar.",
    done: false,
  },
  {
    numeral: "02",
    title: "Review",
    body: "Point a review at a team or product — one question at a time, at your pace. Answers save as you go.",
    tagline: "A “No” isn’t a failure — it’s a signal.",
    done: false,
  },
  {
    numeral: "03",
    title: "Learn",
    body: "Questions explain why they matter, and up to two advisors share leading practices as the team assesses.",
    tagline: "Teaching, not grading.",
    done: false,
  },
  {
    numeral: "04",
    title: "Act",
    body: "Answers become a risk-ranked follow-up list the team owns.",
    tagline: "Follow-ups, not blame.",
    done: true,
  },
];
</script>

<style scoped>
.motion-armed .hero-dash,
.motion-armed .hero-h1,
.motion-armed .hero-sub,
.motion-armed .hero-cta,
.motion-armed .hero-meta,
.motion-armed .hero-compass {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(5px);
}

/* Below-the-fold content rests as a visible ghost, not fully hidden — a
   1440x900 viewport should still show a hint of "How the pieces connect"
   beneath the hero so a visitor knows there's more to scroll for. Hero
   elements above stay fully hidden pre-reveal (landing-reveal, untouched)
   since they're already on-screen at load and don't need the tease.
   Depth-of-field, not fog: at blur(4px)/0.45 the ghost stays readable as
   words while clearly out of focus — heavier reads as a rendering smear,
   lighter gives the content away and kills the sharpen's payoff. */
.motion-armed .reveal,
.motion-armed .journey-col {
  opacity: 0.45;
  transform: translateY(10px);
  filter: blur(4px);
}

.motion-armed .hero-dash {
  animation: landing-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both;
}
.motion-armed .hero-h1 {
  animation: landing-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both;
}
.motion-armed .hero-sub {
  animation: landing-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
}
.motion-armed .hero-cta {
  animation: landing-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 240ms both;
}
.motion-armed .hero-meta {
  animation: landing-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both;
}
.motion-armed .hero-compass {
  animation: landing-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
}

/* Graticule crosses in the hero's upper-right air — opacity-only fade,
   joining the compass's own delay so the two beats read together. */
.motion-armed .hero-air {
  opacity: 0;
  animation: hero-air-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both;
}

.cross {
  vector-effect: non-scaling-stroke;
}

.motion-armed .is-in .reveal {
  animation: landing-sharpen 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.motion-armed .is-in .journey-col {
  animation: landing-sharpen 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.motion-armed .is-in .journey-col:nth-child(1) {
  animation-delay: 200ms;
}
.motion-armed .is-in .journey-col:nth-child(2) {
  animation-delay: 290ms;
}
.motion-armed .is-in .journey-col:nth-child(3) {
  animation-delay: 380ms;
}
.motion-armed .is-in .journey-col:nth-child(4) {
  animation-delay: 470ms;
}

/* Progressive enhancement: where the browser can drive an animation off the
   scrollport itself, let each column enter as it actually scrolls into
   view instead of a fixed post-reveal time stagger. The nth-child delays
   above are unneeded here — re-zero them at matching specificity so they
   don't win the cascade. */
@supports (animation-timeline: view()) {
  .motion-armed .is-in .journey-col {
    animation: landing-sharpen 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-timeline: view();
    animation-range: entry 10% entry 45%;
    animation-delay: 0s;
  }
  .motion-armed .is-in .journey-col:nth-child(1),
  .motion-armed .is-in .journey-col:nth-child(2),
  .motion-armed .is-in .journey-col:nth-child(3),
  .motion-armed .is-in .journey-col:nth-child(4) {
    animation-delay: 0s;
  }
}

@keyframes landing-reveal {
  from {
    opacity: 0;
    transform: translateY(12px);
    filter: blur(5px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

/* Ghost-to-sharp: scroll-revealed sections rest as a dim, blurred hint
   (see the .motion-armed .reveal / .journey-col rest state above) rather
   than fully hidden, then sharpen into place on reveal. */
@keyframes landing-sharpen {
  /* Must mirror the ghost rest state exactly or the hand-off jumps. */
  from {
    opacity: 0.45;
    transform: translateY(10px);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: none;
    filter: blur(0);
  }
}

@keyframes hero-air-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .motion-armed .hero-dash,
  .motion-armed .hero-h1,
  .motion-armed .hero-sub,
  .motion-armed .hero-cta,
  .motion-armed .hero-meta,
  .motion-armed .hero-compass,
  .motion-armed .hero-air,
  .motion-armed .reveal,
  .motion-armed .journey-col {
    opacity: 1;
    transform: none;
    filter: none;
    animation: none;
  }

  /* Same specificity as the scroll-driven rule above, declared later, so it
     wins the cascade and neutralizes the view()-timeline variant too. */
  @supports (animation-timeline: view()) {
    .motion-armed .is-in .journey-col {
      animation: none;
      animation-timeline: none;
    }
  }
}
</style>
