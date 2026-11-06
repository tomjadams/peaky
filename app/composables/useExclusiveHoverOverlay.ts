import { computed, onMounted, onUnmounted, ref } from "vue";

const activeOverlayId = ref<symbol | null>(null);
let suppressOpenUntil = 0;
let keyboardInputActive = false;

export function useExclusiveHoverOverlay() {
  const id = Symbol("hover-overlay");
  const pointerInTrigger = ref(false);
  const focusWithin = ref(false);
  const escapeDismissed = ref(false);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let triggerElement: HTMLElement | null = null;

  const isOpen = computed(
    () => activeOverlayId.value === id && !escapeDismissed.value
  );

  const cancelClose = () => {
    if (closeTimer === null) return;
    clearTimeout(closeTimer);
    closeTimer = null;
  };

  const activate = () => {
    cancelClose();
    if (Date.now() < suppressOpenUntil) return;
    escapeDismissed.value = false;
    activeOverlayId.value = id;
  };

  const close = () => {
    cancelClose();
    if (activeOverlayId.value === id) activeOverlayId.value = null;
    if (!pointerInTrigger.value && !focusWithin.value) {
      setTimeout(clearPointerFocus, 0);
    }
  };

  const scheduleClose = () => {
    cancelClose();
    if (focusWithin.value) return;
    closeTimer = setTimeout(() => {
      if (!pointerInTrigger.value) close();
    }, 30);
  };

  const handleTriggerEnter = (event: MouseEvent) => {
    keyboardInputActive = false;
    triggerElement = event.currentTarget as HTMLElement;
    pointerInTrigger.value = true;
    activate();
  };

  const clearPointerFocus = () => {
    const trigger = triggerElement;
    if (!keyboardInputActive && trigger && document.activeElement === trigger) {
      trigger.blur();
    }
  };

  const handleTriggerLeave = () => {
    pointerInTrigger.value = false;
    clearPointerFocus();
    scheduleClose();
  };

  const handleFocus = (event: FocusEvent) => {
    const target = event.currentTarget as HTMLElement | null;
    focusWithin.value =
      keyboardInputActive && Boolean(target?.matches(":focus-visible"));
    if (focusWithin.value) activate();
  };

  const handleBlur = () => {
    focusWithin.value = false;
    scheduleClose();
  };

  const handleClick = () => {
    activate();
  };

  const handleEscape = () => {
    suppressOpenUntil = Date.now() + 160;
    escapeDismissed.value = true;
    close();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      close();
      return;
    }
    if (pointerInTrigger.value || focusWithin.value) activate();
  };

  const handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === "Tab") keyboardInputActive = true;
    if (event.key === "Escape" && activeOverlayId.value === id) handleEscape();
  };
  const handleDocumentPointerdown = () => {
    keyboardInputActive = false;
  };
  const handleDocumentPointermove = (event: PointerEvent) => {
    keyboardInputActive = false;
    if (activeOverlayId.value !== id || !triggerElement) return;
    const target = event.target;
    if (target instanceof Node && triggerElement.contains(target)) return;
    pointerInTrigger.value = false;
    clearPointerFocus();
    scheduleClose();
  };

  onMounted(() => {
    window.addEventListener("keydown", handleDocumentKeydown, true);
    window.addEventListener("pointerdown", handleDocumentPointerdown, true);
    window.addEventListener("pointermove", handleDocumentPointermove, true);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleDocumentKeydown, true);
    window.removeEventListener("pointerdown", handleDocumentPointerdown, true);
    window.removeEventListener("pointermove", handleDocumentPointermove, true);
    triggerElement = null;
    cancelClose();
    if (activeOverlayId.value === id) activeOverlayId.value = null;
  });

  return {
    isOpen,
    handleTriggerEnter,
    handleTriggerLeave,
    handleFocus,
    handleBlur,
    handleClick,
    handleEscape,
    handleOpenChange,
  };
}
