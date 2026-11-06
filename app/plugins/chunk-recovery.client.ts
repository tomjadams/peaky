import {
  clearAndHardReload,
  shouldRecoverFromChunkError,
} from "~/utils/browserCache";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:chunkError", () => {
    if (shouldRecoverFromChunkError()) {
      void clearAndHardReload().catch(() => {});
    }
  });
});
