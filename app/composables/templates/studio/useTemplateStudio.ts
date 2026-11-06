import type { Template, TemplateRevisionDetail } from "~/models";
import {
  fetchLocalTemplateDraftRecordById,
  fetchLocalTemplateRevisionRecordById,
} from "~/composables/local/useLocalTemplateDraft";
import { fetchPersistedDirectoryGroups } from "~/catalog-directory-mirror/local";
import { persistPublishedTemplateRevisions } from "~/services/template/TemplateRevisionSnapshotCache";
import {
  canEditTemplateDraft,
  createEmptyTemplate,
  fetchTemplateAuthoringDetail,
  publishTemplateDraft,
} from "~/composables/templates/domain/useTemplateCatalog";
import {
  importTemplateMarkdown,
  resolveTemplateImportConflict,
  saveTemplateDraftMetadata,
  type MarkdownImportConflict,
} from "~/composables/templates/storage/useTemplatePersistence";

import {
  template,
  templateAggregate,
  activePillarSlug,
  expandedQuestionId,
  saveStatus,
  lastSavedAt,
  isDirty,
  isLoading,
  localDraftId,
  ownerTeams,
  ownerTeamId,
  ownerTeamError,
  hasEditEntitlement,
  importConflicts,
  saveTimeout,
  setSaveTimeout,
  setScheduleAutoSaveHook,
  applyLoadedTemplate,
  getQuestionSlug,
  markDirty,
  withTemplateMutation,
  normalizeTemplateHelpfulLinks,
} from "./useTemplateStudio-state";
import {
  advanceStudioSession,
  isCurrentStudioSaveInFlight,
  isStudioSessionCurrent,
  saveTemplate,
  saveTemplateLocal,
  scheduleAutoSave,
} from "./useTemplateStudio-save";
import {
  loadMaturityForTemplate,
  maturityDefinition,
  maturityIssues,
  maturitySaveIssues,
  registerMaturityHooks,
  scorableQuestions,
  withMaturityMutation,
  workedExample,
} from "./useTemplateStudio-maturity";
import {
  addPillar,
  updatePillar,
  deletePillar,
  reorderPillars,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} from "./useTemplateStudio-structure";
import {
  addPractice,
  updatePractice,
  deletePractice,
  reorderPractices,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  addLink,
  updateLink,
  deleteLink,
  reorderLinks,
} from "./useTemplateStudio-content";

export type { SaveStatus } from "./useTemplateStudio-state";

const ownerTeamOptions = computed(() =>
  ownerTeams.value.map((team) => ({ label: team.displayName, value: team.id }))
);

const setOwnerTeamId = (id: string | null) => {
  if (
    localDraftId.value ||
    isCurrentStudioSaveInFlight() ||
    ownerTeamId.value === id
  )
    return;
  ownerTeamId.value = id;
  ownerTeamError.value = null;
  markDirty();
};

const loadOwnerTeams = () => fetchPersistedDirectoryGroups();

const createEmptyTemplateAggregate = (
  revision: TemplateRevisionDetail
): Template => ({
  id: "",
  name: revision.name,
  description: revision.description,
  status: "active",
  ownerTeamId: "",
  createdByActorId: "",
  updatedByActorId: "",
  createdAt: revision.createdAt,
  updatedAt: revision.updatedAt,
});

// Module-scope helpers — they reference only module-level bindings (imported
// refs, imported services). Hoisted so the composable's return value exposes
// stable references and to satisfy `unicorn/consistent-function-scoping`.

const setTemplate = (nextTemplate: TemplateRevisionDetail) => {
  applyLoadedTemplate(nextTemplate);
  if (template.value) loadMaturityForTemplate(template.value);
};

const setActivePillar = (slug: string) => {
  activePillarSlug.value = slug;
  expandedQuestionId.value = null;
};

const setExpandedQuestion = (questionId: string | null) => {
  expandedQuestionId.value = questionId;
};

const markSaving = () => {
  saveStatus.value = "saving";
};

const markSaved = () => {
  saveStatus.value = "saved";
  lastSavedAt.value = new Date();
  isDirty.value = false;
};

