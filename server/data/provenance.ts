/**
 * Provenance tracking for machine-generated draft answers.
 *
 * Records source, timestamp, confidence, and evidence for each imported answer.
 * This enables UI to show "why is this answer here?" with full traceability.
 *
 * @see site/docs/development/walkthroughs/local-first-auditing.md
 */

import type { AnswerProvenance } from "~/models/workspace";

export interface DraftImportRecord {
  id: string;
  reviewId: string;
  source: string;
  runId?: string;
  importedCount: number;
  mode: string;
  recordedAt: string;
}

export interface AnswerProvenanceRecord {
  questionId: string;
  provenance: AnswerProvenance;
}

// Seed provenance records (from the CI/CD import event)
const seedProvenance: Record<string, AnswerProvenanceRecord[]> = {
  "01932b3c-7d00-7000-8000-000000002001": [
    {
      questionId: "infrastructure-q-1",
      provenance: {
        source: "ci-cd",
        runId: "pipeline-1842",
        timestamp: "2025-12-10T08:00:00Z",
        confidence: 0.85,
        evidence: ["https://github.com/org/repo/commit/abc123"],
      },
    },
    {
      questionId: "infrastructure-q-2",
      provenance: {
        source: "ci-cd",
        runId: "pipeline-1842",
        timestamp: "2025-12-10T08:00:00Z",
        confidence: 0.92,
        evidence: [
          "https://github.com/org/repo/commit/def456",
          "https://docs.internal/infra-guide.md",
        ],
      },
    },
    {
      questionId: "reliability-q-1",
      provenance: {
        source: "ci-cd",
        runId: "pipeline-1842",
        timestamp: "2025-12-10T08:00:00Z",
        confidence: 0.78,
        evidence: ["https://runbooks.internal/reliability.md"],
      },
    },
  ],
};

// Runtime provenance records
const runtimeProvenance: Record<string, AnswerProvenanceRecord[]> = {};
let importCounter = Object.keys(seedProvenance).reduce(
  (sum, k) => sum + seedProvenance[k]!.length,
  0
);

/**
 * Record provenance for an imported draft answer.
 */
export function recordProvenance(
  reviewId: string,
  questionId: string,
  provenance: AnswerProvenance
): AnswerProvenanceRecord {
  const record: AnswerProvenanceRecord = {
    questionId,
    provenance,
  };

  if (!runtimeProvenance[reviewId]) {
    runtimeProvenance[reviewId] = [];
  }
  runtimeProvenance[reviewId]!.push(record);

  return record;
}

/**
 * Record provenance for multiple answers from an import.
 */
export function recordImportProvenance(
  reviewId: string,
  answers: Array<{
    questionId: string;
    provenance: AnswerProvenance;
  }>
): AnswerProvenanceRecord[] {
  return answers.map(({ questionId, provenance }) =>
    recordProvenance(reviewId, questionId, provenance)
  );
}

/**
 * Get provenance for a specific answer.
 */
export function getAnswerProvenance(
  reviewId: string,
  questionId: string
): AnswerProvenance | undefined {
  const seedRecords = seedProvenance[reviewId] ?? [];
  const runtimeRecords = runtimeProvenance[reviewId] ?? [];

  const record =
    runtimeRecords.find((r) => r.questionId === questionId) ??
    seedRecords.find((r) => r.questionId === questionId);

  return record?.provenance;
}

/**
 * Get all provenance records for a review.
 */
export function getProvenanceByReviewId(
  reviewId: string
): Record<string, AnswerProvenance> {
  const seedRecords = seedProvenance[reviewId] ?? [];
  const runtimeRecords = runtimeProvenance[reviewId] ?? [];

  const result: Record<string, AnswerProvenance> = {};

  // Seed records first (lower priority)
  for (const record of seedRecords) {
    result[record.questionId] = record.provenance;
  }

  // Runtime records override (higher priority)
  for (const record of runtimeRecords) {
    result[record.questionId] = record.provenance;
  }

  return result;
}

/**
 * Create a draft import record.
 */
export function createDraftImportRecord(
  input: Omit<DraftImportRecord, "id" | "recordedAt">
): DraftImportRecord {
  importCounter += 1;
  const record: DraftImportRecord = {
    ...input,
    id: `import-${String(importCounter).padStart(3, "0")}`,
    recordedAt: new Date().toISOString(),
  };
  return record;
}

/**
 * Clear runtime provenance (for testing).
 */
export function clearRuntimeProvenance(): void {
  // Reassign to empty object instead of deleting keys
  for (const key of Object.keys(runtimeProvenance)) {
    // Using splice on array pattern would be better but we need to clear the record object
    // biome-ignore lint/suspicious/noAssignLiterals: Clear runtime state for testing
    runtimeProvenance[key] = [];
  }
  importCounter = Object.keys(seedProvenance).reduce(
    (sum, k) => sum + seedProvenance[k]!.length,
    0
  );
}
