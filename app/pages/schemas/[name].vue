<template>
  <div class="mx-auto max-w-4xl px-6 py-10 text-sm">
    <div v-if="entry" class="space-y-8">
      <!-- Header -->
      <header class="space-y-2">
        <div class="text-muted text-[13px] font-semibold">
          Domain event schema
        </div>
        <h1 class="text-highlighted text-2xl font-bold">{{ entry.type }}</h1>
        <p class="text-muted font-sans text-sm leading-relaxed">
          {{ entry.description }}
        </p>
      </header>

      <!-- Metadata -->
      <section class="space-y-2">
        <h2 class="text-default text-sm font-semibold">Metadata</h2>
        <table class="w-full border-collapse font-mono text-[13px]">
          <tbody>
            <tr class="border-default border-b">
              <td class="text-muted w-32 py-2 pr-4 align-top">type</td>
              <td class="py-2">
                <code class="text-default">{{ entry.type }}</code>
              </td>
            </tr>
            <tr class="border-default border-b">
              <td class="text-muted py-2 pr-4 align-top">sources</td>
              <td class="py-2">
                <code
                  v-for="source in entry.sources"
                  :key="source"
                  class="text-default mr-2"
                  >{{ source }}</code
                >
              </td>
            </tr>
            <tr class="border-default border-b">
              <td class="text-muted py-2 pr-4 align-top">dataschema</td>
              <td class="py-2">
                <a
                  :href="schemaUrl"
                  target="_blank"
                  class="text-primary break-all underline"
                  >{{ schemaUrl }}</a
                >
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Properties table -->
      <section v-if="properties.length > 0" class="space-y-2">
        <h2 class="text-default text-sm font-semibold">Properties</h2>
        <table class="w-full border-collapse font-mono text-[13px]">
          <thead>
            <tr class="border-default border-b">
              <th class="text-muted py-2 pr-4 text-left font-medium">Field</th>
              <th class="text-muted py-2 pr-4 text-left font-medium">Type</th>
              <th class="text-muted py-2 pr-4 text-left font-medium">
                Required
              </th>
              <th class="text-muted py-2 text-left font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="prop in properties"
              :key="prop.name"
              class="border-default border-b last:border-0"
            >
              <td class="py-2 pr-4 align-top">
                <code class="text-default">{{ prop.name }}</code>
              </td>
              <td class="text-muted py-2 pr-4 align-top">{{ prop.type }}</td>
              <td class="py-2 pr-4 align-top">
                <UBadge v-if="prop.required" color="error" variant="subtle"
                  >required</UBadge
                >
                <span v-else class="text-muted text-[13px]">optional</span>
              </td>
              <td class="text-muted py-2 align-top font-sans leading-relaxed">
                {{ prop.description }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Example event -->
      <section class="space-y-2">
        <h2 class="text-default text-sm font-semibold">Example event</h2>
        <div
          class="bg-elevated border-default overflow-auto rounded-lg border p-4"
        >
          <pre class="text-default font-mono text-[13px] leading-relaxed">{{
            exampleEvent
          }}</pre>
        </div>
      </section>

      <!-- Raw JSON Schema -->
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-default text-sm font-semibold">JSON schema</h2>
          <a
            :href="schemaUrl"
            target="_blank"
            class="text-muted hover:text-default flex items-center gap-1 text-[13px] underline transition-colors duration-150"
          >
            <Icon name="lucide:download" class="h-3 w-3" />
            Download
          </a>
        </div>
        <div
          class="bg-elevated border-default overflow-auto rounded-lg border p-4"
        >
          <pre class="text-default font-mono text-[13px] leading-relaxed">{{
            formattedSchema
          }}</pre>
        </div>
      </section>

      <!-- Back link -->
      <div>
        <UButton
          to="/schemas"
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-left"
        >
          All event schemas
        </UButton>
      </div>
    </div>

    <!-- Not found -->
    <div v-else class="space-y-4">
      <h1 class="text-highlighted text-2xl font-bold">
        Event schema not found
      </h1>
      <p class="text-muted font-sans">
        No event schema registered for
        <code class="text-default font-mono">{{ name }}</code
        >.
      </p>
      <UButton
        to="/schemas"
        size="sm"
        color="neutral"
        variant="outline"
        icon="i-lucide-arrow-left"
      >
        All event schemas
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from "vue-router";
import { zodToJsonSchema } from "zod-to-json-schema";
import { findCatalogEntryByType } from "~/services/events/schemas/index";
import { buildDataSchemaUrl } from "~/services/events/config";
import {
  buildExampleData,
  deriveEntityType,
} from "~/services/events/exampleBuilder";

interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

definePageMeta({
  breadcrumb: {
    label: (route: RouteLocationNormalizedLoaded) =>
      String(route.params.name ?? "Schema"),
  },
});

const route = useRoute();
const name = computed(() => route.params.name as string);
const entry = computed(() => findCatalogEntryByType(name.value));

const schemaUrl = computed(() =>
  entry.value ? buildDataSchemaUrl(entry.value.type) : ""
);

const jsonSchema = computed(() => {
  if (!entry.value) return null;
  return zodToJsonSchema(entry.value.schema, {
    name: entry.value.type,
    $refStrategy: "none",
    markdownDescription: false,
    definitions: {},
  });
});

/** Resolves the inlined schema definition, unwrapping `definitions[name]` if present. */
const inlinedSchema = computed((): Record<string, unknown> => {
  const raw = jsonSchema.value as Record<string, unknown> | null;
  if (!raw) return {};
  if (raw.definitions && typeof raw.definitions === "object") {
    return (
      ((raw.definitions as Record<string, unknown>)[name.value] as Record<
        string,
        unknown
      >) ?? raw
    );
  }
  return raw;
});

const formattedSchema = computed(() => {
  if (!jsonSchema.value) return "";
  return JSON.stringify(inlinedSchema.value, null, 2);
});

const properties = computed<PropInfo[]>(() => {
  const schema = inlinedSchema.value;
  const props = schema.properties as Record<string, unknown> | undefined;
  if (!props) return [];

  const required = new Set((schema.required as string[] | undefined) ?? []);

  return Object.entries(props).map(([key, val]) => {
    const def = val as Record<string, unknown>;
    let type = (def.type as string) ?? "any";
    if (type === "array") {
      const items = def.items as Record<string, unknown> | undefined;
      type = items?.type ? `${items.type}[]` : "any[]";
    }
    return {
      name: key,
      type,
      required: required.has(key),
      description: (def.description as string) ?? "",
    };
  });
});

const exampleEvent = computed(() => {
  if (!entry.value || !jsonSchema.value) return "";

  const envelope = {
    id: "019b3c4d-5e6f-7a8b-9c0d-0a1b2c3d4e5f",
    type: entry.value.type,
    specversion: "1.0",
    source: entry.value.sources[0] ?? "peaky.client",
    dataschema: schemaUrl.value,
    actorId: "019b3c4d-5e6f-7a8b-9c0d-3a4b5c6d7e8f",
    actorType: "user",
    entityType: deriveEntityType(entry.value.type),
    entityId: "019b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6e",
    time: "2026-03-31T10:15:00.000Z",
    data: buildExampleData(inlinedSchema.value),
  };

  return JSON.stringify(envelope, null, 2);
});

useHead(() => ({
  title: entry.value ? `${entry.value.type} — Event Schema` : "Event Schema",
}));
</script>
