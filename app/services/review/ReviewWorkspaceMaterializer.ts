import type { ReviewWorkspace, WorkspaceSubject } from "~/models/workspace";
import type {
  Template,
  TemplateRevisionDetail,
  TemplateRevisionDetailResponse,
} from "~/models/template";
import {
  getDatabase,
  waitForLocalDbReady,
  withWriteTransaction,
} from "~/local-db";
import {
  persistReviewAnswers,
  persistReviewParticipants,
  persistReviewRoots,
  persistReviewSelections,
} from "./ReviewWorkspaceMaterializerReviewStore";
import { persistRevisionSnapshots } from "./ReviewWorkspaceMaterializerSnapshotStore";

const SUPPORTED_REVIEW_SUBJECT_TYPES = new Set([
  "team",
  "product",
  "organization",
]);

export type WorkspaceRevision = ReviewWorkspace["templateRevisions"][number];
type ReviewWorkspaceMaterializerDatabase = Awaited<
  ReturnType<typeof getDatabase>
>;
export type ReviewWorkspaceMaterializerTransaction = Parameters<
  Parameters<ReviewWorkspaceMaterializerDatabase["transaction"]>[0]
>[0];

export interface ValidatedSnapshot {
  readonly template: Template;
  readonly revision: TemplateRevisionDetail;
}

export interface MaterializedAnswerRow {
  readonly id: string;
  readonly reviewId: string;
  readonly questionId: string;
  readonly answer: string | null;
  readonly naReason: string | null;
  readonly itemNaReasons: string | null;
  readonly updatedAt: string;
}

export interface MaterializedParticipantRow {
  readonly id: string;
  readonly reviewId: string;
  readonly actorId: string;
  readonly role: "assessor" | "reviewer";
  readonly name: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly createdAt: string;
}

export interface ReviewWorkspaceMaterializerDependencies {
  readonly fetchSnapshot: (
    revisionId: string
  ) => Promise<TemplateRevisionDetailResponse>;
  readonly runTransaction: (
    operation: (
      transaction: ReviewWorkspaceMaterializerTransaction
    ) => Promise<void>
  ) => Promise<void>;
}

function assertPersistableSubject(
  subject: WorkspaceSubject
): asserts subject is WorkspaceSubject & {
  type: "team" | "product" | "organization";
} {
  if (!SUPPORTED_REVIEW_SUBJECT_TYPES.has(subject.type)) {
    throw new Error(
      "The Review owner is not available locally. Reload after sync completes."
    );
  }
}

async function fetchTemplateSnapshot(
  revisionId: string
): Promise<TemplateRevisionDetailResponse> {
  const response = await $fetch<TemplateRevisionDetailResponse>(
    `/api/templates/${revisionId}`
  );
  if (response.revision?.id !== revisionId) {
    throw new Error(`Template revision ${revisionId} is unavailable.`);
  }
  return response;
}

function validateRevisions(workspace: ReviewWorkspace): WorkspaceRevision[] {
  if (
    workspace.templateRevisions.length < 1 ||
    workspace.templateRevisions.length > 3
  ) {
    throw new Error("A Review requires one to three template revisions.");
  }

  const revisions = workspace.templateRevisions.toSorted(
    (left, right) => left.position - right.position
  );
  if (
    revisions.some((revision, index) => revision.position !== index) ||
    new Set(revisions.map((revision) => revision.id)).size !== revisions.length
  ) {
    throw new Error("Review template revision selections are invalid.");
  }

  const projectedIds = workspace.review.templateRevisionIds;
  if (
    projectedIds.length !== revisions.length ||
    revisions.some((revision, index) => revision.id !== projectedIds[index])
  ) {
    throw new Error(
      "The Review workspace and its template revision selections do not match."
    );
  }
  return revisions;
}

function validateSnapshot(
  selected: WorkspaceRevision,
  response: TemplateRevisionDetailResponse
): ValidatedSnapshot {
  const revision = response.revision;
  if (
    !revision ||
    revision.id !== selected.id ||
    revision.templateId !== selected.templateId ||
    response.template.id !== selected.templateId
  ) {
    throw new Error(
      `Template revision ${selected.id} does not match the Review workspace.`
    );
  }
  if (revision.status === "draft" || selected.status === "draft") {
    throw new Error("A Review cannot materialize a draft template revision.");
  }
  if (
    revision.revisionNumber !== selected.revisionNumber ||
    revision.name !== selected.name ||
    (revision.maturityDefinition ?? null) !==
      (selected.maturityDefinition ?? null)
  ) {
    throw new Error(
      `Template revision ${selected.id} conflicts with its pinned snapshot.`
    );
  }
  if (
    revision.pillars.some((pillar) => pillar.templateRevisionId !== revision.id)
  ) {
    throw new Error(
      `Template revision ${selected.id} contains a pillar owned by another revision.`
    );
  }
  return { template: response.template, revision };
}

