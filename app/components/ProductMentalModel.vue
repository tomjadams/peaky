<template>
  <!-- The map legend: four keyed parts, a few words each, and what a
       filled-in one looks like. Plain canvas — no card, no wash. -->
  <section aria-labelledby="product-legend-title">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2
          id="product-legend-title"
          class="text-default text-[15px] font-semibold"
        >
          What is a product?
        </h2>
        <p class="text-muted mt-1 text-sm">
          One customer experience, and the people, teams, and systems behind it.
          Checkout, for example:
        </p>
      </div>

      <button
        type="button"
        :aria-expanded="isOpen"
        aria-controls="product-legend-parts"
        class="text-muted hover:text-default flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        @click="toggle"
      >
        <Icon
          :name="isOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="h-4 w-4"
        />
        {{ isOpen ? "Hide" : "Show" }}
      </button>
    </div>

    <div
      v-show="isOpen"
      id="product-legend-parts"
      class="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div
        v-for="part in ANATOMY"
        :key="part.label"
        class="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-3"
      >
        <!-- The key mark. One tint across all four, so the glyphs do the
             telling — a legend key, not four colour-coded badges. -->
        <span
          class="bg-primary/10 row-span-3 mt-0.5 flex h-7 w-7 items-center justify-center rounded-md"
          aria-hidden="true"
        >
          <Icon :name="part.icon" class="text-primary h-4 w-4" />
        </span>
        <h3 class="text-default text-sm font-semibold">{{ part.label }}</h3>
        <p class="text-muted col-start-2 text-[13px]">{{ part.meaning }}</p>
        <div class="col-start-2 mt-1.5 flex flex-wrap gap-1.5">
          <span
            v-for="chip in part.examples"
            :key="chip"
            class="border-default bg-muted text-muted inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium"
          >
            {{ chip }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Ordered to match the wizard's own route, and worded to match the rail's
// step lines, so the legend reads as the key to the steps below it.
const ANATOMY = [
  {
    label: "Identity",
    icon: "lucide:box",
    meaning: "Name, origin, and contacts",
    examples: ["Checkout", "Bespoke"],
  },
  {
    label: "Teams",
    icon: "lucide:users",
    meaning: "Who owns and runs it",
    examples: ["Checkout Core", "Payments"],
  },
  {
    label: "Applications",
    icon: "lucide:app-window",
    meaning: "What it runs on — optional",
    examples: ["checkout-api", "checkout-web"],
  },
  {
    label: "Links",
    icon: "lucide:link",
    meaning: "Where to find more",
    examples: ["Roadmap", "#help-checkout"],
  },
];

const STORAGE_KEY = "peaky:product-legend-open";

// Renders open on the server and pre-hydration; a returning reader's stored
// choice is applied once the component mounts.
const isOpen = ref(true);

onMounted(() => {
  isOpen.value = localStorage.getItem(STORAGE_KEY) !== "false";
});

const toggle = () => {
  isOpen.value = !isOpen.value;
  localStorage.setItem(STORAGE_KEY, String(isOpen.value));
};
</script>
