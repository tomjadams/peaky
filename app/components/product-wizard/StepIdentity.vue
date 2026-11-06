<!-- eslint-disable vue/no-mutating-props -- form is a shared reactive() from useProductCreation -->
<template>
  <div class="space-y-9">
    <div class="space-y-2">
      <label
        for="product-name"
        class="text-default block text-sm font-semibold"
      >
        Name <span class="text-error" aria-hidden="true">*</span>
      </label>
      <UInput
        id="product-name"
        v-model="form.name"
        size="lg"
        required
        placeholder="e.g., Checkout, Launchpad"
      />
      <p class="text-dimmed text-[13px]">
        The name teams already use for it. Keep it short.
      </p>
    </div>

    <fieldset>
      <legend class="text-default block text-sm font-semibold">
        Origin <span class="text-error" aria-hidden="true">*</span>
      </legend>
      <p class="text-muted mt-1 text-[13px]">Who owns the roadmap?</p>

      <!-- Products are internal-only for now — the external products
           registry will bring back a visibility choice when it exists. -->
      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        <button
          v-for="originInfo in PRODUCT_ORIGIN_INFO"
          :key="originInfo.value"
          type="button"
          :aria-pressed="form.origin === originInfo.value"
          :class="[
            'flex h-full flex-col rounded-lg border p-4 text-left transition-all duration-150 active:scale-[0.99]',
            form.origin === originInfo.value
              ? 'border-sky-600 bg-[#EAF3FA] dark:border-sky-400 dark:bg-sky-400/10'
              : 'border-default bg-default hover:border-accented',
          ]"
          @click="form.origin = originInfo.value"
        >
          <span class="flex w-full items-start gap-2">
            <span class="text-default min-w-0 flex-1 text-sm font-semibold">{{
              originInfo.label
            }}</span>
            <Icon
              v-if="form.origin === originInfo.value"
              name="lucide:check-circle-2"
              class="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400"
            />
          </span>
          <span class="text-muted mt-1.5 text-[13px] leading-relaxed">
            {{ originInfo.description }}
          </span>
          <span class="text-dimmed mt-auto pt-2.5 text-[13px]">
            {{ originInfo.example }}
          </span>
        </button>
      </div>
    </fieldset>

    <div class="grid gap-6 xl:grid-cols-2">
      <section class="border-default bg-muted/40 rounded-lg border p-5">
        <span class="bg-primary mb-3 block h-[3px] w-6 rounded-full" />
        <h3 class="text-default text-base font-semibold">Decision contacts</h3>
        <p class="text-muted mt-1 text-[13px]">
          People who can answer questions and make trade-offs during a review.
        </p>
        <div class="mt-5 space-y-4">
          <div class="space-y-1.5">
            <label
              for="product-manager"
              class="text-default block text-sm font-medium"
            >
              Product manager
              <span class="text-error" aria-hidden="true">*</span>
            </label>
            <UserAutocomplete
              v-model="form.productManagerId"
              input-id="product-manager"
            />
          </div>
          <div class="space-y-1.5">
            <label
              for="engineering-lead"
              class="text-default block text-sm font-medium"
            >
              Engineering lead
            </label>
            <UserAutocomplete
              v-model="form.engineeringLeadId"
              input-id="engineering-lead"
            />
          </div>
        </div>
      </section>

      <section class="border-default bg-muted/40 rounded-lg border p-5">
        <span class="bg-primary mb-3 block h-[3px] w-6 rounded-full" />
        <h3 class="text-default text-base font-semibold">
          Working links
          <span class="text-dimmed text-[13px] font-normal">(optional)</span>
        </h3>
        <p class="text-muted mt-1 text-[13px]">
          Add the places reviewers use to understand plans, decisions, and
          support.
        </p>
        <div class="mt-5 space-y-4">
          <div class="space-y-1.5">
            <label
              for="product-roadmap"
              class="text-default block text-sm font-medium"
            >
              Roadmap
            </label>
            <UInput
              id="product-roadmap"
              v-model="form.roadmapUrl"
              size="lg"
              icon="i-lucide-map"
              placeholder="https://roadmap..."
            />
          </div>
          <div class="space-y-1.5">
            <label
              for="product-documentation"
              class="text-default block text-sm font-medium"
            >
              Documentation
            </label>
            <UInput
              id="product-documentation"
              v-model="form.documentationUrl"
              size="lg"
              icon="i-lucide-book-open"
              placeholder="https://docs..."
            />
          </div>
          <div class="space-y-1.5">
            <label
              for="product-support-channel"
              class="text-default block text-sm font-medium"
            >
              Support channel
            </label>
            <UInput
              id="product-support-channel"
              v-model="form.supportChannel"
              size="lg"
              icon="i-lucide-message-circle"
              placeholder="#help-checkout"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProductFormState } from "~/composables/products/useProductCreation";
import { PRODUCT_ORIGIN_INFO } from "~/composables/products/useProductFilters";

defineProps<{ form: ProductFormState }>();
</script>
