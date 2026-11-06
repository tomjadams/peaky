/**
 * Provider-neutral existing-ticket association form (improvement-plans/
 * REQ-007, REQ-008, REQ-011; AC-028 through AC-031, AC-039 through AC-042).
 *
 * One existing work item covers the whole handoff: provider, external ID,
 * and a validated HTTPS URL — and no creation control. Validation consumes
 * the shared HandoffLimits contract with field-addressable errors; a
 * duplicate conflict identifies every conflicting practice with its
 * current reference; nothing is ever truncated or partially written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { nextTick, ref } from "vue";
import HandoffAssociationForm from "~/components/handoff/HandoffAssociationForm.vue";
import { confirmHandoffAssociation } from "~/services/handoff/handoffWrite";
import { confirmHandoff } from "~/services/handoff/confirmation";
import { draftFor, selectedRows } from "./fixtures";

vi.mock("~/services/handoff/handoffWrite", () => ({
  confirmHandoffAssociation: vi.fn(),
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

const confirm = vi.mocked(confirmHandoffAssociation);

function renderForm(practiceIds = ["cl-1", "q-yn"]) {
  const rows = selectedRows(practiceIds);
  const draft = draftFor(rows);
  if (draft.kind !== "ready") throw new Error("fixture draft must be ready");
  return render(HandoffAssociationForm, {
    props: { practices: draft.practices, history: [] },
  });
}

async function fillValidReference() {
  await fireEvent.update(
    screen.getByRole("textbox", { name: /Work item URL/ }),
    "https://gitlab.example.com/issues/42"
  );
}

/** jsdom never fires implicit form submission from a submit-button click. */
async function submitForm() {
  await fireEvent.submit(document.querySelector("form")!);
  // The async submit handler awaits the write path before mutating state;
  // a macrotask turn flushes every pending microtask, then the render.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe("HandoffAssociationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue({ ok: true, transitions: [] });
  });
  afterEach(() => cleanup());

  it("requests one HTTPS URL and derives provider-owned fields (AC-029)", async () => {
    renderForm();
    expect(screen.queryByRole("textbox", { name: /^Provider$/ })).toBeNull();
    expect(
      screen.queryByRole("textbox", { name: /External work item ID/ })
    ).toBeNull();
    expect(
      screen.getByRole("textbox", { name: /Work item URL/ })
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Link existing work item/ })
    ).toBeDefined();
    await fillValidReference();
    expect(screen.getByText("Detected GitLab · 42")).toBeDefined();
    expect(screen.queryByRole("button", { name: /create/i })).toBeNull();
  });

  it("explains degraded sync while keeping the form inspectable", () => {
    gateRef.value = {
      sharedViewCurrent: false,
      draftEditing: { available: true },
      confirmation: { available: false, reason: "Shared view unavailable." },
    };
    renderForm();

    expect(
      screen.getByText("Linking needs a current shared sync view")
    ).toBeDefined();
    expect(
      screen.getByRole("textbox", { name: /Work item URL/ })
    ).toBeDefined();
    expect(
      screen
        .getByRole("button", { name: "Link existing work item" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it("confirms one external reference for every selected practice in draft order (AC-028, AC-030)", async () => {
    renderForm();
    await fillValidReference();
    await submitForm();

    expect(confirm).toHaveBeenCalledOnce();
    const input = confirm.mock.calls[0]![0];
    // Every selected practice references the same external work item.
    expect(input.practices.map((p) => p.practiceId)).toEqual(["cl-1", "q-yn"]);
    expect(input.reference).toEqual({
      provider: "GitLab",
      externalId: "42",
      url: "https://gitlab.example.com/issues/42",
    });
  });

  it("emits confirmed and announces the linked reference on success (AC-028)", async () => {
    confirm.mockImplementation(async (input) => {
      const result = confirmHandoff({
        practices: input.practices,
        history: input.history,
        reference: input.reference,
        actorId: input.actorId,
        occurredAt: input.occurredAt,
        transitionIdFor: input.transitionIdFor,
      });
      return result;
    });
    const { emitted } = renderForm();
    await fillValidReference();
    await submitForm();

    expect(emitted().confirmed).toBeDefined();
    expect(screen.getByRole("status").textContent).toContain("GitLab 42");
  });

  it("rejects a non-HTTPS URL with a field-addressable error and no write (AC-039)", async () => {
    renderForm();
    await fireEvent.update(
      screen.getByRole("textbox", { name: /Work item URL/ }),
      "http://insecure.example.com/1"
    );
    await submitForm();

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText(/https:\/\//i)).toBeDefined();
  });

  it("rejects over-limit identifiers at the shared boundary without truncation (AC-039, AC-040)", async () => {
    renderForm();
    await fireEvent.update(
      screen.getByRole("textbox", { name: /Work item URL/ }),
      `https://gitlab.example.com/issues/${"X".repeat(129)}`
    );
    await submitForm();

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByText(/at most 128 characters/)).toBeDefined();
  });

  it("identifies every conflicting practice with its current reference (AC-031)", async () => {
    confirm.mockResolvedValue({
      ok: false,
      code: "duplicate_association",
      conflicts: [
        {
          practice: selectedRows(["cl-1"])[0]!.reference,
          current: {
            provider: "GitLab",
            externalId: "GL-1",
            url: "https://gitlab.example.com/issues/1",
          },
        },
        {
          practice: selectedRows(["q-yn"])[0]!.reference,
          current: {
            provider: "YouTrack",
            externalId: "YT-9",
            url: "https://youtrack.example.com/issue/YT-9",
          },
        },
      ],
    });
    renderForm();
    await fillValidReference();
    await submitForm();

    expect(screen.getByText(/already linked/)).toBeDefined();
    expect(screen.getByText(/Enable branch protection/)).toBeDefined();
    expect(screen.getByText(/GitLab GL-1/)).toBeDefined();
    expect(screen.getByText(/Is single sign-on enforced\?/)).toBeDefined();
    expect(screen.getByText(/YouTrack YT-9/)).toBeDefined();
    // Each conflict offers the explicit replacement path (AC-032).
    expect(screen.getAllByRole("button", { name: /Replace/ }).length).toBe(2);
  });

  it("surfaces the 50-practice maximum from a limit rejection (AC-042)", async () => {
    confirm.mockResolvedValue({
      ok: false,
      code: "practice_limit_exceeded",
      violations: [
        {
          field: "practices",
          code: "collection_limit_exceeded",
          limit: 50,
          actual: 51,
        },
      ],
    });
    renderForm();
    await fillValidReference();
    await submitForm();

    expect(screen.getByRole("alert").textContent).toMatch(
      /at most 50 practices/
    );
  });
});
