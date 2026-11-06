import type { DirectoryGroup } from "#shared/catalog-directory-mirror";
import type {
  HelpfulLink,
  Template,
  TemplateRevisionDetail,
  TemplatePillar,
  TemplateQuestion,
} from "~/models";
import type { MarkdownImportConflict } from "~/composables/templates/storage/useTemplatePersistence";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export const template = ref<TemplateRevisionDetail | null>(null);
export const templateAggregate = ref<Template | null>(null);
export const activePillarSlug = ref<string | null>(null);
export const expandedQuestionId = ref<string | null>(null);
export const saveStatus = ref<SaveStatus>("idle");
export const lastSavedAt = ref<Date | null>(null);
export const isDirty = ref(false);
export const mutationGeneration = ref(0);
export const isLoading = ref(false);
export const localDraftId = ref<string | null>(null);
export const ownerTeams = ref<DirectoryGroup[]>([]);
export const ownerTeamId = ref<string | null>(null);
export const ownerTeamError = ref<string | null>(null);
export const hasEditEntitlement = ref(false);
export const importConflicts = ref<MarkdownImportConflict[]>([]);

export const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
export const scheduleAutoSaveHook = ref<(() => void) | null>(null);
/** Runs after every accepted mutation; reconciles maturity state (AC-050). */
export const reconcileMaturityHook = ref<
  ((draft: TemplateRevisionDetail) => void) | null
>(null);

export function setScheduleAutoSaveHook(hook: (() => void) | null) {
  scheduleAutoSaveHook.value = hook;
}
export function setMaturityReconcileHook(
  hook: ((draft: TemplateRevisionDetail) => void) | null
) {
  reconcileMaturityHook.value = hook;
}
export function setSaveTimeout(t: ReturnType<typeof setTimeout> | null) {
  saveTimeout.value = t;
}

export function getCurrentTemplate(): TemplateRevisionDetail | null {
  return template.value
    ? (JSON.parse(JSON.stringify(template.value)) as TemplateRevisionDetail)
    : null;
}

export function applyLoadedTemplate(
  loadedTemplate: TemplateRevisionDetail | null
) {
  const normalizedTemplate = loadedTemplate
    ? normalizeTemplateHelpfulLinks(loadedTemplate)
    : null;
  template.value = normalizedTemplate;
  activePillarSlug.value = normalizedTemplate?.pillars[0]?.slug ?? null;
  expandedQuestionId.value = null;
  isDirty.value = false;
  mutationGeneration.value = 0;
  saveStatus.value = "idle";
}

export function getQuestionSlug(pillarSlug: string, order: number) {
  const prefix = pillarSlug.toUpperCase().slice(0, 3);
  return `${prefix}-${order}`;
}

export function createTemplateQuestion(
  order: number,
  text: string,
  type: "yes-no" | "checklist"
): TemplateQuestion {
  const timestamp = Date.now();
  return {
    id: `q-${timestamp}`,
    order,
    type,
    text,
    riskLevel: "medium",
    importance: "",
    checklistItems: type === "checklist" ? [] : undefined,
    leadingPractices: [
      { id: `lp-${timestamp}`, order: 1, text: DEFAULT_PRACTICE },
    ],
    helpfulLinks: [DEFAULT_RESOURCE],
  };
}

export function markDirty() {
  mutationGeneration.value += 1;
  isDirty.value = true;
  saveStatus.value = "idle";
  scheduleAutoSaveHook.value?.();
}

export function withTemplateMutation(
  mutator: (draft: TemplateRevisionDetail) => unknown
) {
  if (
    !hasEditEntitlement.value ||
    !template.value ||
    template.value.status !== "draft" ||
    templateAggregate.value?.status === "archived"
  )
    return false;
  const didMutate = mutator(template.value) !== false;
  if (!didMutate) return false;
  reconcileMaturityHook.value?.(template.value);
  markDirty();
  return true;
}

export function withPillarMutation(
  pillarSlug: string,
  mutator: (pillar: TemplatePillar) => unknown
) {
  withTemplateMutation((draft) => {
    const pillar = draft.pillars.find((item) => item.slug === pillarSlug);
    if (!pillar) return false;
    return mutator(pillar);
  });
}

export function withQuestionMutation(
  pillarSlug: string,
  questionId: string,
  mutator: (question: TemplateQuestion) => unknown
) {
  withPillarMutation(pillarSlug, (pillar) => {
    const question = pillar.questions.find((item) => item.id === questionId);
    if (!question) return false;
    return mutator(question);
  });
}

export const DEFAULT_PRACTICE =
  "Run regular customers pain point review (sample)";
export const DEFAULT_RESOURCE = {
  id: "link-default-resource",
  order: 1,
  title: "Knowledge Hub (sample)",
  url: "https://www.adyen.com/knowledge-hub",
};

const createDurableLinkId = (link: Pick<HelpfulLink, "title" | "url">) => {
  const seed = `${link.title.trim().toLowerCase()}|${link.url.trim().toLowerCase()}`;
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `link-${hash.toString(36)}`;
};

export const normalizeHelpfulLinks = (
  links: HelpfulLink[] = []
): HelpfulLink[] => {
  const usedIds = new Set<string>();
  return links.map((link, index) => {
    let id = link.id?.trim() || createDurableLinkId(link);
    while (usedIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    usedIds.add(id);
    return { ...link, id, order: index + 1 };
  });
};

export const normalizeTemplateHelpfulLinks = (
  sourceTemplate: TemplateRevisionDetail
): TemplateRevisionDetail => ({
  ...sourceTemplate,
  pillars: sourceTemplate.pillars.map((pillar) => ({
    ...pillar,
    questions: pillar.questions.map((question) => ({
      ...question,
      helpfulLinks: normalizeHelpfulLinks(question.helpfulLinks),
    })),
  })),
});
