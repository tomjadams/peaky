<template>
  <div class="product-new ml-20 flex flex-1 flex-col">
    <main class="w-full px-6 py-6 min-[1600px]:px-10">
      <div
        class="mx-auto max-w-[1440px]"
        :class="{ 'wizard-entrance': entranceArmed }"
      >
        <SectionHeader
          title="New product"
          description="Define a product so its readiness can be reviewed over time."
          class="mb-8"
        />

        <ProductMentalModel class="wiz-reveal mb-10" style="--wiz-i: 0" />

        <div class="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <ProductWizardStepRail
            class="wiz-reveal"
            style="--wiz-i: 1"
            :steps="railSteps"
            :current-step="currentStep"
            :furthest-step="furthestStep"
            @select="goToStep"
          />

          <!-- The wizard's work surface: a cutting mat with one sheet of
               paper on it, the same staging as the Guided Drafting Room. -->
          <div ref="matEl" class="wiz-reveal wizard-mat" style="--wiz-i: 2">
            <section
              class="border-accented bg-default border-t-inverted relative rounded-b-lg border border-t-2 px-8 py-7 dark:bg-slate-900"
            >
              <span class="reg-mark reg-mark-tl" aria-hidden="true" />
              <span class="reg-mark reg-mark-tr" aria-hidden="true" />
              <span class="reg-mark reg-mark-bl" aria-hidden="true" />
              <span class="reg-mark reg-mark-br" aria-hidden="true" />

              <header class="mb-7">
                <span
                  class="mb-2.5 block h-[3px] w-6 rounded-full bg-[#0284C7] dark:bg-sky-400"
                  aria-hidden="true"
                />
                <div class="flex items-baseline justify-between gap-4">
                  <h2 class="text-highlighted text-[20px] font-bold">
                    {{ activeStep.title }}
                  </h2>
                  <span class="text-dimmed shrink-0 text-[13px] tabular-nums">
                    Step {{ currentStep }} of {{ TOTAL_STEPS }}
                  </span>
                </div>
                <p class="text-muted mt-1.5 text-sm">
                  {{ activeStep.description }}
                </p>
              </header>

              <Transition name="sheet-step" mode="out-in">
                <div :key="currentStep">
                  <ProductWizardStepIdentity
                    v-if="currentStep === 1"
                    :form="form"
                  />

                  <ProductWizardStepEntityPicker
                    v-else-if="currentStep === 2"
                    :all-items="allGroups"
                    :selected-ids="form.teamIds"
                    search-placeholder="Search teams..."
                    selected-label="Selected teams"
                    page-label="Teams"
                    item-noun="team"
                    @toggle="toggleTeam"
                  />

                  <ProductWizardStepEntityPicker
                    v-else-if="currentStep === 3"
                    :all-items="allComponents"
                    :preferred-ids="preferredComponentIds"
                    :selected-ids="form.componentIds"
                    search-placeholder="Search applications..."
                    selected-label="Linked applications"
                    page-label="Applications"
                    item-noun="application"
                    :scope-note="applicationScopeNote"
                    @toggle="toggleApp"
                  />

                  <ProductWizardStepReview
                    v-else
                    :form="form"
                    :origin-label="originLabel"
                    :product-manager-name="productManagerName"
                    :engineering-lead-name="engineeringLeadName"
                    :team-names="selectedTeamNames"
                    :application-names="selectedApplicationNames"
                    @edit="goToStep"
                  />
                </div>
              </Transition>

              <!-- Actions live on the sheet, separated by whitespace — the
                   page carries no rules outside its tables. -->
              <div class="mt-10 flex items-center justify-between gap-4">
                <UButton
                  size="lg"
                  color="neutral"
                  variant="ghost"
                  @click="handleCancel"
                >
                  Cancel
                </UButton>

                <div class="flex items-center gap-2">
                  <UButton
                    v-if="currentStep > 1"
                    size="lg"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-arrow-left"
                    @click="goToStep(currentStep - 1)"
                  >
                    Back
                  </UButton>

                  <!-- Only while nothing is linked: once an application is
                       picked, Skip would just repeat Continue. -->
                  <UButton
                    v-if="currentStep === 3 && form.componentIds.length === 0"
                    size="lg"
                    color="neutral"
                    variant="ghost"
                    @click="handleNext"
                  >
                    Skip
                  </UButton>

                  <UButton
                    v-if="currentStep < TOTAL_STEPS"
                    size="lg"
                    color="primary"
                    trailing-icon="i-lucide-arrow-right"
                    :disabled="!canContinue"
                    @click="handleNext"
                  >
                    Continue
                  </UButton>

                  <UButton
                    v-else
                    size="lg"
                    color="primary"
                    icon="i-lucide-check"
                    :loading="submitting"
                    :disabled="!isValid"
                    @click="handleCreate"
                  >
                    Create product
                  </UButton>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { WizardRailStep } from "~/components/product-wizard/StepRail.vue";
