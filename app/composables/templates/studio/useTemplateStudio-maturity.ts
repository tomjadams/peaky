/**
 * Studio maturity state (maturity-score/REQ-009, REQ-010, REQ-017; AC-009,
 * AC-010, AC-048 through AC-050, AC-063).
 *
 * The decoded definition ref is the single in-memory source of truth; every
 * accepted change is serialized onto the draft Revision detail in the same
 * mutation so the ordinary local-save path commits it atomically with
 * template content (AC-063). Structural edits reconcile the definition
 * through the hook registered on `withTemplateMutation`, so added questions
 * start associated with stage 1 and removed questions lose every row
 * (AC-050, AC-053). Local save is blocked with field-addressable issues while
 * the definition is invalid.
 */
import type { TemplateRevisionDetail } from "~/models";
import {
  calculateMaturity,
  type MaturityCalculation,
} from "~/services/maturity/calculate";
import type {
  MaturityDefinition,
  ScorableQuestion,
} from "~/services/maturity/definition";
import {
  buildDefaultMaturityDefinition,
  scorableQuestionsFromRevision,
} from "~/services/maturity/defaults";
import {
  decodeMaturityDefinition,
  serializeMaturityDefinition,
} from "~/services/maturity/persistence";
import {
  validateMaturityDefinition,
  type DefinitionIssue,
} from "~/services/maturity/validation";
import {
  reconcileDefinitionWithQuestions,
  workedExampleAnswers,
} from "~/services/maturity/authoring";
import {
  saveStatus,
  setMaturityReconcileHook,
  template,
  withTemplateMutation,
} from "./useTemplateStudio-state";

export const maturityDefinition = ref<MaturityDefinition | null>(null);
export const maturitySaveIssues = ref<DefinitionIssue[]>([]);

export const scorableQuestions = computed<ScorableQuestion[]>(() =>
  template.value ? scorableQuestionsFromRevision(template.value) : []
);

export const maturityIssues = computed<DefinitionIssue[]>(() => {
  const definition = maturityDefinition.value;
  return definition
    ? validateMaturityDefinition(definition, scorableQuestions.value)
    : [];
});

/**
 * The live worked example, computed by the same calculator as review results
 * from a fixed structural assumption. Always presented as an example, never a
 * result (AC-048).
 */
export const workedExample = computed<MaturityCalculation | null>(() => {
  const definition = maturityDefinition.value;
  const questions = scorableQuestions.value;
  if (!definition || questions.length === 0) return null;
  return calculateMaturity({
    templateRevisionId: template.value?.id ?? "worked-example",
    definition,
    questions,
    answers: workedExampleAnswers(questions),
  });
});

function syncDraft(
  draft: TemplateRevisionDetail,
  next: MaturityDefinition
): void {
  const serialized = serializeMaturityDefinition(next);
  // Immutable snapshots are replaced wholesale; keep them raw so the pure
  // operations can structuredClone them (reactive proxies cannot clone).
  maturityDefinition.value = markRaw(next);
  if (draft.maturityDefinition !== serialized) {
    draft.maturityDefinition = serialized;
  }
}

/**
 * Reconciles the definition with the current draft structure. Registered on
 * the shared mutation boundary so every structural edit (add, remove,
 * reorder, retype) keeps associations, allocations, and guidance consistent
 * (AC-050, AC-053).
 */
export function reconcileMaturityWithDraft(
  draft: TemplateRevisionDetail
): void {
  const questions = scorableQuestionsFromRevision(draft);
  const current =
    maturityDefinition.value ?? buildDefaultMaturityDefinition(questions);
  syncDraft(draft, reconcileDefinitionWithQuestions(current, questions));
}

export function registerMaturityHooks(): void {
  setMaturityReconcileHook(reconcileMaturityWithDraft);
}

/**
 * Loads the stored document, or the configured defaults when the Revision has
 * none, reconciled with the current structure. Never mutates the loaded
 * detail: the serialized document is attached by the first accepted edit
 * (the reconcile hook fires on every template mutation), so configured
 * defaults persist explicitly on save (AC-010) while read-only Revisions
 * stay pristine.
 */
export function loadMaturityForTemplate(loaded: TemplateRevisionDetail): void {
  const questions = scorableQuestionsFromRevision(loaded);
  const decoded = decodeMaturityDefinition(loaded.maturityDefinition);
  maturityDefinition.value = markRaw(
    reconcileDefinitionWithQuestions(
      decoded ?? buildDefaultMaturityDefinition(questions),
      questions
    )
  );
  maturitySaveIssues.value = [];
}

/**
 * Applies a pure authoring operation under the same editability guard as
 * structural edits, serializing the result onto the draft Revision in the
 * same mutation (AC-063).
 */
export function withMaturityMutation(
  operation: (
    definition: MaturityDefinition,
    questions: readonly ScorableQuestion[]
  ) => MaturityDefinition
): boolean {
  return withTemplateMutation((draft) => {
    const current = maturityDefinition.value;
    if (!current) return false;
    const next = operation(current, scorableQuestionsFromRevision(draft));
    if (next === current) return false;
    syncDraft(draft, next);
    return true;
  });
}

/**
 * Local-save gate (AC-063): invalid definitions block the save and surface
 * field-addressable issues; a valid definition clears them.
 */
export function assertMaturitySaveable(): boolean {
  const issues = maturityIssues.value;
  maturitySaveIssues.value = issues;
  if (issues.length === 0) return true;
  saveStatus.value = "error";
  return false;
}
