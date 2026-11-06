/**
 * Generic composable for handling bulk actions on resources
 * Provides a consistent pattern for bulk operations with error handling
 */
export function useBulkActions<T = unknown>(resourcePath: string) {
  const loading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * Execute a bulk action
   * @param action - The action name (e.g., 'transfer', 'archive', 'delete')
   * @param ids - Array of resource IDs to act upon
   * @param payload - Additional data for the action
   */
  const executeBulkAction = async (
    action: string,
    ids: string[],
    payload?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: T; error?: Error }> => {
    if (ids.length === 0) {
      return { success: false, error: new Error("No items selected") };
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch(`${resourcePath}/bulk/${action}`, {
        method: "POST",
        body: {
          ids,
          ...payload,
        },
      });

      loading.value = false;
      return { success: true, data: response as T };
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      error.value = errorObj;
      loading.value = false;
      return { success: false, error: errorObj };
    }
  };

  /**
   * Convenience methods for common bulk actions
   */
  const bulkTransfer = (ids: string[], newOwner: string) =>
    executeBulkAction("transfer", ids, { newOwner });

  const bulkArchive = (ids: string[]) => executeBulkAction("archive", ids);

  const bulkDelete = (ids: string[]) => executeBulkAction("delete", ids);

  return {
    loading,
    error,
    executeBulkAction,
    bulkTransfer,
    bulkArchive,
    bulkDelete,
  };
}
