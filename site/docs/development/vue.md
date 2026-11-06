# Vue & Nuxt Conventions

This document describes the Vue/Nuxt patterns and conventions used in the Peaky project.

For the full composable and page composition model, see the [UI patterns walkthrough](./walkthroughs/codebase/ui).

## Component Structure

### Script Setup

Always use `<script setup lang="ts">` for components. Group code in this order:

```vue
<script setup lang="ts">
// 1. Imports
import { useTemplateStudio } from "~/composables/templates/studio/useTemplateStudio";
import type { TemplateQuestion } from "~/models";

// 2. Props/Emits
const props = defineProps<{ id: string; data: TemplateQuestion }>();
const emit = defineEmits<{ update: [id: string] }>();

// 3. Constants (SCREAMING_SNAKE_CASE)
const MAX_ITEMS = 10;
const STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
] as const;

// 4. Reactive State
const localText = ref(props.data.text);
const isEditing = ref(false);

// 5. Computed Properties
const displayText = computed(() => localText.value || "Untitled question");
const isComplete = computed(() => props.data.text.trim().length > 0);

// 6. Watchers
watch(() => props.data.text, (newText) => {
  localText.value = newText;
});

// 7. Methods/Handlers
const handleSave = () => { ... };

// 8. Lifecycle Hooks
onMounted(() => { ... });
</script>
```

## Computed Properties

### Use Computed for Derived State

Extract complex template expressions into computed properties for readability and caching.

```vue
<!-- ✅ Good - computed property for derived state -->
<script setup>
const conditionItems = computed(() => {
  return props.data.conditions.map((condition) => {
    const details = props.data.questionDetails?.get(condition.questionId);
    return {
      id: condition.questionId,
      slug: details?.slug ?? condition.questionId,
      displayText: abbreviateText(details?.text ?? "Unknown"),
    };
  });
});
</script>

<template>
  <div v-for="item in conditionItems" :key="item.id">
    {{ item.slug }}: {{ item.displayText }}
  </div>
</template>

<!-- ❌ Avoid - complex expressions in template -->
<template>
  <div v-for="condition in data.conditions" :key="condition.questionId">
    {{ data.questionDetails?.get(condition.questionId)?.slug ?? condition.questionId }}
  </div>
</template>
```

### Computed for Two-Way Binding

Use computed with getter/setter for props that need local editing.

```vue
<script setup>
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => {
    if (value !== props.modelValue) {
      emit("update:modelValue", value);
    }
  },
});
</script>

<template>
  <input v-model="localValue" />
</template>
```

## Constants in Templates

Use `SCREAMING_SNAKE_CASE` for constants used in templates and define them at the top.

```vue
<script setup>
// ✅ Good - constant defined once, reused
// Note: Don't use 'as const' with NuxtUI components (they expect mutable arrays)
const QUESTION_TYPE_OPTIONS = [
  { label: "Yes / No", value: "yes-no" },
  { label: "Checklist", value: "checklist" },
];

const RISK_LEVEL_OPTIONS = [
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
];
</script>

<template>
  <USelect :items="QUESTION_TYPE_OPTIONS" />
  <USelect :items="RISK_LEVEL_OPTIONS" />
</template>
```

```vue
<script setup>
// ❌ Avoid - inline arrays recreated on every render
</script>

<template>
  <USelect :items="[{ label: 'AND', value: 'and' }, { label: 'OR', value: 'or' }]" />
</template>
```

## Utility Functions

### Pure Functions Outside Setup

Extract pure utility functions outside the setup block or into separate files.

```vue
<script setup lang="ts">
// ✅ Good - pure function defined outside reactive context
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function abbreviateText(text: string, maxLen = 50): string {
  const stripped = stripMarkdown(text);
  return stripped.length <= maxLen ? stripped : stripped.slice(0, maxLen).trim() + "...";
}

// Use in computed
const displayText = computed(() => abbreviateText(props.text));
</script>
```

```vue
<script setup>
// ❌ Avoid - arrow function in reactive context when not needed
const stripMarkdown = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1");
</script>
```

### Move to Composables for Reuse

If a utility is used in multiple components, extract to a composable.

