/**
 * Featured Templates shown as a pinned hero at the top of the New Review
 * wizard's template shelves (see ReviewWizardTemplateStep.vue).
 *
 * Kept as data, not code, so a campaign (e.g. "Peak season readiness") can be
 * turned on/off without touching the wizard. If a configured `templateId`
 * has no current published revision, its entry is silently skipped — the
 * shelf never renders a broken hero.
 */

export interface FeaturedTemplateConfig {
  templateId: string;
  note: string;
}

export const FEATURED_TEMPLATES: FeaturedTemplateConfig[] = [
  {
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    note: "Peak season · required",
  },
];
