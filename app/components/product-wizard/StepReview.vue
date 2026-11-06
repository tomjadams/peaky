<template>
  <div data-testid="product-wizard-review" class="space-y-9">
    <section>
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-default text-sm font-semibold">Identity</h3>
        <button
          type="button"
          class="text-primary hover:text-primary/80 shrink-0 text-[13px] font-medium transition-colors"
          @click="emit('edit', 1)"
        >
          Edit
        </button>
      </div>

      <dl
        class="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]"
      >
        <template v-for="row in identityRows" :key="row.label">
          <dt class="text-muted text-sm">{{ row.label }}</dt>
          <dd
            class="text-sm"
            :class="row.value ? 'text-default font-medium' : 'text-dimmed'"
          >
            {{ row.value || "Not set" }}
          </dd>
        </template>
      </dl>
    </section>

    <ProductWizardSummaryList
      title="Teams"
      :items="teamNames"
      :count-label="countLabel(teamNames.length, 'team')"
      empty-text="No teams selected."
      @edit="emit('edit', 2)"
    />

    <ProductWizardSummaryList
      title="Applications"
      :items="applicationNames"
      :count-label="countLabel(applicationNames.length, 'application')"
      empty-text="No applications linked. You can link them later."
      @edit="emit('edit', 3)"
    />

    <section v-if="linkRows.length > 0">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-default text-sm font-semibold">Links</h3>
        <button
          type="button"
          class="text-primary hover:text-primary/80 shrink-0 text-[13px] font-medium transition-colors"
          @click="emit('edit', 1)"
        >
          Edit
        </button>
      </div>

      <dl
        class="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]"
      >
        <template v-for="row in linkRows" :key="row.label">
          <dt class="text-muted text-sm">{{ row.label }}</dt>
          <dd class="min-w-0 text-sm">
            <a
              v-if="row.href"
              :href="row.href"
              target="_blank"
              rel="noreferrer"
              class="text-primary hover:text-primary/80 inline-flex min-w-0 items-center gap-1.5 font-medium transition-colors"
            >
              <Icon :name="row.icon" class="h-3.5 w-3.5 shrink-0" />
              <span class="truncate">{{ row.value }}</span>
            </a>
            <span
              v-else
              class="text-default inline-flex min-w-0 items-center gap-1.5 font-medium"
            >
              <Icon :name="row.icon" class="text-muted h-3.5 w-3.5 shrink-0" />
              <span class="truncate">{{ row.value }}</span>
            </span>
          </dd>
        </template>
      </dl>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ProductFormState } from "~/composables/products/useProductCreation";

interface LinkRow {
  label: string;
  value: string;
  icon: string;
  href?: string;
}

const props = defineProps<{
  form: ProductFormState;
  originLabel: string;
  productManagerName: string;
  engineeringLeadName: string;
  teamNames: string[];
  applicationNames: string[];
}>();

const emit = defineEmits<{ edit: [step: number] }>();

const countLabel = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const identityRows = computed(() => [
  { label: "Name", value: props.form.name.trim() },
  { label: "Origin", value: props.originLabel },
  { label: "Product manager", value: props.productManagerName },
  { label: "Engineering lead", value: props.engineeringLeadName },
]);

const linkRows = computed<LinkRow[]>(() => {
  const rows: LinkRow[] = [];
  if (props.form.roadmapUrl) {
    rows.push({
      label: "Roadmap",
      value: props.form.roadmapUrl,
      icon: "lucide:map",
      href: props.form.roadmapUrl,
    });
  }
  if (props.form.documentationUrl) {
    rows.push({
      label: "Documentation",
      value: props.form.documentationUrl,
      icon: "lucide:book-open",
      href: props.form.documentationUrl,
    });
  }
  if (props.form.supportChannel) {
    rows.push({
      label: "Support channel",
      value: props.form.supportChannel,
      icon: "lucide:message-circle",
    });
  }
  return rows;
});
</script>
