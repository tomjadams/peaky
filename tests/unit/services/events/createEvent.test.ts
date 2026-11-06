import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as LocalDb from "~/local-db";
import { createEvent } from "~/services/events/createEvent";
import type { ReviewAnswerRecorded } from "~/services/events/DomainEvent";

vi.mock("~/composables/auth/useCurrentActor", () => ({
  readPersistedActor: vi.fn().mockReturnValue({
    id: "user-001",
    name: "Test User",
    roles: ["member"],
  }),
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof LocalDb>();
  return {
    ...actual,
    createUuidV7: vi.fn(() => "evt_test123"),
    nowISO: vi.fn(() => "2026-03-26T10:00:00.000Z"),
  };
});

// Re-establish the default mock return value after vi.clearAllMocks() resets it.
beforeEach(async () => {
  vi.clearAllMocks();

  const { readPersistedActor } =
    await import("~/composables/auth/useCurrentActor");
  vi.mocked(readPersistedActor).mockReturnValue({
    id: "user-001",
    name: "Test User",
    roles: ["member"],
  });
});

describe("createEvent()", () => {
  it("id has evt_ prefix", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.id).toBe("evt_test123");
  });

  it("time is a valid ISO timestamp", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.time).toBe("2026-03-26T10:00:00.000Z");
    expect(new Date(event.time).toISOString()).toBe(event.time);
  });

  it("type matches the argument", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.type).toBe("ReviewAnswerRecorded.v1");
  });

  it("specversion is always 1.0", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.specversion).toBe("1.0");
  });

  it("entityType and entityId match arguments", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-42",
      { questionId: "q-42", answer: "no" }
    );

    expect(event.entityType).toBe("review_answer");
    expect(event.entityId).toBe("review-1:q-42");
  });

  it("data matches the payload argument", () => {
    const payload = { questionId: "q-1", answer: "yes", naReason: null };
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      payload
    );

    expect(event.data).toEqual(payload);
  });

  it("actorType and actorId resolve from readPersistedActor()", async () => {
    const { readPersistedActor } =
      await import("~/composables/auth/useCurrentActor");
    vi.mocked(readPersistedActor).mockReturnValue({
      id: "actor-xyz",
      name: "Actor XYZ",
      roles: ["admin"],
    });

    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.actorId).toBe("actor-xyz");
    expect(event.actorType).toBe("user");
  });

  it("source defaults to peaky.client", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.source).toBe("peaky.client");
  });

  it("reviewId is set when provided as option", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" },
      { reviewId: "review-1" }
    );

    expect(event.reviewId).toBe("review-1");
  });

  it("reviewId is omitted when not provided", () => {
    const event = createEvent<ReviewAnswerRecorded>(
      "ReviewAnswerRecorded.v1",
      "review-1:q-1",
      { questionId: "q-1", answer: "yes" }
    );

    expect(event.reviewId).toBeUndefined();
  });
});
