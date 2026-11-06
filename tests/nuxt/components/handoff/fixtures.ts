/**
 * Component-test fixtures for the handoff UI (improvement-plans/REQ-005
 * through REQ-009, REQ-011, REQ-012). Builds a real ReviewContext through
 * the shared improvement-plan builders so the UI asserts the same
 * projection as the pure domain: two pinned Revisions, checklist and
 * Yes/No practices, met/N/A exclusions, and one current association.
 */
import type { AssociationTransition } from "~/services/handoff/association";
import {
  deriveHandoffDraft,
  selectPractice,
  type HandoffDraft,
  type HandoffPracticeRecord,
} from "~/services/handoff/draft";
import { practiceEntityId } from "~/services/handoff/practice";
import {
  projectSelectablePractices,
  type SelectablePractice,
} from "~/services/handoff/projection";
import type { ReviewContext } from "~/services/review/ImprovementPlanProjection";
import {
  makeChecklistAnswer,
  makeChecklistTemplateQuestion,
  makeNAAnswer,
  makeNoAnswer,
  makeTeamReviewContext,
  makeTemplatePillar,
  makeTemplateQuestion,
  makeTemplateRevisionDetail,
  makeYesAnswer,
} from "../../../unit/services/review/improvementPlanFixtures";

export const REVIEW_ID = "review-1";
export const REVIEW_NAME = "Q3 Readiness";
export const NOW = "2026-09-10T10:00:00.000Z";

/**
 * Two pinned Revisions:
 *  - rev-a "Security Review" (revision 1): checklist q-cl (cl-1 and cl-3
 *    unmet, cl-2 met), Yes/No q-yn answered No, q-yes answered Yes (not
 *    projected), q-na answered N/A (excluded).
 *  - rev-b "Reliability Review" (revision 2): checklist q-rel (rl-1 unmet).
 */
export function makeHandoffContext(): ReviewContext {
  const revA = makeTemplateRevisionDetail({
    id: "rev-a",
    templateId: "tpl-security",
    name: "Security Review",
    revisionNumber: 1,
    pillars: [
      makeTemplatePillar({
        slug: "security",
        name: "Security",
        questions: [
          makeChecklistTemplateQuestion(
            [
              { id: "cl-1", text: "Enable branch protection" },
              { id: "cl-2", text: "Require pull request reviews" },
              { id: "cl-3", text: "Scan dependencies" },
            ],
            { id: "q-cl", text: "How are changes protected?" }
          ),
          makeTemplateQuestion({
            id: "q-yn",
            text: "Is single sign-on enforced?",
          }),
          makeTemplateQuestion({
            id: "q-yes",
            text: "Is disk encryption enabled?",
          }),
          makeTemplateQuestion({
            id: "q-na",
            text: "Is the legacy VPN retired?",
          }),
        ],
      }),
    ],
  });
  const revB = makeTemplateRevisionDetail({
    id: "rev-b",
    templateId: "tpl-reliability",
    name: "Reliability Review",
    revisionNumber: 2,
    pillars: [
      makeTemplatePillar({
        slug: "reliability",
        name: "Reliability",
        questions: [
          makeChecklistTemplateQuestion(
            [{ id: "rl-1", text: "Add health-check endpoints" }],
            { id: "q-rel", text: "How is availability observed?" }
          ),
        ],
      }),
    ],
  });
  return makeTeamReviewContext({
    reviewId: REVIEW_ID,
    subjectId: "team-1",
    templates: [revA, revB],
    answers: [
      makeChecklistAnswer("q-cl", ["cl-2"]),
      makeNoAnswer("q-yn"),
      makeYesAnswer("q-yes"),
      makeNAAnswer("q-na"),
      makeChecklistAnswer("q-rel", []),
    ],
  });
}

/** The projected selectable practices of the fixture context. */
export function selectablePractices(): SelectablePractice[] {
  return projectSelectablePractices(makeHandoffContext());
}

export function practiceById(
  practiceId: string,
  practices: SelectablePractice[] = selectablePractices()
): SelectablePractice {
  const found = practices.find(
    (practice) => practice.reference.practiceId === practiceId
  );
  if (!found) throw new Error(`fixture practice ${practiceId} not projected`);
  return found;
}

/** Builds selected handoff rows from projected practices, in order. */
export function selectedRows(practiceIds: string[]): HandoffPracticeRecord[] {
  const practices = selectablePractices();
  let rows: HandoffPracticeRecord[] = [];
  for (const practiceId of practiceIds) {
    rows = selectPractice({
      existing: rows,
      practice: practiceById(practiceId, practices),
      actorId: "actor-1",
      occurredAt: NOW,
    });
  }
  return rows;
}

export function draftFor(rows: HandoffPracticeRecord[]): HandoffDraft {
  return deriveHandoffDraft(rows, {
    reviewId: REVIEW_ID,
    reviewName: REVIEW_NAME,
  });
}

export const CURRENT_REFERENCE = {
  provider: "GitLab",
  externalId: "GL-42",
  url: "https://gitlab.example.com/issues/42",
} as const;

/** One current association for the given fixture practice. */
export function associateTransition(
  practiceId: string,
  overrides: Partial<AssociationTransition> = {}
): AssociationTransition {
  const practice = practiceById(practiceId);
  return {
    id: `trn-${practiceId}`,
    reviewId: REVIEW_ID,
    practice: practice.reference,
    action: "associate",
    reference: { ...CURRENT_REFERENCE },
    priorTransitionId: null,
    actorId: "actor-1",
    occurredAt: NOW,
    ...overrides,
  };
}

/** Practice entity ID for assertions. */
export function entityIdOf(practiceId: string): string {
  return practiceEntityId(practiceById(practiceId).reference);
}

/**
 * A one-Revision context whose single checklist question carries `count`
 * unmet practices — exercises the 50-practice handoff maximum (AC-042).
 */
export function manyPracticesContext(count: number): ReviewContext {
  const items = Array.from({ length: count }, (_, index) => ({
    id: `cl-${index + 1}`,
    text: `Practice ${index + 1}`,
  }));
  return makeTeamReviewContext({
    reviewId: REVIEW_ID,
    subjectId: "team-1",
    templates: [
      makeTemplateRevisionDetail({
        id: "rev-big",
        name: "Large Review",
        revisionNumber: 1,
        pillars: [
          makeTemplatePillar({
            slug: "scale",
            name: "Scale",
            questions: [makeChecklistTemplateQuestion(items, { id: "q-big" })],
          }),
        ],
      }),
    ],
    answers: [makeChecklistAnswer("q-big", [])],
  });
}

/** Selects the first `take` projected practices of a context, in order. */
export function selectFromContext(
  context: ReviewContext,
  take: number
): HandoffPracticeRecord[] {
  let rows: HandoffPracticeRecord[] = [];
  for (const practice of projectSelectablePractices(context).slice(0, take)) {
    rows = selectPractice({
      existing: rows,
      practice,
      actorId: "actor-1",
      occurredAt: NOW,
    });
  }
  return rows;
}
