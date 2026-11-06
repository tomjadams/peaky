<script setup lang="ts">
type Segment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string };

const props = defineProps<{
  text: string;
}>();

const segments = computed<Segment[]>(() => {
  if (!props.text) return [];

  const parts: Segment[] = [];
  // Match **bold**, *italic*, and `code` patterns
  const regex = /(\*\*(.+?)\*\*|\*([^*\n]+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(props.text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        value: props.text.slice(lastIndex, match.index),
      });
    }
    if (match[2]) {
      parts.push({ type: "bold", value: match[2] });
    } else if (match[3]) {
      parts.push({ type: "italic", value: match[3] });
    } else if (match[4]) {
      parts.push({ type: "code", value: match[4] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < props.text.length) {
    parts.push({ type: "text", value: props.text.slice(lastIndex) });
  }

  return parts;
});
</script>

<template>
  <template v-for="(seg, i) in segments" :key="i">
    <strong v-if="seg.type === 'bold'">{{ seg.value }}</strong>
    <em v-else-if="seg.type === 'italic'">{{ seg.value }}</em>
    <code
      v-else-if="seg.type === 'code'"
      class="bg-muted rounded px-1 text-[13px]"
      >{{ seg.value }}</code
    >
    <template v-else>{{ seg.value }}</template>
  </template>
</template>
