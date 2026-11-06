<template>
  <div
    class="rich-text-editor"
    :class="{ 'has-error': isOverLimit, 'is-readonly': readonly }"
  >
    <!-- Toolbar -->
    <div
      v-if="showToolbar && !readonly"
      class="rich-text-editor__toolbar border-default flex items-center gap-1 border-b px-2 py-1.5 dark:border-slate-600 dark:bg-slate-700/30"
    >
      <button
        type="button"
        class="rounded px-2 py-1 text-[13px] font-bold transition-colors"
        :class="
          editor?.isActive('bold')
            ? 'bg-accented text-highlighted dark:bg-slate-600'
            : 'text-dimmed hover:bg-accented/60 hover:text-default dark:hover:bg-slate-600 dark:hover:text-slate-200'
        "
        title="Bold (⌘B)"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        B
      </button>
      <button
        v-if="showItalic"
        type="button"
        class="rounded px-2 py-1 text-[13px] italic transition-colors"
        :class="
          editor?.isActive('italic')
            ? 'bg-accented text-highlighted dark:bg-slate-600'
            : 'text-dimmed hover:bg-accented/60 hover:text-default dark:hover:bg-slate-600 dark:hover:text-slate-200'
        "
        title="Italic (⌘I)"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        I
      </button>

      <template v-if="showLists">
        <div class="bg-accented mx-1 h-4 w-px dark:bg-slate-600" />
        <button
          type="button"
          class="rounded p-1 transition-colors"
          :class="
            editor?.isActive('bulletList')
              ? 'bg-accented text-highlighted dark:bg-slate-600'
              : 'text-dimmed hover:bg-accented/60 hover:text-default dark:hover:bg-slate-600 dark:hover:text-slate-200'
          "
          title="Bulleted List"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          <Icon name="lucide:list" class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded p-1 transition-colors"
          :class="
            editor?.isActive('orderedList')
              ? 'bg-accented text-highlighted dark:bg-slate-600'
              : 'text-dimmed hover:bg-accented/60 hover:text-default dark:hover:bg-slate-600 dark:hover:text-slate-200'
          "
          title="Numbered List"
          @click="editor?.chain().focus().toggleOrderedList().run()"
        >
          <Icon name="lucide:list-ordered" class="h-4 w-4" />
        </button>
      </template>

      <div class="flex-1" />

      <!-- Character count -->
      <span class="font-mono text-[13px]" :class="charCountClass">
        {{ charCount }}/{{ limit }}
      </span>
    </div>

    <!-- Simple toolbar for non-toolbar mode showing just character count -->
    <div
      v-else-if="!readonly"
      class="rich-text-editor__toolbar border-default flex items-center justify-end border-b px-2 py-1.5 dark:border-slate-600 dark:bg-slate-700/30"
    >
      <span class="font-mono text-[13px]" :class="charCountClass">
        {{ charCount }}/{{ limit }}
      </span>
    </div>

    <!-- Editor -->
    <EditorContent
      :editor="editor"
      class="prose prose-sm dark:prose-invert max-w-none focus-within:outline-none"
      :class="readonly ? 'px-0 py-0' : 'px-4 py-3'"
    />

    <!-- Validation error message when over limit -->
    <div
      v-if="isOverLimit && !readonly"
      class="flex items-center gap-1.5 border-t border-red-200 bg-red-50 px-3 py-1.5 dark:border-red-800 dark:bg-red-900/30"
    >
      <Icon name="lucide:alert-circle" class="h-3.5 w-3.5 text-red-500" />
      <span class="text-[13px] font-semibold text-red-600 dark:text-red-400">
        Maximum {{ limit }} characters
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    limit?: number;
    showLists?: boolean;
    showToolbar?: boolean;
    showItalic?: boolean;
    compact?: boolean;
    readonly?: boolean;
  }>(),
  {
    placeholder: "",
    limit: 500,
    showLists: true,
    showToolbar: true,
    showItalic: true,
    compact: false,
    readonly: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

// Convert Markdown to HTML for TipTap
const markdownToHtml = (md: string): string => {
  if (!md) return "";
  // If already HTML, return as-is
  if (/<[a-z][\s\S]*>/i.test(md)) return md;

  const withInlineFormatting = md
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic: *text*
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Bullet lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Wrap runs of consecutive `<li>` lines in `<ul>` via line-based grouping.
  // Avoids the catastrophic-backtracking regex `(<li>.*</li>\n?)+` flagged by
  // safe-regex; equivalent semantics and faster on long lists.
  const lines = withInlineFormatting.split("\n");
  const wrapped: string[] = [];
  let inList = false;
  for (const line of lines) {
    const isLi = line.startsWith("<li>") && line.endsWith("</li>");
    if (isLi && !inList) {
      wrapped.push("<ul>");
      inList = true;
    }
    if (!isLi && inList) {
      wrapped.push("</ul>");
      inList = false;
    }
    wrapped.push(
      isLi || !line || line.startsWith("<") ? line : `<p>${line}</p>`
    );
  }
  if (inList) wrapped.push("</ul>");
  return wrapped.join("");
};

// Convert HTML back to Markdown for storage
const htmlToMarkdown = (html: string): string => {
  if (!html) return "";
  return (
    html
      // Bold
      .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
      // Italic
      .replace(/<em>(.*?)<\/em>/g, "*$1*")
      // List items
      .replace(/<li>(.*?)<\/li>/g, "- $1\n")
      // Remove list wrappers
      .replace(/<\/?[uo]l>/g, "")
      // Paragraphs to newlines
      .replace(/<p>(.*?)<\/p>/g, "$1\n")
      // Line breaks
      .replace(/<br\s*\/?>/g, "\n")
      // Clean up multiple newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
};

const editor = useEditor({
  content: markdownToHtml(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      bulletList: props.showLists ? {} : false,
      orderedList: props.showLists ? {} : false,
      listItem: props.showLists ? {} : false,
    }),
    CharacterCount.configure({
      // No hard limit - allow typing beyond, show validation error instead
    }),
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
  ],
  editable: !props.readonly,
  editorProps: {
    attributes: {
      class: props.readonly
        ? "focus:outline-none"
        : props.compact
          ? "focus:outline-none min-h-[36px]"
          : "focus:outline-none min-h-[80px]",
    },
  },
  onUpdate: ({ editor: updatedEditor }) => {
    if (!props.readonly) {
      emit("update:modelValue", htmlToMarkdown(updatedEditor.getHTML()));
    }
  },
});

