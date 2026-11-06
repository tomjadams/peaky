/**
 * Advisor override form (maturity-score/REQ-016; AC-030, AC-031, AC-043).
 *
 * Create requires a reviewed stage, whole percent, explanation, and at least
 * one evidence identifier; supersede points at the current transition;
 * revoke carries no reviewed result. The calculated maturity stays visible
 * for comparison. The form writes through the group-4 domain validation and
 * the group-9 outbound enqueue (recordMaturityOverride).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { nextTick, ref } from "vue";
import MaturityOverrideModal from "~/components/maturity/MaturityOverrideModal.vue";
import { recordMaturityOverride } from "~/services/maturity/overrideWrite";
import { advisorOverride, resultEntry, stagePathWorkspace } from "./fixtures";

vi.mock("~/services/maturity/overrideWrite", () => ({
  recordMaturityOverride: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: ref({ id: "advisor-1", name: "Advisor One", roles: [] }),
  }),
}));

vi.mock("~/local-db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/local-db")>();
  return { ...actual, createUuidV7: vi.fn(() => "ovr-new") };
});

const modalStub = {
  props: ["open", "title"],
  template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /><slot name="footer" /></div>`,
};

const selectStub = {
  inheritAttrs: false,
  props: ["modelValue", "items", "ariaLabel"],
  emits: ["update:modelValue"],
  template: `<select :aria-label="ariaLabel" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="String(item.value)" :value="item.value">{{ item.label }}</option></select>`,
};

const renderModal = (workspace: ReturnType<typeof stagePathWorkspace>) =>
  render(MaturityOverrideModal, {
    props: { open: true, workspace, entry: resultEntry(workspace) },
    global: { stubs: { UModal: modalStub, USelect: selectStub } },
  });

const record = vi.mocked(recordMaturityOverride);

/** Fills the form with a valid reviewed result. */
async function fillValidForm() {
  await fireEvent.update(
    screen.getByRole("combobox", { name: /reviewed stage/i }),
    "4"
  );
  await fireEvent.update(
    screen.getByRole("spinbutton", { name: /reviewed percentage/i }),
    "75"
  );
  await fireEvent.update(
    screen.getByRole("textbox", { name: /explanation/i }),
    "Evidence verified on site."
  );
  await fireEvent.update(
    screen.getByRole("textbox", { name: /evidence/i }),
    "EV-100"
  );
}

describe("MaturityOverrideModal", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("shows the calculated value for comparison (AC-030)", () => {
    renderModal(stagePathWorkspace());
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Calculated: 25%/);
    expect(dialog.textContent).toContain("Ad-hoc");
  });

  it("requires explanation and evidence on create (REQ-016, AC-043)", async () => {
    renderModal(stagePathWorkspace());
    await fireEvent.click(
      screen.getByRole("button", { name: /^Save override$/i })
    );
    await nextTick();

    expect(screen.getByText(/Explanation is required/)).toBeDefined();
    expect(
      screen.getByText(/At least one evidence identifier is required/)
    ).toBeDefined();
    expect(record).not.toHaveBeenCalled();
  });

  it("creates the first override transition (AC-030)", async () => {
    const { emitted } = renderModal(stagePathWorkspace());
    await fillValidForm();
    await fireEvent.click(
      screen.getByRole("button", { name: /^Save override$/i })
    );
    await nextTick();

    expect(record).toHaveBeenCalledOnce();
    const { transition } = record.mock.calls[0]![0] as unknown as {
      transition: Record<string, unknown>;
    };
    expect(transition).toMatchObject({
      id: "ovr-new",
      reviewId: "review-1",
      templateRevisionId: "rev-1",
      action: "create",
      actorId: "advisor-1",
      priorTransitionId: null,
      reviewedResult: { percent: 75, stage: 4 },
      explanation: "Evidence verified on site.",
      evidence: ["EV-100"],
    });
    expect(emitted().saved).toBeDefined();
  });

  it("supersedes the current override by pointing at it (AC-031, AC-043)", async () => {
    renderModal(stagePathWorkspace([advisorOverride]));
    const dialog = screen.getByRole("dialog");
    // The current override stays visible while it is being replaced, and
    // the dialog names the transition being recorded.
    expect(dialog.textContent).toMatch(/Current override: 75%/);
    expect(dialog.getAttribute("aria-label")).toMatch(/supersede/i);

    await fillValidForm();
    await fireEvent.click(
      screen.getByRole("button", { name: /^Save supersede$/i })
    );
    await nextTick();

    const { transition } = record.mock.calls[0]![0] as unknown as {
      transition: Record<string, unknown>;
    };
    expect(transition).toMatchObject({
      action: "supersede",
      priorTransitionId: "ovr-1",
    });
  });

  it("revokes the current override without a reviewed result (AC-031)", async () => {
    renderModal(stagePathWorkspace([advisorOverride]));

    // Revoke is an explicit mode: the reviewed-result fields drop out
    // (revoke records none) and nothing is submitted yet.
    await fireEvent.click(
      screen.getByRole("button", { name: /^Revoke override$/i })
    );
    await nextTick();
    expect(
      screen.queryByRole("combobox", { name: /reviewed stage/i })
    ).toBeNull();
    expect(record).not.toHaveBeenCalled();

    // Revoke still requires an explanation.
    await fireEvent.click(
      screen.getByRole("button", { name: /Confirm revoke/i })
    );
    await nextTick();
    expect(screen.getByText(/Explanation is required/)).toBeDefined();
    expect(record).not.toHaveBeenCalled();

    await fireEvent.update(
      screen.getByRole("textbox", { name: /explanation/i }),
      "Evidence no longer applies."
    );
    await fireEvent.click(
      screen.getByRole("button", { name: /Confirm revoke/i })
    );
    await nextTick();

    const { transition } = record.mock.calls[0]![0] as unknown as {
      transition: Record<string, unknown>;
    };
    expect(transition).toMatchObject({
      action: "revoke",
      priorTransitionId: "ovr-1",
      reviewedResult: null,
      explanation: "Evidence no longer applies.",
    });
  });
});