const updateTemplateName = (name: string) => {
  withTemplateMutation((draft) => {
    draft.name = name;
  });
};

const updateTemplateDescription = (description: string) => {
  withTemplateMutation((draft) => {
    draft.description = description;
  });
};

const importTemplate = (imported: Partial<TemplateRevisionDetail>) => {
  withTemplateMutation((draft) => {
    if (imported.name) draft.name = imported.name;
    if (imported.description) draft.description = imported.description;
    if (imported.pillars) {
      draft.pillars = normalizeTemplateHelpfulLinks({
        ...draft,
        pillars: imported.pillars,
      }).pillars;
      activePillarSlug.value = imported.pillars[0]?.slug ?? null;
      expandedQuestionId.value = null;
    }
  });
};

const importTemplateFromMarkdown = async (
  imported: Partial<TemplateRevisionDetail>
): Promise<MarkdownImportConflict[]> => {
  const currentTemplate = template.value;
  if (!currentTemplate) return [];
  localDraftId.value = await saveTemplateDraftMetadata(
    {
      name: currentTemplate.name,
      description: currentTemplate.description,
    },
    localDraftId.value
  );
  const conflicts = await importTemplateMarkdown(localDraftId.value, imported);
  importConflicts.value = conflicts;
  importTemplate(imported);
  return conflicts;
};

const publishTemplate = async () => {
  const templateId = templateAggregate.value?.id ?? template.value?.templateId;
  if (!templateId) {
    return { success: false, errors: ["Template must be saved first"] };
  }
  return publishTemplateDraft(templateId);
};

const resolveImportConflict = async (
  conflict: MarkdownImportConflict,
  resolution: "keep_local" | "keep_imported" | "merged"
) => {
  if (!localDraftId.value) return;
  await resolveTemplateImportConflict(localDraftId.value, conflict, resolution);
  importConflicts.value = importConflicts.value.map((item) =>
    item.localId === conflict.localId && item.type === conflict.type
      ? { ...item, resolution }
      : item
  );
};

type StudioTemplateRecord = {
  aggregate: Template;
  ownerTeamId: Template["ownerTeamId"];
  template: TemplateRevisionDetail;
};

const applyStudioRecord = async (
  record: StudioTemplateRecord,
  loadSession: number
) => {
  const canEdit = await canEditTemplateDraft(record.aggregate.id);
  if (!isStudioSessionCurrent(loadSession)) return;
  hasEditEntitlement.value = canEdit;
  templateAggregate.value = record.aggregate;
  ownerTeamId.value = record.ownerTeamId;
  applyLoadedTemplate(record.template);
  if (template.value) loadMaturityForTemplate(template.value);
};

const loadNewTemplate = async (
  ownerTeamsPromise: ReturnType<typeof loadOwnerTeams>,
  loadSession: number
) => {
  const loadedOwnerTeams = await ownerTeamsPromise;
  if (!isStudioSessionCurrent(loadSession)) return;
  ownerTeams.value = loadedOwnerTeams;
  ownerTeamError.value = null;
  const emptyRevision = createEmptyTemplate();
  localDraftId.value = null;
  hasEditEntitlement.value = true;
  templateAggregate.value = createEmptyTemplateAggregate(emptyRevision);
  applyLoadedTemplate(emptyRevision);
  if (template.value) loadMaturityForTemplate(template.value);
};

