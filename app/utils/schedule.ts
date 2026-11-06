export interface IdleTaskOptions {
  delayMs?: number;
  timeoutMs?: number;
}

export function scheduleWhenBrowserIdle(
  task: () => void | Promise<void>,
  options: IdleTaskOptions = {}
): void {
  if (!import.meta.client || typeof window === "undefined") {
    return;
  }

  const delayMs = options.delayMs ?? 0;
  void options.timeoutMs;
  window.setTimeout(() => void task(), delayMs);
}
