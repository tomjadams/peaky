/**
 * History derivation from review events.
 *
 * Transforms raw events into human-readable history entries.
 * This replaces the mutable session model with event-derived views.
 *
 * @see site/docs/development/walkthroughs/local-first-auditing.md
 */

import type { ReviewEvent } from "./review-events";
import type { WorkspaceHistoryEntry, ActorType } from "~/models/workspace";

export interface HistoryGroup {
  id: string;
  startTime: string;
  endTime: string;
  actorType: ActorType;
  actorId: string;
  actorName?: string;
  events: ReviewEvent[];
  summary: string;
}

/**
 * Derive human-readable history entries from events.
 */
export function deriveHistoryEntries(
  events: ReviewEvent[]
): WorkspaceHistoryEntry[] {
  return events.map(eventToHistoryEntry);
}

/**
 * Convert a single event to a history entry.
 */
function eventToHistoryEntry(event: ReviewEvent): WorkspaceHistoryEntry {
  return {
    id: event.id,
    eventType: event.eventType,
    actorType: event.actorType,
    actorId: event.actorId,
    actorName: event.actorName,
    summary: summarizeEvent(event),
    data: event.data,
    time: event.time,
  };
}

type EventSummarizer = (event: ReviewEvent) => string;

function actorOf(event: ReviewEvent): string {
  return event.actorName ?? event.actorId;
}

function summarizeRestored(event: ReviewEvent): string {
  const actor = actorOf(event);
  const restoredStatus = (event.data.restoredStatus as string) ?? "draft";
  return `${actor} restored the review to ${restoredStatus}`;
}

function summarizeAnswerImported(event: ReviewEvent): string {
  const source = (event.data.source as string) ?? "external system";
  const count = (event.data.importedCount as number) ?? 0;
  return `${source} imported ${count} draft answers`;
}

function summarizeProgressUpdated(event: ReviewEvent): string {
  const actor = actorOf(event);
  const pillar = (event.data.pillarSlug as string) ?? "a pillar";
  const progress = (event.data.progress as number) ?? 0;
  return `${actor} updated ${pillar} progress to ${progress}%`;
}

function summarizeCheckpointSaved(event: ReviewEvent): string {
  const actor = actorOf(event);
  const note = (event.data.note as string) ?? "";
  const questions = (event.data.questionsAnswered as number) ?? 0;
  const progress = (event.data.progressDelta as number) ?? 0;
  const summary = note
    ? note
    : `Saved progress: ${questions} questions answered, ${progress}% progress`;
  return `${actor}: ${summary}`;
}

function summarizeScoreRecomputed(event: ReviewEvent): string {
  const actor = actorOf(event);
  const scoreType = (event.data.scoreType as string) ?? "readiness";
  const score = (event.data.numericScore as number) ?? 0;
  return `${actor} computed ${scoreType} score: ${score}`;
}

const EVENT_SUMMARIZERS: Record<string, EventSummarizer> = {
  "ReviewCreated.v1": (e) => `${actorOf(e)} created the review`,
  "ReviewArchived.v1": (e) => `${actorOf(e)} archived the review`,
  "ReviewRestored.v1": summarizeRestored,
  "ReviewDeleted.v1": (e) => `${actorOf(e)} permanently deleted the review`,
  "ReviewAnswerRecorded.v1": (e) =>
    `${actorOf(e)} answered question ${(e.data.questionId as string) ?? "unknown"}`,
  "ReviewAnswerImported.v1": summarizeAnswerImported,
  "ReviewNoteRecorded.v1": (e) => `${actorOf(e)} added a note`,
  "ReviewNoteDeleted.v1": (e) => `${actorOf(e)} deleted a note`,
  "ReviewAttachmentUploaded.v1": (e) =>
    `${actorOf(e)} uploaded ${(e.data.filename as string) ?? "an attachment"}`,
  "ReviewAttachmentDeleted.v1": (e) => `${actorOf(e)} deleted an attachment`,
  "ReviewProgressUpdated.v1": summarizeProgressUpdated,
  "ReviewCheckpointSaved.v1": summarizeCheckpointSaved,
  "ReviewParticipantAdded.v1": (e) =>
    `${actorOf(e)} added ${(e.data.participantName as string) ?? "a participant"}`,
  "ReviewParticipantRemoved.v1": (e) => `${actorOf(e)} removed a participant`,
  "ReviewScoreRecomputed.v1": summarizeScoreRecomputed,
  "ReviewPermissionDowngraded.v1": (e) =>
    `Access revoked for ${(e.data.resourceId as string) ?? "resource"}`,
  "ReviewPublishCompleted.v1": (e) => `${actorOf(e)} published the review`,
};

