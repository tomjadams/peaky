import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/vue";
import TemplatesPage from "~/pages/templates/index.vue";

const { catalogEntries } = vi.hoisted(() => ({
  catalogEntries: [
    {
      template: {
        id: "template-1",
        name: "Operational Readiness",
        description: "Current aggregate metadata",
        status: "active",
        ownerTeamId: "team-platform",
        createdByActorId: "actor-creator",
        updatedByActorId: "actor-editor",
        createdAt: "2026-08-20T08:00:00.000Z",
        updatedAt: "2026-08-20T09:00:00.000Z",
      },
      draftRevision: {
        id: "revision-draft",
        templateId: "template-1",
        name: "Operational Readiness",
        description: "Draft snapshot",
        status: "draft",
        revisionNumber: null,
        revisionSummary: null,
        publishedAt: null,
      },
      publishedRevisions: [
        {
          id: "revision-published-2",
          templateId: "template-1",
          name: "Published Operational Readiness",
          description: "Published snapshot",
          status: "published",
          revisionNumber: 2,
          revisionSummary: "Second publication",
          publishedAt: "2026-08-20T10:00:00.000Z",
        },
      ],
      pillarSlugsByRevisionId: {
        "revision-draft": ["reliability"],
        "revision-published-2": ["reliability"],
      },
      reviewsCount: 4,
      canEditDraft: true,
    },
    {
      template: {
        id: "template-archived",
        name: "Archived Security Review",
        description: "Archived aggregate metadata",
        status: "archived",
        ownerTeamId: "team-security",
        createdByActorId: "actor-creator",
        updatedByActorId: "actor-editor",
        createdAt: "2026-08-19T08:00:00.000Z",
        updatedAt: "2026-08-19T09:00:00.000Z",
      },
      draftRevision: null,
      publishedRevisions: [],
      pillarSlugsByRevisionId: {},
      reviewsCount: 0,
      canEditDraft: false,
    },
  ],
}));

vi.mock("~/composables/templates/domain/useTemplateCatalog", () => ({
  useTemplateCatalog: () => ({ templates: { value: catalogEntries } }),
}));

vi.mock("~/composables/nav/usePageHeader", () => ({
  usePageHeader: () => ({ setPageHeader: vi.fn() }),
}));

vi.mock("~/composables/nav/useCommandPalette", () => ({
  useCommandPalette: () => ({ registerCommands: () => vi.fn() }),
}));

const renderPage = () =>
  render(TemplatesPage, {
    global: {
      stubs: {
        Icon: true,
        SearchInput: {
          props: ["modelValue", "placeholder"],
          template: "<input :value='modelValue' :placeholder='placeholder' />",
        },
        UBadge: { template: "<span><slot /></span>" },
        UButton: {
          props: ["label"],
          template: "<button>{{ label }}<slot /></button>",
        },
        UTooltip: { template: "<span><slot /></span>" },
      },
    },
  });

afterEach(cleanup);

describe("Templates management Revision projection", () => {
  it("shows the requested status, revision, draft presence, and usage labels", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Operational Readiness/i });

    expect(
      screen.getByRole("columnheader", { name: "Current revision" })
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Draft" })).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Review using" })
    ).toBeTruthy();
    expect(within(row).getByText("Active")).toBeTruthy();
    expect(within(row).getByLabelText("Draft available")).toBeTruthy();
    expect(within(row).getByText("v2")).toBeTruthy();
    expect(within(row).getByText("4", { exact: true })).toBeTruthy();
  });

  it("renders an empty draft cell without fabricating a published revision", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Archived Security Review/i });

    expect(within(row).getByText("Archived")).toBeTruthy();
    expect(within(row).queryByLabelText("Draft available")).toBeNull();
    expect(within(row).getByText("No published revision")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: "View" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("exposes the selected lifecycle filter programmatically", async () => {
    renderPage();
    const all = screen.getByRole("button", { name: "All" });
    const archived = screen.getByRole("button", { name: "Archived" });

    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(archived.getAttribute("aria-pressed")).toBe("false");
    await fireEvent.click(archived);
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(archived.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps editing out of the row actions", () => {
    renderPage();
    const row = screen.getByRole("row", { name: /Operational Readiness/i });

    for (const action of [
      "Edit",
      "Publish",
      "Archive",
      "Restore",
      "Delete draft",
      "Delete permanently",
    ]) {
      expect(within(row).queryByRole("button", { name: action })).toBeNull();
    }
  });
});
