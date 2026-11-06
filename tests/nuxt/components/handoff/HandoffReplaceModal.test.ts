/**
 * Explicit association replacement (improvement-plans/REQ-008; AC-032).
 *
 * A UModal compares the current external reference with the proposed one
 * and requires an explicit confirmation; the previous reference stays in
 * immutable replacement history and other practices' associations are
 * untouched. Validation consumes the shared HandoffLimits contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { nextTick, ref } from "vue";
import HandoffReplaceModal from "~/components/handoff/HandoffReplaceModal.vue";
import { replaceHandoffAssociation } from "~/services/handoff/handoffWrite";
import type { AssociationTransition } from "~/services/handoff/association";
import { associateTransition, CURRENT_REFERENCE } from "./fixtures";

vi.mock("~/services/handoff/handoffWrite", () => ({
  replaceHandoffAssociation: vi.fn().mockResolvedValue([]),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: ref({ id: "actor-1", name: "Advisor One", roles: [] }),
  }),
}));

const gateRef = ref({
  sharedViewCurrent: true,
  draftEditing: { available: true as const },
  confirmation: { available: true, reason: null as string | null },
});
vi.mock("~/composables/handoff/useHandoffSyncGate", () => ({
  useHandoffSyncGate: () => ({ gate: gateRef }),
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/local-db")>();
  return { ...actual, createUuidV7: vi.fn(() => "trn-new") };
});

const modalStub = {
  props: ["open", "title"],
  // The real UModal renders its title visibly; mirror that so text queries
  // see it.
  template: `<div v-if="open" role="dialog" :aria-label="title"><h2>{{ title }}</h2><slot name="body" /><slot name="footer" /></div>`,
};

const replace = vi.mocked(replaceHandoffAssociation);

function renderModal(
  current: AssociationTransition = associateTransition("cl-1")
) {
  return render(HandoffReplaceModal, {
    props: {
      open: true,
      current,
      practiceTitle: "Enable branch protection",
      history: [current],
    },
    global: { stubs: { UModal: modalStub } },
  });
}

async function fillProposed() {
  await fireEvent.update(
    screen.getByRole("textbox", { name: /New work item URL/ }),
    "https://youtrack.example.com/issue/YT-7"
  );
}

/** jsdom never fires implicit form submission from a submit-button click. */
async function submitForm() {
  await fireEvent.submit(document.querySelector("form")!);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe("HandoffReplaceModal", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("compares the current and proposed references (AC-032)", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Enable branch protection");
    expect(dialog.textContent).toContain("GitLab");
    expect(dialog.textContent).toContain("GL-42");
    expect(dialog.textContent).toContain(
      "https://gitlab.example.com/issues/42"
    );
    // Immutable-history feedback is stated before confirmation.
    expect(dialog.textContent).toMatch(/stays in the replacement history/);
  });

  it("appends a replace transition pointing at the current one (AC-032)", async () => {
    const current = associateTransition("cl-1");
    const { emitted } = renderModal(current);
    await fillProposed();
    await submitForm();

    expect(replace).toHaveBeenCalledOnce();
    const input = replace.mock.calls[0]![0];
    expect(input.transition).toMatchObject({
      id: "trn-new",
      action: "replace",
      priorTransitionId: current.id,
      reference: {
        provider: "YouTrack",
        externalId: "YT-7",
        url: "https://youtrack.example.com/issue/YT-7",
      },
    });
    // The prior transition stays untouched — immutable history.
    expect(input.history).toEqual([current]);
    expect(emitted().saved).toBeDefined();
    expect(emitted()["update:open"]).toEqual([[false]]);
  });

  it("validates the proposed reference with field-addressable errors and no write (AC-039)", async () => {
    renderModal();
    await fireEvent.update(
      screen.getByRole("textbox", { name: /New work item URL/ }),
      "ftp://nope"
    );
    await submitForm();

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/start with https:\/\//)).toBeDefined();
  });

  it("prefills the current URL for editing", () => {
    renderModal();
    const url = screen.getByRole("textbox", {
      name: /New work item URL/,
    }) as HTMLInputElement;
    expect(url.value).toBe(CURRENT_REFERENCE.url);
    expect(screen.getByText("Detected GitLab · 42")).toBeDefined();
  });
});
