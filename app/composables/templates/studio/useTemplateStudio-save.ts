import type { TeamId } from "~/models";
import {
  createLocalTemplateDraft,
  fetchLocalTemplateDraftRecordById,
} from "~/composables/local/useLocalTemplateDraft";
import { readPersistedActor } from "~/composables/auth/useCurrentActor";
import { canEditTemplateDraft } from "~/composables/templates/domain/useTemplateCatalog";
import { saveLocalTemplateDraft } from "~/composables/templates/storage/useTemplatePersistence";
import {
  getCurrentTemplate,
  hasEditEntitlement,
  isDirty,
  lastSavedAt,
  localDraftId,
  mutationGeneration,
  ownerTeamError,
  ownerTeamId,
  ownerTeams,
  saveStatus,
  saveTimeout,
  setSaveTimeout,
  template,
  templateAggregate,
} from "./useTemplateStudio-state";
import { assertMaturitySaveable } from "./useTemplateStudio-maturity";

const OWNER_TEAM_ERROR =
  "Select an owner Team from the persisted directory snapshot";
let saveInFlight: Promise<boolean> | null = null;
let saveSessionInFlight: number | null = null;
let studioSession = 0;

export const advanceStudioSession = (): number => {
  studioSession += 1;
  return studioSession;
};

export const isStudioSessionCurrent = (session: number): boolean =>
  session === studioSession;

export const isCurrentStudioSaveInFlight = (): boolean =>
  saveSessionInFlight === studioSession;

const hasValidOwnerTeam = () =>
  ownerTeamId.value !== null &&
  ownerTeams.value.some((team) => team.id === ownerTeamId.value);

async function resolveSavedDraft(
  savedDraftId: string,
  previousDraftId: string | null,
  saveSession: number,
  savedGeneration: number
): Promise<boolean> {
  if (!isStudioSessionCurrent(saveSession)) return false;
  localDraftId.value = savedDraftId;
  if (previousDraftId) return true;

  const created = await fetchLocalTemplateDraftRecordById(savedDraftId);
  if (!isStudioSessionCurrent(saveSession)) return false;
  if (!created) return true;

  templateAggregate.value = created.aggregate;
  const current = template.value;
  // The serialized maturity document is a mutation projection; the freshly
  // re-read record may predate it, so carry the outgoing document forward.
  const maturityDefinition =
    current?.maturityDefinition ?? created.template.maturityDefinition;
  template.value =
    current && mutationGeneration.value !== savedGeneration
      ? {
          ...created.template,
          name: current.name,
          description: current.description,
          maturityDefinition,
          pillars: current.pillars.map((pillar) =>
            Object.assign({}, pillar, { templateRevisionId: savedDraftId })
          ),
        }
      : { ...created.template, maturityDefinition };
  return true;
}

async function persistDraft(
  saveSession: number,
  savedGeneration: number
): Promise<boolean> {
  const currentTemplate = getCurrentTemplate();
  if (!currentTemplate) return true;
  const currentDraftId = localDraftId.value;
  const currentOwnerTeamId = ownerTeamId.value;

  if (!currentDraftId && !hasValidOwnerTeam()) {
    ownerTeamError.value = OWNER_TEAM_ERROR;
    saveStatus.value = "error";
    return false;
  }
  if (!isDirty.value) return true;
  if (currentDraftId && templateAggregate.value?.id) {
    const canEdit = await canEditTemplateDraft(templateAggregate.value.id);
    if (!isStudioSessionCurrent(saveSession)) return false;
    hasEditEntitlement.value = canEdit;
    if (!canEdit) {
      saveStatus.value = "error";
      return false;
    }
  }

  const savedDraftId = currentDraftId
    ? await saveLocalTemplateDraft(currentTemplate, currentDraftId)
    : await createLocalTemplateDraft({
        name: currentTemplate.name,
        description: currentTemplate.description,
        ownerTeamId: currentOwnerTeamId as TeamId,
        actorId: readPersistedActor().id,
        maturityDefinition: currentTemplate.maturityDefinition,
        pillars: currentTemplate.pillars,
      });
  return resolveSavedDraft(
    savedDraftId,
    currentDraftId,
    saveSession,
    savedGeneration
  );
}

const performTemplateSave = async (): Promise<boolean> => {
  if (!isDirty.value) return true;
  // An invalid maturity definition blocks the local save with
  // field-addressable issues (maturity-score/AC-063).
  if (!assertMaturitySaveable()) return false;
  const saveSession = studioSession;
  const savedGeneration = mutationGeneration.value;
  saveStatus.value = "saving";
  try {
    if (!(await persistDraft(saveSession, savedGeneration))) return false;
    if (!isStudioSessionCurrent(saveSession)) return true;
    if (template.value && !template.value.id && localDraftId.value) {
      template.value = { ...template.value, id: localDraftId.value };
    }
    ownerTeamError.value = null;
    lastSavedAt.value = new Date();
    if (mutationGeneration.value === savedGeneration) {
      saveStatus.value = "saved";
      isDirty.value = false;
    } else {
      saveStatus.value = "idle";
    }
    return true;
  } catch (error) {
    if (!isStudioSessionCurrent(saveSession)) return false;
    if (error instanceof Error && /owner team/i.test(error.message)) {
      ownerTeamError.value = OWNER_TEAM_ERROR;
    }
    saveStatus.value = "error";
    return false;
  }
};

export const saveTemplateLocal = (): Promise<boolean> => {
  if (saveInFlight) {
    return saveInFlight.then((result) =>
      isDirty.value ? saveTemplateLocal() : result
    );
  }
  saveSessionInFlight = studioSession;
  saveInFlight = performTemplateSave().finally(() => {
    saveInFlight = null;
    saveSessionInFlight = null;
  });
  return saveInFlight;
};

export const scheduleAutoSave = () => {
  if (saveTimeout.value) clearTimeout(saveTimeout.value);
  setSaveTimeout(
    setTimeout(() => {
      setSaveTimeout(null);
      void saveTemplateLocal();
    }, 2000)
  );
};

export const saveTemplate = async (): Promise<boolean> => {
  if (saveTimeout.value) clearTimeout(saveTimeout.value);
  setSaveTimeout(null);
  return saveTemplateLocal();
};
