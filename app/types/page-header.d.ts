declare module "#app" {
  interface PageMeta {
    /**
     * Declarative page header, read by AppHeader before any page-level
     * `<script setup>` runs. Prefer this over an imperative
     * `setPageHeader()` call whenever the title is a static string — it's
     * available on the very first (SSR) read of the header state, so the
     * server-rendered h1 always matches what hydration expects.
     *
     * Reach for `setPageHeader()` instead only when the title depends on
     * data loaded after mount (e.g. a team or product name) — those are
     * safe post-hydration updates and don't need this.
     */
    pageHeader?: {
      title: string;
      showSurveyMode?: boolean;
    };
  }
}