// Watch for external changes (incoming Markdown)
// Only update if the change came from outside (e.g., import)
watch(
  () => props.modelValue,
  (newValue) => {
    if (!editor.value) return;
    // Compare markdown values to avoid loop from our own emissions
    const currentMarkdown = htmlToMarkdown(editor.value.getHTML());
    if (currentMarkdown !== newValue) {
      editor.value.commands.setContent(markdownToHtml(newValue));
    }
  }
);

watch(
  [editor, () => props.readonly],
  ([currentEditor, readonly]) => currentEditor?.setEditable(!readonly),
  { immediate: true }
);

const charCount = computed(
  () => editor.value?.storage.characterCount.characters() ?? 0
);

const isOverLimit = computed(() => charCount.value > props.limit);

const charCountClass = computed(() => {
  const ratio = charCount.value / props.limit;
  if (ratio > 1) return "text-red-500 dark:text-red-400 font-semibold";
  if (ratio >= 0.95) return "text-red-500 dark:text-red-400";
  if (ratio >= 0.8) return "text-orange-500 dark:text-orange-400";
  return "text-dimmed";
});

// Expose error state for parent components
defineExpose({
  isOverLimit,
  charCount,
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
.rich-text-editor {
  overflow: hidden;
  border-radius: 7px;
  border-width: 1px;
  border-style: solid;
  border-color: var(--ui-border);
  /* Writing surface reads as white paper at rest (light mode); dark mode
     re-asserts its own value below, unchanged. */
  background-color: var(--ui-bg);
  transition: all 0.15s ease;
}

/* Light mode only: the toolbar is its own well, distinct from the paper
   surface beneath it — classic editor chrome-above-paper anatomy. Dark mode
   is untouched: the toolbar keeps blending into the container's dark bg. */
:root:not(.dark) .rich-text-editor__toolbar {
  background-color: var(--ui-bg-muted);
}

.rich-text-editor.is-readonly {
  border: none;
  background-color: transparent;
  cursor: default;
  border-radius: 0;
}

.rich-text-editor:hover {
  border-color: var(--ui-border-accented);
}

.rich-text-editor:focus-within {
  border-color: var(--ui-primary);
  background-color: var(--ui-bg);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ui-primary) 10%, transparent);
}

.rich-text-editor.has-error {
  border-style: solid;
  border-color: rgb(239 68 68);
}

.rich-text-editor.has-error:focus-within {
  border-color: rgb(239 68 68);
  box-shadow: 0 0 0 4px rgb(239 68 68 / 0.1);
}

:root.dark .rich-text-editor {
  border-color: rgb(71 85 105);
  background-color: rgb(51 65 85 / 0.3);
}

:root.dark .rich-text-editor:hover {
  border-color: rgb(100 116 139);
}

:root.dark .rich-text-editor:focus-within {
  border-color: var(--ui-primary);
  background-color: rgb(51 65 85);
}

:root.dark .rich-text-editor.is-readonly {
  background-color: transparent;
}

.rich-text-editor.is-readonly:hover,
.rich-text-editor.is-readonly:focus-within {
  border: none;
  box-shadow: none;
}

.rich-text-editor :deep(.tiptap) {
  font-size: 1rem;
  line-height: 1.625;
  color: var(--ui-text);
}

:root.dark .rich-text-editor :deep(.tiptap) {
  color: rgb(203 213 225);
}

.rich-text-editor :deep(.tiptap p.is-editor-empty:first-child::before) {
  color: var(--ui-text-dimmed);
  pointer-events: none;
  float: left;
  height: 0;
  content: attr(data-placeholder);
}

.rich-text-editor :deep(.tiptap ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
}

.rich-text-editor :deep(.tiptap ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
}

.rich-text-editor :deep(.tiptap li) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.rich-text-editor :deep(.tiptap strong) {
  font-weight: 600;
}

.rich-text-editor :deep(.tiptap em) {
  font-style: italic;
}
</style>
