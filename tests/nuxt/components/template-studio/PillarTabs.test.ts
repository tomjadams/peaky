import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/vue";
import PillarTabs from "~/components/template-studio/PillarTabs.vue";

const sortable = vi.hoisted(() => ({
  create: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("sortablejs", () => ({
  default: { create: sortable.create },
}));

beforeEach(() => {
  vi.clearAllMocks();
  sortable.create.mockReturnValue({ destroy: sortable.destroy });
});

afterEach(cleanup);

it("initializes drag ordering when an asynchronously loaded draft becomes editable", async () => {
  const view = render(PillarTabs, {
    props: {
      pillars: [
        {
          id: "pillar-1",
          templateRevisionId: "revision-1",
          slug: "security",
          name: "Security",
          order: 1,
          questions: [],
        },
      ],
      activePillarSlug: "security",
      readonly: true,
    },
    global: {
      stubs: {
        Icon: true,
        UTooltip: { template: "<div><slot /></div>" },
        TemplateStudioPillarCreateModal: true,
      },
    },
  });

  expect(sortable.create).not.toHaveBeenCalled();
  await view.rerender({ readonly: false });
  await waitFor(() => expect(sortable.create).toHaveBeenCalledOnce());

  await view.rerender({ readonly: true });
  await waitFor(() => expect(sortable.destroy).toHaveBeenCalledOnce());
});
