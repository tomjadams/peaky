import type { QuestionAnswer } from "~/models/question";

/**
 * Assessment Session - captures a snapshot of progress at a point in time.
 * Sessions are created explicitly when users save their assessment progress.
 */
export interface AssessmentSession {
  id: string;
  reviewId: string;
  templateId: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  snapshot: SessionSnapshot;
  delta: SessionDelta;
  note?: string;
}

export interface SessionSnapshot {
  overallProgress: number;
  pillars: SessionPillarSnapshot[];
}

export interface SessionPillarSnapshot {
  slug: string;
  name: string;
  progress: number;
  totalQuestions: number;
  answeredQuestions: number;
}

export interface SessionDelta {
  questionsAnswered: number;
  questionsChanged: number;
  progressDelta: number;
}

/** A per-question diff captured during an assessment session. */
export interface SessionChange {
  questionId: string;
  questionText: string;
  pillarName: string;
  before: QuestionAnswer | null;
  after: QuestionAnswer | null;
}