/**
 * Create a human-readable summary for an event.
 */
function summarizeEvent(event: ReviewEvent): string {
  const summarizer = EVENT_SUMMARIZERS[event.eventType];
  if (summarizer) return summarizer(event);
  return `${actorOf(event)}: ${event.eventType}`;
}

/**
 * Group events into logical sessions based on time gaps.
 * Events within 30 minutes by the same actor are grouped.
 */
export function groupEventsIntoSessions(
  events: ReviewEvent[],
  gapMinutes = 30
): HistoryGroup[] {
  if (events.length === 0) return [];

  const groups: HistoryGroup[] = [];
  let currentGroup: HistoryGroup | null = null;

  for (const event of events) {
    const eventTime = new Date(event.time).getTime();

    if (!currentGroup) {
      // Start first group
      currentGroup = createGroup(event);
    } else {
      const groupTime = new Date(currentGroup.endTime).getTime();
      const gapMs = gapMinutes * 60 * 1000;
      const sameActor =
        currentGroup.actorId === event.actorId &&
        currentGroup.actorType === event.actorType;

      // If same actor and within gap, add to current group
      if (sameActor && eventTime - groupTime < gapMs) {
        currentGroup.events.push(event);
        currentGroup.endTime = event.time;
        currentGroup.summary = summarizeGroup(currentGroup);
      } else {
        // Start new group
        groups.push(currentGroup);
        currentGroup = createGroup(event);
      }
    }
  }

  // Add final group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Create a new history group from an event.
 */
function createGroup(event: ReviewEvent): HistoryGroup {
  return {
    id: `group-${event.id}`,
    startTime: event.time,
    endTime: event.time,
    actorType: event.actorType,
    actorId: event.actorId,
    actorName: event.actorName,
    events: [event],
    summary: summarizeEvent(event),
  };
}

/**
 * Create a summary for a group of events.
 */
function summarizeGroup(group: HistoryGroup): string {
  const actor = group.actorName ?? group.actorId;
  const count = group.events.length;

  if (count === 1) {
    return summarizeEvent(group.events[0]!);
  }

  // Count event types
  const typeCounts: Record<string, number> = {};
  for (const event of group.events) {
    typeCounts[event.eventType] = (typeCounts[event.eventType] ?? 0) + 1;
  }

  // Build summary
  const parts: string[] = [];

  if (typeCounts["ReviewAnswerRecorded.v1"]) {
    parts.push(`${typeCounts["ReviewAnswerRecorded.v1"]} answers`);
  }
  if (typeCounts["ReviewNoteRecorded.v1"]) {
    parts.push(`${typeCounts["ReviewNoteRecorded.v1"]} notes`);
  }
  if (typeCounts["ReviewCheckpointSaved.v1"]) {
    const checkpoint = group.events.find(
      (e) => e.eventType === "ReviewCheckpointSaved.v1"
    );
    if (checkpoint?.data.note) {
      return `${actor}: ${checkpoint.data.note}`;
    }
    parts.push("saved progress");
  }

  if (parts.length === 0) {
    return `${actor}: ${count} actions`;
  }

  return `${actor}: ${parts.join(", ")}`;
}

/**
 * Derive session-like snapshots from events.
 * This provides backward-compatible session views from the event log.
 */
export function deriveSessionSnapshot(
  events: ReviewEvent[],
  upToEventId?: string
): {
  overallProgress: number;
  questionsAnswered: number;
  questionsChanged: number;
  progressDelta: number;
} {
  let questionsAnswered = 0;
  let questionsChanged = 0;
  let progressDelta = 0;

  const eventsToProcess = upToEventId
    ? events.filter(
        (e) =>
          new Date(e.time).getTime() <=
          new Date(
            events.find((ev) => ev.id === upToEventId)?.time ?? 0
          ).getTime()
      )
    : events;

  for (const event of eventsToProcess) {
    if (event.eventType === "ReviewCheckpointSaved.v1") {
      questionsAnswered += (event.data.questionsAnswered as number) ?? 0;
      questionsChanged += (event.data.questionsChanged as number) ?? 0;
      progressDelta += (event.data.progressDelta as number) ?? 0;
    }
    if (event.eventType === "ReviewAnswerRecorded.v1") {
      questionsAnswered += 1;
    }
    if (event.eventType === "ReviewAnswerImported.v1") {
      questionsAnswered += (event.data.importedCount as number) ?? 0;
    }
  }

  return {
    overallProgress: progressDelta,
    questionsAnswered,
    questionsChanged,
    progressDelta,
  };
}
