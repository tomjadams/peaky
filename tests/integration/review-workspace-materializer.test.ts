import { afterEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { TemplateRevisionDetailResponse } from "../../app/models/template";
import { buildWorkspace } from "../../app/models/workspace";
import {
  materializeReviewWorkspaceGraph,
  type ReviewWorkspaceMaterializerDependencies,
} from "../../app/services/review/ReviewWorkspaceMaterializer";
import { applyAllMigrations } from "./helpers/template-revisions-migration";

const NOW = "2026-09-12T10:00:00.000Z";

const snapshot: TemplateRevisionDetailResponse = {
  template: {
    id: "template-materialized",
    name: "Operational readiness",
    description: "",
    status: "active",
    ownerTeamId: "owner-team",
    createdByActorId: "actor-1",
    updatedByActorId: "actor-1",
    createdAt: NOW,
    updatedAt: NOW,
  },
  revision: {
    id: "revision-materialized",
    templateId: "template-materialized",
    name: "Operational readiness",
    description: "",
    status: "published",
    revisionNumber: 1,
    revisionSummary: null,
    createdByActorId: "actor-1",
    updatedByActorId: "actor-1",
    publishedByActorId: "actor-1",
    createdAt: NOW,
    updatedAt: NOW,
    publishedAt: NOW,
    maturityDefinition: null,
    pillars: [
      {
        id: "pillar-materialized",
        templateRevisionId: "revision-materialized",
        slug: "reliability",
        name: "Reliability",
        description: "",
        order: 1,
        questions: [
          {
            id: "question-materialized",
            order: 1,
            type: "yes-no",
            text: "Are releases recoverable?",
            riskLevel: "high",
            importance: "Limits incident duration",
            leadingPractices: [],
            helpfulLinks: [],
          },
        ],
      },
    ],
  },
};

function remoteWorkspace() {
  const revision = snapshot.revision!;
  return buildWorkspace({
    review: {
      id: "review-materialized",
      name: "Q3 review",
      status: "in-progress",
      createdAt: NOW,
      updatedAt: NOW,
      teamId: "team-materialized",
      orgId: "organization-1",
      assessors: [
        {
          id: "assessor-1",
          name: "Assessor One",
          email: "assessor@example.com",
        },
      ],
      advisors: [
        {
          id: "advisor-1",
          name: "Advisor One",
          email: "advisor@example.com",
        },
      ],
    },
    subject: {
      id: "team-materialized",
      type: "team",
      name: "Platform",
      slug: "platform",
    },
    templateRevisions: [
      {
        id: revision.id,
        templateId: revision.templateId,
        name: revision.name,
        description: revision.description,
        status: revision.status,
        revisionNumber: revision.revisionNumber,
        revisionSummary: revision.revisionSummary,
        createdByActorId: revision.createdByActorId,
        updatedByActorId: revision.updatedByActorId,
        publishedByActorId: revision.publishedByActorId,
        createdAt: revision.createdAt,
        updatedAt: revision.updatedAt,
        publishedAt: revision.publishedAt,
        maturityDefinition: revision.maturityDefinition ?? null,
        position: 0,
      },
    ],
    pillars: revision.pillars.map((pillar) => ({
      id: pillar.id,
      templateRevisionId: revision.id,
      slug: pillar.slug,
      name: pillar.name,
      description: pillar.description,
      orderKey: "0001",
      questions: pillar.questions.map((question) => ({
        id: question.id,
        templateRevisionId: revision.id,
        pillarId: pillar.id,
        orderKey: "0001",
        text: question.text,
        type: question.type,
        riskLevel: question.riskLevel,
        importance: question.importance,
        checklistItems: question.checklistItems,
        leadingPractices: question.leadingPractices,
        helpfulLinks: question.helpfulLinks,
      })),
    })),
    answers: [
      {
        questionId: "question-materialized",
        answer: "no",
        updatedAt: NOW,
      },
    ],
    notes: [],
    attachments: [],
    scores: [],
    capabilities: {
      canEdit: true,
      canPublish: false,
      canDelete: false,
      canAddParticipants: true,
      canExport: true,
    },
    recentHistory: [],
    answerProvenance: {},
  });
}

function count(
  sqlite: Database.Database,
  table: string,
  value?: string,
  column = "review_id"
): number {
  const where = value ? ` WHERE ${column} = ?` : "";
  const row = sqlite
    .prepare(`SELECT COUNT(*) AS total FROM ${table}${where}`)
    .get(...(value ? [value] : [])) as { total: number };
  return row.total;
}

describe("ReviewWorkspaceMaterializer partial local graph", () => {
  const databases: Database.Database[] = [];
  afterEach(() => {
    for (const database of databases) database.close();
    databases.length = 0;
  });

  it("completes a root-only Review and remains idempotent", async () => {
    const sqlite = new Database(":memory:");
    databases.push(sqlite);
    sqlite.pragma("foreign_keys = ON");
    applyAllMigrations(sqlite);
    sqlite
      .prepare(
        `INSERT INTO subjects
          (id, type, name, slug, status, created_at, updated_at)
         VALUES (?, 'team', 'Platform', 'platform', 'active', ?, ?)`
      )
      .run("team-materialized", NOW, NOW);
    sqlite
      .prepare(
        `INSERT INTO reviews
          (id, subject_id, name, status, created_at, updated_at)
         VALUES (?, ?, 'Q3 review', 'in-progress', ?, ?)`
      )
      .run("review-materialized", "team-materialized", NOW, NOW);

    const database = drizzle(sqlite);
    const fetchSnapshot = vi.fn().mockResolvedValue(snapshot);
    const dependencies: ReviewWorkspaceMaterializerDependencies = {
      fetchSnapshot,
      runTransaction: async (operation) => {
        await operation(database as never);
      },
    };
    const workspace = remoteWorkspace();

    await materializeReviewWorkspaceGraph(workspace, dependencies);
    await materializeReviewWorkspaceGraph(workspace, dependencies);

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(count(sqlite, "reviews", "review-materialized", "id")).toBe(1);
    expect(
      count(sqlite, "review_template_selections", "review-materialized")
    ).toBe(1);
    expect(count(sqlite, "review_answer_state", "review-materialized")).toBe(1);
    expect(count(sqlite, "review_participants", "review-materialized")).toBe(2);
    expect(count(sqlite, "template_revisions")).toBeGreaterThanOrEqual(1);
    expect(count(sqlite, "template_pillars")).toBeGreaterThanOrEqual(1);
    expect(count(sqlite, "template_questions")).toBeGreaterThanOrEqual(1);

    sqlite
      .prepare(
        `UPDATE review_template_selections
         SET position = 1
         WHERE review_id = ?`
      )
      .run("review-materialized");
    await expect(
      materializeReviewWorkspaceGraph(workspace, dependencies)
    ).rejects.toThrow(/conflicting template revision selections/i);
  });
});