function participantRows(
  workspace: ReviewWorkspace
): Map<string, MaterializedParticipantRow> {
  const rows = new Map<string, MaterializedParticipantRow>();
  const add = (
    role: "assessor" | "reviewer",
    participant: ReviewWorkspace["assessors"][number]
  ) => {
    const key = `${role}:${participant.id}`;
    if (rows.has(key)) {
      throw new Error(`Review participant ${participant.id} is duplicated.`);
    }
    rows.set(key, {
      id: `workspace:${workspace.review.id}:${key}`,
      reviewId: workspace.review.id,
      actorId: participant.id,
      role,
      name: participant.name,
      email: participant.email,
      avatarUrl: participant.avatarUrl ?? null,
      createdAt: workspace.review.updatedAt,
    });
  };
  for (const participant of workspace.assessors) add("assessor", participant);
  for (const participant of workspace.advisors) add("reviewer", participant);
  return rows;
}

function answerRows(
  workspace: ReviewWorkspace,
  knownQuestionIds: ReadonlySet<string>
): MaterializedAnswerRow[] {
  const seen = new Set<string>();
  return workspace.answers.flatMap((answer) => {
    if (seen.has(answer.questionId)) {
      throw new Error(`Review answer ${answer.questionId} is duplicated.`);
    }
    seen.add(answer.questionId);
    if (!knownQuestionIds.has(answer.questionId)) {
      throw new Error(
        `Review answer ${answer.questionId} has no selected question snapshot.`
      );
    }
    if (
      answer.answer === null &&
      answer.naReason === undefined &&
      answer.itemNaReasons === undefined
    ) {
      return [];
    }
    return [
      {
        id: `${workspace.review.id}:${answer.questionId}`,
        reviewId: workspace.review.id,
        questionId: answer.questionId,
        answer: answer.answer === null ? null : JSON.stringify(answer.answer),
        naReason:
          answer.naReason === undefined
            ? null
            : JSON.stringify(answer.naReason),
        itemNaReasons:
          answer.itemNaReasons === undefined
            ? null
            : JSON.stringify(answer.itemNaReasons),
        updatedAt: answer.updatedAt,
      },
    ];
  });
}

function questionIdsFromSnapshots(
  snapshots: readonly ValidatedSnapshot[]
): Set<string> {
  const owners = new Map<string, string>();
  for (const { revision } of snapshots) {
    const questions = revision.pillars.flatMap((pillar) => pillar.questions);
    for (const question of questions) {
      const owner = owners.get(question.id);
      if (owner !== undefined) {
        throw new Error(
          `Question ${question.id} belongs to both ${owner} and ${revision.id}.`
        );
      }
      owners.set(question.id, revision.id);
    }
  }
  return new Set(owners.keys());
}

/**
 * Completes and validates one local Review graph from an authorized remote
 * workspace. Existing rows are retained. Missing immutable snapshot children,
 * selections, answers, and participants are added in one transaction.
 */
export async function materializeReviewWorkspaceGraph(
  workspace: ReviewWorkspace,
  dependencies: ReviewWorkspaceMaterializerDependencies
): Promise<void> {
  const reviewSubject = workspace.reviewSubject;
  assertPersistableSubject(reviewSubject);
  const revisions = validateRevisions(workspace);
  const snapshots = await Promise.all(
    revisions.map(async (selected) =>
      validateSnapshot(selected, await dependencies.fetchSnapshot(selected.id))
    )
  );
  const knownQuestionIds = questionIdsFromSnapshots(snapshots);
  const expectedAnswers = answerRows(workspace, knownQuestionIds);
  const expectedParticipants = participantRows(workspace);

  await dependencies.runTransaction(async (transaction) => {
    await persistReviewRoots(transaction, workspace, reviewSubject);
    await persistRevisionSnapshots(transaction, snapshots);
    await persistReviewSelections(transaction, workspace, revisions);
    await persistReviewAnswers(
      transaction,
      workspace.review.id,
      knownQuestionIds,
      expectedAnswers
    );
    await persistReviewParticipants(
      transaction,
      workspace.review.id,
      expectedParticipants
    );
  });
}

/**
 * Materializes a server workspace without an outbox write. The single-writer
 * transaction keeps every child behind its existing Review and snapshot FKs.
 */
export async function materializeReviewWorkspace(
  workspace: ReviewWorkspace
): Promise<void> {
  if (import.meta.server) {
    throw new Error(
      "Review workspaces can only be materialized in the browser."
    );
  }

  await waitForLocalDbReady();
  const database = await getDatabase();
  await materializeReviewWorkspaceGraph(workspace, {
    fetchSnapshot: fetchTemplateSnapshot,
    runTransaction: (operation) => withWriteTransaction(database, operation),
  });
}
