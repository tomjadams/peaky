import { describe, it, expect, beforeEach } from "vitest";
import {
  getEventsByReviewId,
  addEvent,
  EVENT_TYPES,
  clearRuntimeEvents,
} from "../../../server/data/review-events";
import {
  deriveHistoryEntries,
  groupEventsIntoSessions,
} from "../../../server/data/history-derivation";
import {
  getProvenanceByReviewId,
  recordProvenance,
  clearRuntimeProvenance,
} from "../../../server/data/provenance";
import type { AnswerProvenance } from "~/models/workspace";

// Seed review ID (first review — 2026 Operational Readiness Review)
const REVIEW_ID = "01932b3c-7d00-7000-8000-000000002001";

describe("Review Events", () => {
  beforeEach(() => {
    clearRuntimeEvents();
  });

  describe("event storage", () => {
    it("returns seed events for existing reviews", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      expect(events.length).toBeGreaterThan(0);
    });

    it("events are sorted by occurrence time", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      for (let i = 1; i < events.length; i++) {
        expect(new Date(events[i]!.time).getTime()).toBeGreaterThanOrEqual(
          new Date(events[i - 1]!.time).getTime()
        );
      }
    });

    it("can add runtime events", () => {
      const event = addEvent({
        reviewId: REVIEW_ID,
        eventType: EVENT_TYPES.ANSWER_RECORDED,
        actorType: "user",
        actorId: "user-001",
        actorName: "Test User",
        data: { questionId: "q-1", answer: "yes" },
      });

      expect(event.id).toBeDefined();
      expect(event.status).toBe("pending");
      expect(event.time).toBeDefined();

      const events = getEventsByReviewId(REVIEW_ID);
      expect(events.find((e) => e.id === event.id)).toBeDefined();
    });
  });

  describe("event types", () => {
    it("has expected event types", () => {
      expect(EVENT_TYPES.REVIEW_CREATED).toBe("ReviewCreated.v1");
      expect(EVENT_TYPES.ANSWER_RECORDED).toBe("ReviewAnswerRecorded.v1");
      expect(EVENT_TYPES.ANSWER_IMPORTED).toBe("ReviewAnswerImported.v1");
      expect(EVENT_TYPES.CHECKPOINT_SAVED).toBe("ReviewCheckpointSaved.v1");
    });
  });

  describe("checkpoint events", () => {
    it("seed events include checkpoint events", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      const checkpoints = events.filter(
        (e) => e.eventType === EVENT_TYPES.CHECKPOINT_SAVED
      );
      expect(checkpoints.length).toBeGreaterThan(0);
    });

    it("checkpoint events have progress data", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      const checkpoint = events.find(
        (e) => e.eventType === EVENT_TYPES.CHECKPOINT_SAVED
      );
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.data.questionsAnswered).toBeDefined();
      expect(checkpoint!.data.progressDelta).toBeDefined();
    });
  });
});

describe("History Derivation", () => {
  describe("deriveHistoryEntries", () => {
    it("converts events to history entries", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      const entries = deriveHistoryEntries(events);

      expect(entries.length).toBe(events.length);
      entries.forEach((entry) => {
        expect(entry.id).toBeDefined();
        expect(entry.eventType).toBeDefined();
        expect(entry.actorType).toBeDefined();
        expect(entry.summary).toBeDefined();
        expect(entry.time).toBeDefined();
      });
    });

    it("summarizes checkpoint events with note", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      const entries = deriveHistoryEntries(events);

      const checkpointEntry = entries.find(
        (e) => e.eventType === EVENT_TYPES.CHECKPOINT_SAVED
      );
      expect(checkpointEntry).toBeDefined();
      // First checkpoint records completion of Reliability & Resilience
      expect(checkpointEntry!.summary.toLowerCase()).toContain(
        "completed all reliability and resilience"
      );
    });

    it("summarizes import events with source", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      const entries = deriveHistoryEntries(events);

      const importEntry = entries.find(
        (e) => e.eventType === EVENT_TYPES.ANSWER_IMPORTED
      );
      expect(importEntry).toBeDefined();
      expect(importEntry!.summary).toContain("imported");
      expect(importEntry!.summary).toContain("ci-cd");
    });
  });

  describe("groupEventsIntoSessions", () => {
    it("groups events by actor and time proximity", () => {
      const events = getEventsByReviewId(REVIEW_ID);
      const groups = groupEventsIntoSessions(events);

      expect(groups.length).toBeGreaterThan(0);
      groups.forEach((group) => {
        expect(group.actorId).toBeDefined();
        expect(group.startTime).toBeDefined();
        expect(group.endTime).toBeDefined();
        expect(group.events.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("Provenance", () => {
  beforeEach(() => {
    clearRuntimeProvenance();
  });

  describe("getProvenanceByReviewId", () => {
    it("returns seed provenance for first review", () => {
      const provenance = getProvenanceByReviewId(REVIEW_ID);
      expect(Object.keys(provenance).length).toBeGreaterThan(0);
    });

    it("provenance has required fields", () => {
      const provenance = getProvenanceByReviewId(REVIEW_ID);
      for (const [questionId, prov] of Object.entries(provenance)) {
        expect(questionId).toBeDefined();
        expect(prov.source).toBeDefined();
        expect(prov.timestamp).toBeDefined();
      }
    });

    it("provenance includes confidence and evidence", () => {
      const provenance = getProvenanceByReviewId(REVIEW_ID);
      const provWithConfidence = Object.values(provenance).find(
        (p) => p.confidence != null
      );
      expect(provWithConfidence).toBeDefined();

      const provWithEvidence = Object.values(provenance).find(
        (p) => p.evidence && p.evidence.length > 0
      );
      expect(provWithEvidence).toBeDefined();
    });
  });

  describe("recordProvenance", () => {
    it("can record new provenance", () => {
      const prov: AnswerProvenance = {
        source: "catalog-sync",
        runId: "sync-001",
        timestamp: new Date().toISOString(),
        confidence: 0.75,
        evidence: ["https://docs.example.com"],
      };

      recordProvenance("test-review-new", "question-1", prov);

      const provenance = getProvenanceByReviewId("test-review-new");
      expect(provenance["question-1"]).toBeDefined();
      expect(provenance["question-1"]!.source).toBe("catalog-sync");
    });
  });
});

describe("Workspace Response Shape", () => {
  it("workspace model has expected structure", async () => {
    // Import the workspace types
    const { buildWorkspace } = await import("../../../app/models/workspace");

    const workspace = buildWorkspace({
      review: {
        id: "test-review",
        name: "Test Review",
        status: "in-progress",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
        teamId: "team-1",
        orgId: "org-1",
        assessors: [],
        reviewers: [],
      },
      subject: {
        id: "team-1",
        type: "team",
        name: "Test Team",
        slug: "test-team",
      },
      templateRevisions: [],
      pillars: [],
      answers: [],
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

    expect(workspace.review.id).toBe("test-review");
    expect(workspace.subject.id).toBe("team-1");
    expect(workspace.reviewSubject.id).toBe("team-1");
    expect(workspace.capabilities.canEdit).toBe(true);
    expect(workspace.recentHistory).toEqual([]);
    expect(workspace.answerProvenance).toEqual({});
  });
});
