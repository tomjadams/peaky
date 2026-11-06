/**
 * Build health endpoint.
 *
 * Returns the current server-side build ID so browser clients can detect a
 * replacement deployment before they request obsolete client chunks. This
 * route lives under `/api` because Vercel reserves root paths beginning with
 * an underscore.
 */
export default defineEventHandler(() => {
  const config = useRuntimeConfig();
  return {
    buildId: (config.app as { buildId?: string }).buildId ?? "dev",
  };
});