import { useProductCreation } from "~/composables/products/useProductCreation";
import { useCatalogGroupSearch } from "~/composables/catalog/useCatalogGroupSearch";
import { useCatalogComponentSearch } from "~/composables/catalog/useCatalogComponentSearch";
import { useCatalogUserSearch } from "~/composables/catalog/useCatalogUserSearch";
import { PRODUCT_ORIGIN_LABELS } from "~/composables/products/useProductFilters";

definePageMeta({
  breadcrumb: { label: "New product" },
  pageHeader: { title: "New product", showSurveyMode: false },
});

const router = useRouter();
const toast = useToast();

const TOTAL_STEPS = 4;

const { form, submitting, isValid, submitCreateLocal } = useProductCreation();
const { allGroups } = useCatalogGroupSearch();
const { allComponents } = useCatalogComponentSearch();
const { allUsers } = useCatalogUserSearch();

const preferredComponentIds = computed(() => {
  const selectedTeamIds = new Set(form.teamIds);

  if (selectedTeamIds.size === 0) {
    return [];
  }

  return allComponents.value
    .filter((component) => {
      return (
        component.ownerGroupId !== undefined &&
        selectedTeamIds.has(component.ownerGroupId)
      );
    })
    .map((component) => component.id);
});

const matEl = useTemplateRef<HTMLElement>("matEl");
const currentStep = ref(1);
const furthestStep = ref(1);

const STEPS = [
  {
    value: 1,
    title: "Identity",
    description: "Name the product and say who to contact about it.",
  },
  {
    value: 2,
    title: "Teams",
    description: "Pick the teams that own or contribute to this product.",
  },
  {
    value: 3,
    title: "Applications",
    description: "Optionally link the applications this product runs on.",
  },
  {
    value: 4,
    title: "Review",
    description: "Check the details, then create the product.",
  },
] as const;

const activeStep = computed(
  () => STEPS.find((step) => step.value === currentStep.value) ?? STEPS[0]
);

// ── Name resolution ─────────────────────────────────────────────────────
// The review step shows people, teams, and applications by display name;
// a raw directory id there is unreadable. An id that can't be resolved
// falls back to itself rather than disappearing.
function nameResolver(entries: { id: string; displayName: string }[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry.displayName]));
  return (id: string) => byId.get(id) ?? id;
}

const resolveUserName = computed(() => nameResolver(allUsers.value));
const resolveGroupName = computed(() => nameResolver(allGroups.value));
const resolveComponentName = computed(() => nameResolver(allComponents.value));

const originLabel = computed(() =>
  form.origin ? PRODUCT_ORIGIN_LABELS[form.origin] : ""
);
const productManagerName = computed(() =>
  form.productManagerId ? resolveUserName.value(form.productManagerId) : ""
);
const engineeringLeadName = computed(() =>
  form.engineeringLeadId ? resolveUserName.value(form.engineeringLeadId) : ""
);
const selectedTeamNames = computed(() =>
  form.teamIds.map((id) => resolveGroupName.value(id))
);
const selectedApplicationNames = computed(() =>
  form.componentIds.map((id) => resolveComponentName.value(id))
);

const applicationScopeNote = computed(() =>
  preferredComponentIds.value.length > 0
    ? "Showing applications owned by the selected teams. Search to reach the full catalog."
    : ""
);

// ── Rail ────────────────────────────────────────────────────────────────
const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const identityIsSettled = computed(
  () =>
    form.name.trim().length > 0 &&
    form.origin !== "" &&
    form.productManagerId.trim().length > 0
);