```typescript
// utils/text.ts
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

export function abbreviateText(text: string, maxLen = 50): string {
  const stripped = stripMarkdown(text);
  return stripped.length <= maxLen ? stripped : stripped.slice(0, maxLen).trim() + "...";
}
```

```vue
<script setup>
import { stripMarkdown, abbreviateText } from "~/utils/text";
</script>
```

## Props and Emits

### Type-Only Props

Use type-only props for better IDE support.

```vue
<script setup lang="ts">
// ✅ Good - type-only props
const props = defineProps<{
  id: string;
  data: TemplateQuestion;
  disabled?: boolean;
}>();

// ✅ Good - with defaults
const props = withDefaults(
  defineProps<{
    id: string;
    disabled?: boolean;
  }>(),
  { disabled: false }
);
</script>
```

### Typed Emits

Use typed emits for better type safety.

```vue
<script setup lang="ts">
// ✅ Good - typed emits
const emit = defineEmits<{
  update: [id: string, updates: Partial<TemplateQuestion>];
  remove: [id: string];
  "update:modelValue": [value: string];
}>();

// Usage
emit("update", props.id, { text: "New question text" });
</script>
```

## Templates

### Clean Conditionals

Use computed booleans for complex conditions.

```vue
<!-- ✅ Good - computed boolean -->
<script setup>
const showEmptyState = computed(() => props.items.length === 0 && !props.isLoading);
const hasValidSelection = computed(() => props.selected && props.selected.id !== "default");
</script>

<template>
  <div v-if="showEmptyState">No items</div>
  <div v-else-if="hasValidSelection">{{ selected.name }}</div>
</template>

<!-- ❌ Avoid - complex inline conditions -->
<template>
  <div v-if="items.length === 0 && !isLoading">No items</div>
</template>
```

### Binding Shorthands

Use shorthand syntax for dynamic bindings.

```vue
<!-- ✅ Good -->
<div :class="borderColor" :style="{ width: nodeWidth + 'px' }">
<img :src="imageUrl" :alt="imageAlt">

<!-- ❌ Avoid - verbose -->
<div v-bind:class="borderColor" v-bind:style="{ width: nodeWidth + 'px' }">
```

### Event Handler Naming

Prefix event handlers with `handle` or `on`.

```vue
<script setup>
// ✅ Good - consistent naming
const handleSave = () => { ... };
const handleCancel = () => { ... };
const onItemClick = (id: string) => { ... };

// ❌ Avoid - inconsistent
const save = () => { ... };
const doCancel = () => { ... };
const clickItem = (id: string) => { ... };
</script>
```

## Nuxt-Specific Patterns

### Explicit Imports

Always use explicit imports for composables—don't rely on auto-imports.

```vue
<script setup lang="ts">
// ✅ Good - explicit imports
import { useTemplateStudio } from "~/composables/templates/studio/useTemplateStudio";
import { useMoreInfoPanel } from "~/app/ui/useMoreInfoPanel";

const { template, saveTemplate } = useTemplateStudio();

// ❌ Avoid - relying on auto-imports
const { template } = useTemplateStudio(); // Where does this come from?
</script>
```

### useFetch vs $fetch

Use `useFetch` for SSR-friendly data fetching, `$fetch` for client-only or event handlers.

```vue
<script setup>
// ✅ Good - SSR-friendly data fetching
const { data } = await useFetch("/api/templates");

// ✅ Good - client-only or event handlers
const handleSave = async () => {
  await $fetch("/api/templates", { method: "POST", body: data });
};
</script>
```

## Style Scoping

### Scoped Styles

Always use scoped styles for component-specific CSS.

```vue
<style scoped>
.question-card {
  min-width: 320px;
}
</style>
```

### Deep Selectors for Library Overrides

Use `:deep()` for styling library components.

```vue
<style scoped>
:deep(.question-card__actions button) {
  min-height: 2rem;
}
</style>
```

## Resources

- [Vue Style Guide](https://vuejs.org/style-guide/)
- [Nuxt TypeScript](https://nuxt.com/docs/guide/going-further/typescript)
- [Vue Composables](https://vuejs.org/guide/reusability/composables)
