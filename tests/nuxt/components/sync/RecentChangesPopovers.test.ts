import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import RecentChangesChecklistPopover from "~/components/sync/RecentChangesChecklistPopover.vue";
import RecentChangesTrailPopover from "~/components/sync/RecentChangesTrailPopover.vue";
import type { RecentChangeEntry } from "~/composables/sync/useFieldVersions";
import {
  buildChecklistView,
  checklistCountSummary,
  checklistDiff,
} from "~/utils/recentChangesChecklist";

const UPopover = {
  props: ["open"],
  emits: ["update:open"],
  template: `
    <div>
      <div @click="$emit('update:open', true)"><slot /></div>
      <div v-if="open"><slot name="content" /></div>
    </div>
  `,
};

const trailEntry: RecentChangeEntry = {
  id: "change-2",
  entityId: "review-1:question-1",
  questionId: "question-1",
  pillarSlug: "reliability",
  answer: "yes",
  previousAnswer: "no",
  rawAnswer: "yes",
  rawPreviousAnswer: "no",
  actorId: "actor_dev",
  updatedAt: "2026-05-01T10:00:01.000Z",
  hlc: "1001:0001",
  isConflict: false,
  changeCount: 2,
  trail: [
    {
      id: "change-1",
      entityId: "review-1:question-1",
      questionId: "question-1",
      pillarSlug: "reliability",
      answer: "no",
      previousAnswer: null,
      rawAnswer: "no",
      rawPreviousAnswer: null,
      actorId: "actor_dev",
      updatedAt: "2026-05-01T10:00:00.000Z",
      hlc: "1000:0001",
      isConflict: false,
    },
  ],
};

const previousChecklist = { checked: [] as string[], na: [] as string[] };
const currentChecklist = { checked: ["item-1"], na: [] as string[] };
const checklistItems = [
  { id: "item-1", text: "Run failover tests" },
  { id: "item-2", text: "Document recovery targets" },
];
const diff = checklistDiff(previousChecklist, currentChecklist);
const checklistContext = {
  prev: previousChecklist,
  curr: currentChecklist,
  items: checklistItems,
  diff,
  view: buildChecklistView(
    previousChecklist,
    currentChecklist,
    checklistItems,
    diff
  ),
  summary: checklistCountSummary(previousChecklist, currentChecklist),
};

const global = { stubs: { Icon: true, UPopover } };

afterEach(cleanup);

it("keeps the intermediate trail open while its list scrolls", async () => {
  const { container } = render(RecentChangesTrailPopover, {
    props: { entry: trailEntry },
    global,
  });

  await fireEvent.click(screen.getByRole("button", { name: /2 changes/i }));
  await fireEvent.scroll(container.querySelector("ol")!);

  expect(screen.getByText("Intermediate trail")).toBeDefined();
});

it("keeps checklist details open while their body scrolls", async () => {
  const { container } = render(RecentChangesChecklistPopover, {
    props: { ctx: checklistContext, showPrevious: true },
    global,
  });

  await fireEvent.click(screen.getByRole("button"));
  await fireEvent.scroll(container.querySelector(".overflow-y-auto")!);

  expect(screen.getByText("Checklist")).toBeDefined();
});