const railSteps = computed<WizardRailStep[]>(() => [
  {
    value: 1,
    title: "Identity",
    detail:
      form.name.trim() && originLabel.value
        ? `${form.name.trim()} · ${originLabel.value}`
        : "Name, origin, and contacts",
    settled: identityIsSettled.value,
  },
  {
    value: 2,
    title: "Teams",
    detail:
      form.teamIds.length > 0
        ? plural(form.teamIds.length, "team")
        : "Who owns and runs it",
    settled: form.teamIds.length > 0,
  },
  {
    value: 3,
    title: "Applications",
    detail:
      form.componentIds.length > 0
        ? plural(form.componentIds.length, "application")
        : furthestStep.value > 3
          ? "None linked"
          : "Optional — what it runs on",
    settled: true,
  },
  {
    value: 4,
    title: "Review",
    detail: isValid.value ? "Ready to create" : "Check the details",
    settled: isValid.value,
  },
]);

const canContinue = computed(() => {
  if (currentStep.value === 1) return identityIsSettled.value;
  if (currentStep.value === 2) return form.teamIds.length > 0;
  return true;
});

const toggleTeam = (id: string) => {
  const idx = form.teamIds.indexOf(id);
  if (idx >= 0) form.teamIds.splice(idx, 1);
  else form.teamIds.push(id);
};

const toggleApp = (id: string) => {
  const idx = form.componentIds.indexOf(id);
  if (idx >= 0) form.componentIds.splice(idx, 1);
  else form.componentIds.push(id);
};

const goToStep = (step: number) => {
  if (step < 1 || step > TOTAL_STEPS) return;
  if (step > furthestStep.value) return;
  currentStep.value = step;
};

watch(currentStep, (step) => {
  if (step > furthestStep.value) furthestStep.value = step;
  matEl.value?.scrollIntoView({ behavior: "smooth", block: "start" });
});

const handleNext = () => {
  if (currentStep.value >= TOTAL_STEPS) return;
  furthestStep.value = Math.max(furthestStep.value, currentStep.value + 1);
  currentStep.value += 1;
};

const handleCancel = () => {
  router.push("/products");
};

const handleCreate = async () => {
  try {
    // Local-first: commit to local DB immediately
    const productId = await submitCreateLocal();
    toast.add({
      title: "Product created",
      description: `${form.name} was created locally and will sync automatically.`,
      color: "success",
    });
    await router.push(`/products/${productId}`);
  } catch {
    toast.add({
      title: "Could not create product",
      description: "Please check the form and try again.",
      color: "error",
    });
  }
};

// One quiet settle on first paint, armed after hydration so SSR and no-JS
// render the finished page.
const entranceArmed = ref(false);
onMounted(() => {
  entranceArmed.value = true;
});
</script>

<style scoped>
/* The wizard's cutting mat — the Guided Drafting Room's signature material
   at page scale, so the sheet on it reads as the same paper the studio and
   the review shelves use. */
.wizard-mat {
  padding: 1.5rem;
  border-radius: 8px;
  background-color: #f4f5f7;
  background-image: radial-gradient(circle, #e4e7eb 1px, transparent 1px);
  background-size: 24px 24px;
}

.dark .wizard-mat {
  background-color: #020617;
  background-image: radial-gradient(
    circle,
    rgba(51, 65, 85, 0.5) 1px,
    transparent 1px
  );
}

/* Registration marks — the same hairline L-marks as the studio's sheet. */
.reg-mark {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}
.reg-mark::before,
.reg-mark::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  background: var(--ui-border);
}
.dark .reg-mark::before,
.dark .reg-mark::after {
  background: #334155;
}
.reg-mark::before {
  width: 12px;
  height: 1px;
}
.reg-mark::after {
  width: 1px;
  height: 12px;
}
.reg-mark-tl {
  top: 10px;
  left: 10px;
}
.reg-mark-tr {
  top: 10px;
  right: 10px;
  transform: scaleX(-1);
}
.reg-mark-bl {
  bottom: 10px;
  left: 10px;
  transform: scaleY(-1);
}
.reg-mark-br {
  bottom: 10px;
  right: 10px;
  transform: scale(-1);
}

/* Entrance: legend, rail, and mat rise 6px with a short stagger. */
.wizard-entrance .wiz-reveal {
  animation: wiz-rise 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--wiz-i, 0) * 40ms);
}

@keyframes wiz-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* Step hand-off: the sheet holds still, only its content inks in. */
.sheet-step-enter-active {
  animation: sheet-step-ink 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sheet-step-leave-active {
  transition: opacity 120ms ease;
}
.sheet-step-leave-to {
  opacity: 0;
}

@keyframes sheet-step-ink {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wizard-entrance .wiz-reveal,
  .sheet-step-enter-active {
    animation: none;
  }
  .sheet-step-leave-active {
    transition: none;
  }
}
</style>
