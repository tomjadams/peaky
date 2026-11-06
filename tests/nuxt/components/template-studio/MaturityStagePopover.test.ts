import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import MaturityStagePopover from "~/components/template-studio/MaturityStagePopover.vue";
import {
  DEFAULT_THRESHOLDS,
  type MaturityStageNumber,
  type StageThresholds,
} from "~/services/maturity/stages";

interface PopoverProps {
  stage: MaturityStageNumber;
  thresholds: StageThresholds;
  percent?: number | null;
  displayPercent?: number | null;
  previewPercent?: number | null;
  previewFromDisplayPercent?: number | null;
  previewDisplayPercent?: number | null;
  previewStage?: MaturityStageNumber | null;
  triggerClass?: string;
}

const baseProps: PopoverProps = {
  stage: 2,
  thresholds: DEFAULT_THRESHOLDS,
};

const popoverStub = {
  props: ["open"],
  emits: ["update:open"],
  template: `<span :data-open="String(open)"><slot /><div role="dialog"><slot name="content" /></div></span>`,
};

function renderPopover(
  overrides: Partial<PopoverProps> = {},
  slots?: { trigger: string }
) {
  return render(MaturityStagePopover, {
    props: { ...baseProps, ...overrides },
    slots,
    global: { stubs: { UPopover: popoverStub } },
  });
}

afterEach(cleanup);

describe("Template Studio maturity stage popover", () => {
  it("keeps only the most recently hovered maturity detail open", async () => {
    const Host = defineComponent({
      setup() {
        return () =>
          h("div", [
            h(MaturityStagePopover, {
              stage: 1,
              thresholds: DEFAULT_THRESHOLDS,
            }),
            h(MaturityStagePopover, {
              stage: 2,
              thresholds: DEFAULT_THRESHOLDS,
            }),
          ]);
      },
    });
    render(Host, { global: { stubs: { UPopover: popoverStub } } });

    const triggers = screen.getAllByRole("button");
    await fireEvent.mouseEnter(triggers[0]!);
    expect(triggers[0]!.parentElement!.dataset.open).toBe("true");

    await fireEvent.mouseEnter(triggers[1]!);
    expect(triggers[0]!.parentElement!.dataset.open).toBe("false");
    expect(triggers[1]!.parentElement!.dataset.open).toBe("true");
  });

  it("uses one semantic trigger and supports custom trigger copy", () => {
    renderPopover({ triggerClass: "text-base" }, { trigger: "Ad-hoc" });

    const trigger = screen.getByRole("button", {
      name: "About Stage 2, Ad-hoc",
    });
    expect(trigger.textContent).toBe("Ad-hoc");
    expect(trigger.className).toContain("decoration-dotted");
    expect(trigger.className).toContain("text-base");
    const tooltip = screen.getByRole("dialog");
    expect(tooltip.firstElementChild?.className).toContain("calc(100vw-2rem)");
  });

  it("uses the stage label by default and shows the canonical description", () => {
    renderPopover({ stage: 3 });

    expect(
      screen.getByRole("button", { name: "About Stage 3, Defined" }).textContent
    ).toBe("Stage 3 · Defined");
    expect(screen.getByRole("dialog").textContent).toContain(
      "Shared practices are documented and used consistently."
    );
  });

  it("sizes the score bands in proportion to the configured thresholds", () => {
    renderPopover({ stage: 1, thresholds: [5, 25, 50, 75] });

    expect(
      screen.getByTestId("maturity-stage-score-bands").getAttribute("style")
    ).toContain("grid-template-columns: 5fr 20fr 25fr 25fr 25fr");
  });

  it("shows the selected range and next threshold in top-authoring mode", () => {
    renderPopover();

    const tooltip = screen.getByRole("dialog");
    expect(tooltip.textContent).toContain("5 to under 25%");
    expect(tooltip.textContent).toContain("Next: Stage 3 · Defined at 25%");
    expect(tooltip.textContent).not.toContain("% now");
    expect(tooltip.textContent).not.toContain("exact score");

    const bands = tooltip.querySelectorAll<HTMLElement>("[data-stage-band]");
    expect(
      [...bands].map(
        (band) =>
          band.querySelector<HTMLElement>("[data-stage-fill]")?.style.width ??
          null
      )
    ).toEqual([null, "100%", null, null, null]);
    expect(bands[1]?.getAttribute("aria-current")).toBe("true");
    expect(bands[1]?.className).toContain("outline");
  });

  it("uses exact progress and display rounding through the percent API", () => {
    renderPopover({ stage: 3, percent: 37.5, displayPercent: 38 });

    const tooltip = screen.getByRole("dialog");
    expect(tooltip.textContent).toContain("38% now");
    expect(tooltip.textContent).toContain("Next: Stage 4 · Measured at 50%");
    expect(tooltip.textContent).toContain(
      "Peaky uses the exact score to choose the stage. The percentage shown here is rounded to the nearest whole number."
    );
    expect(tooltip.textContent).not.toContain("Current band");

    const bands = tooltip.querySelectorAll<HTMLElement>("[data-stage-band]");
    expect(
      [...bands].map(
        (band) =>
          band.querySelector<HTMLElement>("[data-stage-fill]")?.style.width ??
          null
      )
    ).toEqual(["100%", "100%", "50%", null, null]);
  });

  it("shows a static current and handoff-preview strip for small movement", () => {
    renderPopover({
      stage: 4,
      percent: 58.9,
      displayPercent: 59,
      previewPercent: 59.5,
      previewFromDisplayPercent: 58.9,
      previewDisplayPercent: 59.5,
      previewStage: 4,
    });

    const graphic = screen.getByRole("img", {
      name: "Current maturity 58.9 percent. Completing the handoff previews 59.5 percent.",
    });
    const current = graphic.querySelector<HTMLElement>("[data-current-fill]");
    const preview = graphic.querySelector<HTMLElement>("[data-preview-fill]");
    expect(current?.style.width).toBe("58.9%");
    expect(preview?.style.left).toBe("58.9%");
    expect(preview?.style.width).toMatch(/^0\.6/);
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("opens on hover and closes after the pointer leaves", async () => {
    renderPopover();
    const trigger = screen.getByRole("button", {
      name: "About Stage 2, Ad-hoc",
    });
    const wrapper = trigger.parentElement!;

    expect(wrapper.dataset.open).toBe("false");
    await fireEvent.mouseEnter(trigger);
    expect(wrapper.dataset.open).toBe("true");

    await fireEvent.mouseLeave(trigger);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(wrapper.dataset.open).toBe("false");
  });

  it("keeps trigger focus when Escape dismisses the detail", async () => {
    renderPopover();
    const trigger = screen.getByRole("button", {
      name: "About Stage 2, Ad-hoc",
    });
    const wrapper = trigger.parentElement!;

    trigger.focus();
    await fireEvent.click(trigger);
    expect(document.activeElement).toBe(trigger);
    expect(wrapper.dataset.open).toBe("true");

    await fireEvent.keyDown(trigger, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    expect(wrapper.dataset.open).toBe("false");
  });
});
