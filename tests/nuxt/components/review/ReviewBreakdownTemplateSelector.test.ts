import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import ReviewBreakdownTemplateSelector from "~/components/review/ReviewBreakdownTemplateSelector.vue";
import type { ReviewTemplate } from "~/models/review-template";

const templates: ReviewTemplate[] = [
  {
    templateId: "template-a",
    templateRevisionId: "revision-a",
    templateName: "Operational Readiness Review",
    revisionNumber: 1,
    revisionSummary: null,
    progress: 60,
    pillars: [],
  },
  {
    templateId: "template-b",
    templateRevisionId: "revision-b",
    templateName: "SOC 2",
    revisionNumber: 1,
    revisionSummary: null,
    progress: 50,
    pillars: [],
  },
];
const selectMenuStub = {
  props: ["modelValue", "items"],
  emits: ["update:modelValue"],
  template: `<select aria-label="Choose breakdown template" :value="modelValue" @change="$emit('update:modelValue', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }} · {{ item.progress }}% answered</option></select>`,
};
const tabsStub = {
  props: ["modelValue", "items"],
  template: `<div role="tablist"><button v-for="item in items" :key="item.value" role="tab">{{ item.label }} · {{ item.progress }}% answered</button></div>`,
};

afterEach(cleanup);

describe("ReviewBreakdownTemplateSelector", () => {
  it("uses a full-width narrow selector and desktop tabs for the same templates", async () => {
    const view = render(ReviewBreakdownTemplateSelector, {
      props: { templates, modelValue: "template-a" },
      global: { stubs: { USelectMenu: selectMenuStub, UTabs: tabsStub } },
    });

    const selector = screen.getByRole("listbox", {
      name: "Choose breakdown template",
    });
    expect(selector.className).toContain("w-full");
    expect(screen.getByText("60% answered")).toBeDefined();
    expect(screen.getAllByRole("tab")).toHaveLength(2);

    await fireEvent.update(selector, "template-b");
    expect(view.emitted()["update:modelValue"]).toEqual([["template-b"]]);
  });

  it("adds no selector when only one template exists", () => {
    render(ReviewBreakdownTemplateSelector, {
      props: { templates: templates.slice(0, 1), modelValue: "template-a" },
    });
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});
