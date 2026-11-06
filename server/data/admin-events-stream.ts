type AdminEventsListener = (payload: { type: "refresh"; time: string }) => void;

const adminEventsListeners = new Set<AdminEventsListener>();

export function subscribeToAdminEvents(
  listener: AdminEventsListener
): () => void {
  adminEventsListeners.add(listener);

  return () => {
    adminEventsListeners.delete(listener);
  };
}

export function notifyAdminEventsUpdated(): void {
  const payload = {
    type: "refresh" as const,
    time: new Date().toISOString(),
  };

  for (const listener of adminEventsListeners) {
    listener(payload);
  }
}

export function clearAdminEventsListeners(): void {
  adminEventsListeners.clear();
}
