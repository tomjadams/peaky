import { expect, it } from "vitest";
import {
  normalizeReviewActor,
  isReviewAdmin,
  isReviewParticipantOwner,
  getDefaultReviewActor,
  DEFAULT_REVIEW_ACTOR,
  REVIEW_ADMIN_IDS,
} from "~/services/review/ReviewGovernance";
import type { ReviewParticipant } from "~/models";

it("normalizeReviewActor returns default actor when input is null", () => {
  const actor = normalizeReviewActor(null);

  expect(actor.id).toBe(DEFAULT_REVIEW_ACTOR.id);
  expect(actor.name).toBe(DEFAULT_REVIEW_ACTOR.name);
});

it("normalizeReviewActor returns default actor when input has no id", () => {
  const actor = normalizeReviewActor({ name: "Alice" });

  expect(actor.id).toBe(DEFAULT_REVIEW_ACTOR.id);
});

it("normalizeReviewActor uses id as name fallback when name is blank", () => {
  const actor = normalizeReviewActor({ id: "actor-1", name: "   " });

  expect(actor.id).toBe("actor-1");
  expect(actor.name).toBe("actor-1");
});

it("normalizeReviewActor trims whitespace from name", () => {
  const actor = normalizeReviewActor({ id: "actor-1", name: "  Alice  " });

  expect(actor.name).toBe("Alice");
});

it("normalizeReviewActor sets roles to undefined when empty array provided", () => {
  const actor = normalizeReviewActor({
    id: "actor-1",
    name: "Alice",
    roles: [],
  });

  expect(actor.roles).toBeUndefined();
});

it("normalizeReviewActor copies roles when provided", () => {
  const actor = normalizeReviewActor({
    id: "actor-1",
    name: "Alice",
    roles: ["admin"],
  });

  expect(actor.roles).toEqual(["admin"]);
});

it("isReviewAdmin returns true for known admin id string", () => {
  const [adminId] = REVIEW_ADMIN_IDS;
  expect(isReviewAdmin(adminId!)).toBe(true);
});

it("isReviewAdmin returns false for unknown id string", () => {
  expect(isReviewAdmin("not-an-admin")).toBe(false);
});

it("isReviewAdmin returns true for actor object with admin role", () => {
  expect(isReviewAdmin({ id: "anyone", roles: ["admin"] })).toBe(true);
});

it("isReviewAdmin returns true for actor object with known admin id but no roles", () => {
  const [adminId] = REVIEW_ADMIN_IDS;
  expect(isReviewAdmin({ id: adminId! })).toBe(true);
});

it("isReviewAdmin returns false for actor object with member role and non-admin id", () => {
  expect(isReviewAdmin({ id: "user-999", roles: ["member"] })).toBe(false);
});

it("isReviewParticipantOwner returns true when actorId matches a participant", () => {
  const participants: ReviewParticipant[] = [
    { id: "user-1", name: "User One" },
    { id: "user-2", name: "User Two" },
  ];

  expect(isReviewParticipantOwner("user-1", participants)).toBe(true);
});

it("isReviewParticipantOwner returns false when actorId is not in participants", () => {
  const participants: ReviewParticipant[] = [
    { id: "user-1", name: "User One" },
  ];

  expect(isReviewParticipantOwner("user-999", participants)).toBe(false);
});

it("isReviewParticipantOwner returns false for empty participants list", () => {
  expect(isReviewParticipantOwner("user-1", [])).toBe(false);
});

it("getDefaultReviewActor returns a fresh copy each time", () => {
  const a = getDefaultReviewActor();
  const b = getDefaultReviewActor();

  expect(a).toEqual(b);
  expect(a).not.toBe(b);
});