const loadExistingTemplate = async (
  id: string,
  ownerTeamsPromise: ReturnType<typeof loadOwnerTeams>,
  loadSession: number
) => {
  const [loadedOwnerTeams, localDraft] = await Promise.all([
    ownerTeamsPromise,
    fetchLocalTemplateDraftRecordById(id),
  ]);
  if (!isStudioSessionCurrent(loadSession)) return;
  ownerTeams.value = loadedOwnerTeams;
  ownerTeamError.value = null;
  localDraftId.value = localDraft?.draftId ?? null;
  if (localDraft) {
    await applyStudioRecord(
      {
        aggregate: localDraft.aggregate ?? {
          ...createEmptyTemplateAggregate(localDraft.template),
          id: localDraft.template.templateId,
          ownerTeamId: localDraft.ownerTeamId,
        },
        ownerTeamId: localDraft.ownerTeamId,
        template: localDraft.template,
      },
      loadSession
    );
    return;
  }

  const localRevision = await fetchLocalTemplateRevisionRecordById(id);
  if (!isStudioSessionCurrent(loadSession)) return;
  if (localRevision) {
    await applyStudioRecord(localRevision, loadSession);
    return;
  }

  const remote = await fetchTemplateAuthoringDetail(id);
  if (!isStudioSessionCurrent(loadSession)) return;
  if (!remote.revision) throw new Error("Template revision is unavailable");
  if (
    remote.revision.status === "published" &&
    remote.template.status === "active"
  ) {
    await persistPublishedTemplateRevisions([remote]);
    if (!isStudioSessionCurrent(loadSession)) return;
  }
  await applyStudioRecord(
    {
      aggregate: remote.template,
      ownerTeamId: remote.template.ownerTeamId,
      template: remote.revision,
    },
    loadSession
  );
};

const loadTemplate = async (id: string, force = false) => {
  if (!force && template.value?.id === id && !isLoading.value) return;
  const loadSession = advanceStudioSession();
  if (saveTimeout.value) clearTimeout(saveTimeout.value);
  setSaveTimeout(null);
  isLoading.value = true;
  ownerTeamId.value = null;
  hasEditEntitlement.value = false;
  try {
    const ownerTeamsPromise = loadOwnerTeams();
    if (id === "new") await loadNewTemplate(ownerTeamsPromise, loadSession);
    else await loadExistingTemplate(id, ownerTeamsPromise, loadSession);
  } finally {
    if (isStudioSessionCurrent(loadSession)) isLoading.value = false;
  }
};

export const useTemplateStudio = () => {
  setScheduleAutoSaveHook(scheduleAutoSave);
  registerMaturityHooks();

  const canEditDraft = computed(
    () =>
      hasEditEntitlement.value && templateAggregate.value?.status === "active"
  );
  const isEditable = computed(
    () => canEditDraft.value && template.value?.status === "draft"
  );

  const activePillar = computed(() => {
    if (!template.value || !activePillarSlug.value) return null;
    return (
      template.value.pillars.find((p) => p.slug === activePillarSlug.value) ??
      null
    );
  });

  return {
    template: shallowReadonly(template),
    templateAggregate: shallowReadonly(templateAggregate),
    canEditDraft,
    isEditable,
    activePillar,
    activePillarSlug: shallowReadonly(activePillarSlug),
    expandedQuestionId,
    saveStatus: shallowReadonly(saveStatus),
    lastSavedAt: shallowReadonly(lastSavedAt),
    isDirty: shallowReadonly(isDirty),
    isLoading: shallowReadonly(isLoading),
    localDraftId: shallowReadonly(localDraftId),
    ownerTeamId: shallowReadonly(ownerTeamId),
    ownerTeamOptions,
    ownerTeamError: shallowReadonly(ownerTeamError),
    importConflicts: shallowReadonly(importConflicts),
    maturityDefinition: shallowReadonly(maturityDefinition),
    scorableQuestions,
    maturityIssues,
    maturitySaveIssues: shallowReadonly(maturitySaveIssues),
    workedExample,
    withMaturityMutation,
    loadTemplate,
    setOwnerTeamId,
    setActivePillar,
    setExpandedQuestion,
    scheduleAutoSave,
    saveTemplate,
    saveTemplateLocal,
    publishTemplate,
    updateTemplateName,
    updateTemplateDescription,
    importTemplate,
    importTemplateFromMarkdown,
    resolveImportConflict,
    setTemplate,
    markSaving,
    markSaved,
    addPillar,
    updatePillar,
    deletePillar,
    reorderPillars,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    addPractice,
    updatePractice,
    deletePractice,
    reorderPractices,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
    reorderChecklistItems,
    addLink,
    updateLink,
    deleteLink,
    reorderLinks,
    getQuestionSlug,
  };
};
