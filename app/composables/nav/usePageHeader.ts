import { getDefaultRootBreadcrumb } from "~/composables/nav/useBreadcrumbs";

interface HeaderCTA {
  label: string;
  icon: string;
  onClick: () => void;
  loading?: boolean;
}

/**
 * Resolve the deepest matched route record carrying a `pageHeader` meta
 * block, if any. Reading route meta is synchronous and available before
 * any component's `<script setup>` has run, so this is safe to call from
 * AppHeader on its very first (SSR) render — unlike a title set imperatively
 * from the page component, which only lands after the page's own setup
 * executes (too late: the layout's header has already rendered by then).
 */
function getPageHeaderMeta(
  route: ReturnType<typeof useRoute>
): { title: string; showSurveyMode?: boolean } | undefined {
  const currentRecord = [...route.matched]
    .toReversed()
    .find((record) => record.meta.pageHeader);

  // Same cast the `breadcrumb` lookup below needs: PageMeta's index
  // signature widens every field (this one included) to `unknown` at the
  // `route.meta` access site, regardless of the module augmentation.
  return currentRecord?.meta.pageHeader as
    | { title: string; showSurveyMode?: boolean }
    | undefined;
}

function getDefaultPageHeaderTitle(route: ReturnType<typeof useRoute>): string {
  const pageHeader = getPageHeaderMeta(route);
  if (pageHeader) return pageHeader.title;

  const currentRecord = [...route.matched]
    .toReversed()
    .find((record) => record.meta.breadcrumb);

  const breadcrumb = currentRecord?.meta.breadcrumb as
    | { label: string | ((currentRoute: typeof route) => string) }
    | undefined;

  if (breadcrumb) {
    return typeof breadcrumb.label === "function"
      ? breadcrumb.label(route)
      : breadcrumb.label;
  }

  return getDefaultRootBreadcrumb(route.path).label;
}

function getDefaultShowSurveyMode(route: ReturnType<typeof useRoute>): boolean {
  return getPageHeaderMeta(route)?.showSurveyMode ?? false;
}

// Function-valued CTA state stays client-only; serializing it through useState
// would drop the callback during hydration.
const headerCTA = ref<HeaderCTA | null>(null);

export const usePageHeader = () => {
  const route = useRoute();
  const title = useState<string>("pageHeaderTitle", () =>
    getDefaultPageHeaderTitle(route)
  );
  const showSurveyMode = useState<boolean>("pageHeaderShowSurveyMode", () =>
    getDefaultShowSurveyMode(route)
  );

  watch(
    () => route.path,
    () => {
      title.value = getDefaultPageHeaderTitle(route);
      showSurveyMode.value = getDefaultShowSurveyMode(route);
      if (import.meta.client) headerCTA.value = null;
    },
    { flush: "sync" }
  );

  const setPageHeader = (options: {
    title: string;
    showSurveyMode?: boolean;
  }) => {
    title.value = options.title;
    showSurveyMode.value = options.showSurveyMode ?? false;
  };

  const setCTA = (cta: HeaderCTA | null) => {
    if (import.meta.server) return;
    headerCTA.value = cta;
  };

  return {
    title: readonly(title),
    showSurveyMode: readonly(showSurveyMode),
    headerCTA: readonly(headerCTA),
    setPageHeader,
    setCTA,
  };
};
