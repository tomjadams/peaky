<script setup lang="ts">
interface TemplateSummary {
  id: string;
  name: string;
  revisionNumber: number | null;
}

interface ProductApplicationOption {
  id: string;
  name: string;
}

interface Props {
  reviewName: string;
  reviewScope: "full" | "targeted";
  productApplicationCount: number;
  productApplications: ProductApplicationOption[];
  selectedApplicationIds: string[];
  selectedTemplateSummaries: TemplateSummary[];
}

defineProps<Props>();

const emit = defineEmits<{
  "update:reviewName": [value: string];
  "update:reviewScope": [value: "full" | "targeted"];
  "toggle-application": [applicationId: string];
}>();
</script>

<template>
  <section data-testid="wizard-step-2" class="space-y-6">
    <div class="space-y-2">
      <label
        for="review-name"
        class="text-default flex items-center gap-2 text-sm font-semibold"
      >
        <Icon name="lucide:pencil-line" class="h-4 w-4" />
        Review Name
      </label>
      <UInput
        id="review-name"
        :model-value="reviewName"
        size="lg"
        icon="i-lucide-type"
        placeholder="e.g., Q1 2026 Readiness Review"
        @update:model-value="emit('update:reviewName', String($event))"
      />
      <p class="text-dimmed text-[13px]">
        This title appears in dashboard lists and review details.
      </p>
    </div>

    <div class="space-y-3">
      <h3 class="text-default flex items-center gap-2 text-sm font-semibold">
        <Icon name="lucide:scan" class="h-4 w-4" />
        Review Scope
      </h3>
      <p class="text-muted text-sm">What should this review cover?</p>

      <div class="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          :aria-pressed="reviewScope === 'full'"
          :class="[
            'rounded-lg border p-5 text-left transition-all duration-150 active:scale-[0.99]',
            reviewScope === 'full'
              ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
              : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated ring-1',
          ]"
          @click="emit('update:reviewScope', 'full')"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="text-default text-sm font-semibold">Full product</h4>
              <p class="text-muted mt-1.5 text-sm">
                Assess the product holistically — documentation, roadmap,
                operational readiness, and all applications.
              </p>
            </div>
            <span
              :class="[
                'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                reviewScope === 'full'
                  ? 'border-primary bg-primary text-white'
                  : 'border-default text-dimmed bg-elevated',
              ]"
            >
              <Icon
                v-if="reviewScope === 'full'"
                name="lucide:check"
                class="h-4 w-4"
              />
            </span>
          </div>
        </button>

        <button
          type="button"
          :disabled="productApplicationCount === 0"
          :aria-pressed="reviewScope === 'targeted'"
          :class="[
            'rounded-lg border p-5 text-left transition-all duration-150 active:scale-[0.99]',
            productApplicationCount === 0
              ? 'cursor-not-allowed opacity-50'
              : '',
            reviewScope === 'targeted'
              ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
              : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated ring-1',
          ]"
          @click="emit('update:reviewScope', 'targeted')"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="text-default text-sm font-semibold">
                Specific applications
              </h4>
              <p class="text-muted mt-1.5 text-sm">
                Focus on a subset of the product's applications.
                <span v-if="productApplicationCount === 0" class="text-dimmed">
                  No applications associated with this product.
                </span>
              </p>
            </div>
            <span
              :class="[
                'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                reviewScope === 'targeted'
                  ? 'border-primary bg-primary text-white'
                  : 'border-default text-dimmed bg-elevated',
              ]"
            >
              <Icon
                v-if="reviewScope === 'targeted'"
                name="lucide:check"
                class="h-4 w-4"
              />
            </span>
          </div>
        </button>
      </div>
    </div>

    <div v-if="reviewScope === 'targeted'" class="space-y-3">
      <p class="text-muted text-sm">
        Select which applications to include in this review.
      </p>

      <div data-testid="product-application-picker" class="grid gap-3">
        <button
          v-for="app in productApplications"
          :key="app.id"
          type="button"
          :data-testid="`product-application-${app.id}`"
          :aria-pressed="selectedApplicationIds.includes(app.id)"
          :class="[
            'rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
            selectedApplicationIds.includes(app.id)
              ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
              : 'border-default bg-default ring-default hover:border-primary/60 hover:bg-elevated ring-1',
          ]"
          @click="emit('toggle-application', app.id)"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <Icon
                name="lucide:app-window"
                class="text-muted h-4 w-4 shrink-0"
              />
              <span class="text-default text-sm font-medium">{{
                app.name
              }}</span>
            </div>
            <span
              :class="[
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                selectedApplicationIds.includes(app.id)
                  ? 'border-primary bg-primary text-white'
                  : 'border-default text-dimmed bg-elevated',
              ]"
            >
              <Icon
                v-if="selectedApplicationIds.includes(app.id)"
                name="lucide:check"
                class="h-3 w-3"
              />
            </span>
          </div>
        </button>
      </div>

      <p
        v-if="selectedApplicationIds.length > 0"
        class="text-muted text-[13px]"
      >
        {{ selectedApplicationIds.length }} of
        {{ productApplicationCount }} applications selected
      </p>
    </div>

    <div class="bg-default border-default rounded-lg border p-4">
      <h3
        class="text-default mb-3 flex items-center gap-2 text-sm font-semibold"
      >
        <Icon name="lucide:layout-template" class="h-4 w-4" />
        Review Summary
      </h3>

      <div class="space-y-3 text-sm">
        <div class="flex items-start gap-3">
          <span class="text-dimmed w-20 shrink-0 text-[13px]">Revisions</span>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="template in selectedTemplateSummaries"
              :key="template.id"
              class="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[13px] font-medium"
            >
              {{ template.name }} ·
              {{
                template.revisionNumber !== null
                  ? `v${template.revisionNumber}`
                  : "Published"
              }}
            </span>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <span class="text-dimmed w-20 shrink-0 text-[13px]">Scope</span>
          <span class="text-default text-sm">
            <template v-if="reviewScope === 'full'">
              Full product · applications ({{ productApplicationCount }})
            </template>
            <template v-else>
              Targeted · applications ({{ selectedApplicationIds.length }})
            </template>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
