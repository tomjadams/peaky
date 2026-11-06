import type { Breadcrumb } from "~/models/breadcrumb";

/**
 * Label overrides for top-level routes whose auto-derived label
 * (capitalised first path segment) isn't quite right. Keep this list
 * SHORT — most routes should rely on the auto-derive below so adding a
 * new top-level page doesn't require touching this file.
 *
 * Add an entry only when the path-segment heuristic produces something
 * misleading or terse. For example, "/schemas" auto-derives to "Schemas"
 * but the page is conceptually "Event Schemas" in our nav.
 */
const TOP_LEVEL_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
  schemas: "Event Schemas",
};

function capitaliseFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Resolve the root breadcrumb for any application path.
 *
 * Behaviour:
 * - `/` returns the "Home" pseudo-root — the landing/concept page.
 * - For any non-root path we take the FIRST path segment, look it up in
 *   `TOP_LEVEL_LABEL_OVERRIDES`, and fall back to the capitalised
 *   segment when no override is registered.
 *
 * This is what makes adding a new top-level route (e.g. `/system`)
 * safe by default: the breadcrumb is derived from the URL itself, so
 * the worst that can happen for a missing override is a single-word
 * label that matches the path. No silent fallback to a different
 * top-level section like the previous "everything else lands on Teams"
 * behaviour.
 */
export function getDefaultRootBreadcrumb(path: string): Breadcrumb {
  if (path === "/" || path === "") {
    return { label: "Home", to: "/" };
  }

  const firstSegment = path.split("/").find(Boolean);
  if (!firstSegment) {
    return { label: "Home", to: "/" };
  }

  const overrideLabel = TOP_LEVEL_LABEL_OVERRIDES[firstSegment];
  return {
    label: overrideLabel ?? capitaliseFirst(firstSegment),
    to: `/${firstSegment}`,
  };
}

function buildBreadcrumbs(route: ReturnType<typeof useRoute>): Breadcrumb[] {
  const routeBreadcrumbs: Breadcrumb[] = route.matched
    .filter((record) => record.meta.breadcrumb)
    .map((record, index, arr) => {
      const meta = record.meta.breadcrumb as {
        label: string | ((currentRoute: typeof route) => string);
      };

      const label =
        typeof meta.label === "function" ? meta.label(route) : meta.label;

      let path = record.path;

      Object.entries(route.params).forEach(([key, value]) => {
        path = path.replace(`:${key}()`, value as string);
        path = path.replace(`:${key}`, value as string);
      });

      const isCurrentPage = index === arr.length - 1;

      return {
        label,
        to: isCurrentPage ? undefined : path,
      };
    });

  const defaultRoot = getDefaultRootBreadcrumb(route.path);

  if (routeBreadcrumbs.length === 0) {
    return [defaultRoot];
  }

  if (routeBreadcrumbs[0]?.label !== defaultRoot.label) {
    routeBreadcrumbs.unshift(defaultRoot);
  }

  return routeBreadcrumbs;
}

export const useBreadcrumbs = () => {
  const route = useRoute();
  const overrideBreadcrumbs = useState<Breadcrumb[] | null>(
    "ui-breadcrumbs-override",
    () => null
  );

  const setBreadcrumbs = (next?: Breadcrumb[]) => {
    overrideBreadcrumbs.value = next && next.length > 0 ? [...next] : null;
  };

  const resetBreadcrumbs = () => {
    overrideBreadcrumbs.value = null;
  };

  return {
    breadcrumbs: computed(() => {
      return overrideBreadcrumbs.value ?? buildBreadcrumbs(route);
    }),
    setBreadcrumbs,
    resetBreadcrumbs,
  };
};
