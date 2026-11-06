import type { AssessmentSession } from "../../app/models";

/**
 * Mock assessment sessions for the 2026 Operational Readiness Review (01932b3c-7d00-7000-8000-000000002001).
 * Shows progression from initial creation through multiple work sessions.
 */
export const sessions: AssessmentSession[] = [
  // Session 1: Reliability and resilience
  {
    id: "01932b3c-7d00-7000-8000-000000005001",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    createdAt: "2025-10-15T14:30:00Z",
    createdBy: { id: "user-002", name: "Marcus Johnson" },
    snapshot: {
      overallProgress: 30,
      pillars: [
        {
          slug: "reliability-resilience",
          name: "Reliability & Resilience",
          progress: 100,
          totalQuestions: 3,
          answeredQuestions: 3,
        },
        {
          slug: "observability-response",
          name: "Observability & Response",
          progress: 0,
          totalQuestions: 3,
          answeredQuestions: 0,
        },
        {
          slug: "change-release-safety",
          name: "Change & Release Safety",
          progress: 0,
          totalQuestions: 2,
          answeredQuestions: 0,
        },
        {
          slug: "operational-ownership",
          name: "Operational Ownership",
          progress: 0,
          totalQuestions: 2,
          answeredQuestions: 0,
        },
      ],
    },
    delta: { questionsAnswered: 3, questionsChanged: 0, progressDelta: 30 },
    note: "Completed all reliability and resilience questions",
  },
  // Session 2: Observability and response started
  {
    id: "01932b3c-7d00-7000-8000-000000005002",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    createdAt: "2025-11-03T10:15:00Z",
    createdBy: { id: "user-001", name: "Sarah Chen" },
    snapshot: {
      overallProgress: 40,
      pillars: [
        {
          slug: "reliability-resilience",
          name: "Reliability & Resilience",
          progress: 100,
          totalQuestions: 3,
          answeredQuestions: 3,
        },
        {
          slug: "observability-response",
          name: "Observability & Response",
          progress: 33,
          totalQuestions: 3,
          answeredQuestions: 1,
        },
        {
          slug: "change-release-safety",
          name: "Change & Release Safety",
          progress: 0,
          totalQuestions: 2,
          answeredQuestions: 0,
        },
        {
          slug: "operational-ownership",
          name: "Operational Ownership",
          progress: 0,
          totalQuestions: 2,
          answeredQuestions: 0,
        },
      ],
    },
    delta: { questionsAnswered: 1, questionsChanged: 0, progressDelta: 10 },
    note: "Started observability and response assessment",
  },
  // Session 3: More observability + change safety
  {
    id: "01932b3c-7d00-7000-8000-000000005003",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    templateId: "01932b3c-7d00-7000-8000-000000001001",
    createdAt: "2025-11-20T16:45:00Z",
    createdBy: { id: "user-003", name: "Priya Patel" },
    snapshot: {
      overallProgress: 60,
      pillars: [
        {
          slug: "reliability-resilience",
          name: "Reliability & Resilience",
          progress: 100,
          totalQuestions: 3,
          answeredQuestions: 3,
        },
        {
          slug: "observability-response",
          name: "Observability & Response",
          progress: 67,
          totalQuestions: 3,
          answeredQuestions: 2,
        },
        {
          slug: "change-release-safety",
          name: "Change & Release Safety",
          progress: 50,
          totalQuestions: 2,
          answeredQuestions: 1,
        },
        {
          slug: "operational-ownership",
          name: "Operational Ownership",
          progress: 0,
          totalQuestions: 2,
          answeredQuestions: 0,
        },
      ],
    },
    delta: { questionsAnswered: 2, questionsChanged: 0, progressDelta: 20 },
    note: "Expanded observability and started change safety review",
  },
  // Sessions for PCI-DSS 4.0 template (same container review)
  {
    id: "01932b3c-7d00-7000-8000-000000005004",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    templateId: "01932b3c-7d00-7000-8000-000000001002",
    createdAt: "2025-11-10T11:20:00Z",
    createdBy: { id: "user-002", name: "Marcus Johnson" },
    snapshot: {
      overallProgress: 50,
      pillars: [
        {
          slug: "security",
          name: "Security",
          progress: 50,
          totalQuestions: 2,
          answeredQuestions: 1,
        },
        {
          slug: "infrastructure",
          name: "Infrastructure",
          progress: 100,
          totalQuestions: 1,
          answeredQuestions: 1,
        },
        {
          slug: "operations",
          name: "Operations",
          progress: 0,
          totalQuestions: 1,
          answeredQuestions: 0,
        },
      ],
    },
    delta: { questionsAnswered: 2, questionsChanged: 0, progressDelta: 50 },
    note: "Initial PCI-DSS assessment",
  },
  {
    id: "01932b3c-7d00-7000-8000-000000005005",
    reviewId: "01932b3c-7d00-7000-8000-000000002001",
    templateId: "01932b3c-7d00-7000-8000-000000001002",
    createdAt: "2025-12-12T09:15:00Z",
    createdBy: { id: "user-001", name: "Sarah Chen" },
    snapshot: {
      overallProgress: 100,
      pillars: [
        {
          slug: "security",
          name: "Security",
          progress: 100,
          totalQuestions: 2,
          answeredQuestions: 2,
        },
        {
          slug: "infrastructure",
          name: "Infrastructure",
          progress: 100,
          totalQuestions: 1,
          answeredQuestions: 1,
        },
        {
          slug: "operations",
          name: "Operations",
          progress: 100,
          totalQuestions: 1,
          answeredQuestions: 1,
        },
      ],
    },
    delta: { questionsAnswered: 2, questionsChanged: 0, progressDelta: 50 },
    note: "Completed PCI-DSS assessment",
  },
];

/** In-memory store for sessions created at runtime (survive browser refresh, reset on server restart). */
const runtimeSessions: AssessmentSession[] = [];
let sessionCounter = 0;

export function addSession(
  input: Omit<AssessmentSession, "id">
): AssessmentSession {
  sessionCounter += 1;
  const session: AssessmentSession = {
    ...input,
    id: `session-r${String(sessionCounter).padStart(3, "0")}`,
  };
  runtimeSessions.push(session);
  return session;
}

export function getSessionsByReviewId(reviewId: string): AssessmentSession[] {
  return [...sessions, ...runtimeSessions]
    .filter((s) => s.reviewId === reviewId)
    .toSorted(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export function getSessionById(
  sessionId: string
): AssessmentSession | undefined {
  return (
    sessions.find((s) => s.id === sessionId) ??
    runtimeSessions.find((s) => s.id === sessionId)
  );
}
