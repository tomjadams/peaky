import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/vue";
import { ref } from "vue";
import RichTextEditor from "~/components/template-studio/RichTextEditor.vue";

const editor = vi.hoisted(() => ({
  setEditable: vi.fn(),
  isActive: vi.fn(() => false),
  getHTML: vi.fn(() => "<p>Question text</p>"),
  commands: { setContent: vi.fn() },
  storage: { characterCount: { characters: vi.fn(() => 13) } },
  destroy: vi.fn(),
}));

vi.mock("@tiptap/vue-3", () => ({
  EditorContent: { template: "<div />" },
  useEditor: () => ref(editor),
}));
vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: vi.fn(() => ({})) },
}));
vi.mock("@tiptap/extension-character-count", () => ({
  default: { configure: vi.fn(() => ({})) },
}));
vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: vi.fn(() => ({})) },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("updates the editor when access changes after the component mounts", async () => {
  const view = render(RichTextEditor, {
    props: { modelValue: "Question text", readonly: false },
  });

  await view.rerender({ readonly: true });
  await waitFor(() =>
    expect(editor.setEditable).toHaveBeenLastCalledWith(false)
  );

  await view.rerender({ readonly: false });
  await waitFor(() =>
    expect(editor.setEditable).toHaveBeenLastCalledWith(true)
  );
});
