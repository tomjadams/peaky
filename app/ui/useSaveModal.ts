import type { SessionSnapshot, SessionChange } from "~/models";

interface SaveModalContext {
  reviewId: string;
  templateId: string;
  sessionChanges: SessionChange[];
  snapshot: SessionSnapshot;
}

interface SaveModalState {
  isOpen: boolean;
  context: SaveModalContext | null;
}

// Module-scoped singleton — same pattern as useNAModal
const state = ref<SaveModalState>({ isOpen: false, context: null });
let resolveFn: ((comment: string | null) => void) | null = null;

export function useSaveModal() {
  /**
   * Opens the modal and returns a Promise that resolves with the user's
   * comment string on confirm, or null if cancelled.
   */
  const open = (context: SaveModalContext): Promise<string | null> => {
    state.value = { isOpen: true, context };
    return new Promise((resolve) => {
      resolveFn = resolve;
    });
  };

  const confirm = (comment: string) => {
    state.value.isOpen = false;
    resolveFn?.(comment);
    resolveFn = null;
    setTimeout(() => {
      state.value.context = null;
    }, 300);
  };

  const cancel = () => {
    state.value.isOpen = false;
    resolveFn?.(null);
    resolveFn = null;
    setTimeout(() => {
      state.value.context = null;
    }, 300);
  };

  // Writable computed so UModal's v-model:open can call cancel() on close
  const isOpen = computed({
    get: () => state.value.isOpen,
    set: (val: boolean) => {
      if (!val) cancel();
    },
  });

  return {
    isOpen,
    context: computed(() => state.value.context),
    open,
    confirm,
    cancel,
  };
}
