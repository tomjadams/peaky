import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import Header from "~/components/template-studio/Header.vue";
import type { Template, TemplateRevisionDetail } from "~/models";

vi.mock("~/composables/nav/useCommandPalette", () => ({
  useCommandPalette: () => ({ open: vi.fn() }),
}));

const template: Template = {
  id: "template-1",
  name: "Operational Readiness",
  description: "Current metadata",
  status: "active",
  ownerTeamId: "team-platform",
  createdByActorId: "actor-creator",
  updatedByActorId: "actor-editor",
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T11:00:00Z",
};

const draftRevision: TemplateRevisionDetail = {
  id: "revision-draft-1",
  templateId: template.id,
  name: "Operational Readiness",
  description: "Draft snapshot",
  status: "draft",
  revisionNumber: null,
  revisionSummary: null,
  createdByActorId: "actor-creator",
  updatedByActorId: "actor-editor",
  publishedByActorId: null,
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T11:00:00Z",
  publishedAt: null,
  pillars: [],
};

const renderHeader = (
  revision: TemplateRevisionDetail = draftRevision,
  saveStatus: "idle" | "saving" | "saved" | "error" = "idle",
  overrides: Record<string, unknown> = {}
) =>
  render(Header, {
    props: {
      template,
      revision,
      editable: revision.status === "draft",
      saveStatus,
      lastSavedAt:
        saveStatus === "saved" ? new Date("2026-08-20T11:00:00Z") : null,
      isDirty: saveStatus === "idle",
      ...overrides,
    } as never,
    global: {
      stubs: {
        NuxtLink: { template: "<a><slot /></a>" },
        Icon: true,
        ThemeToggle: true,
        UTooltip: { template: "<div><slot /></div>" },
        UButton: {
          props: ["label"],
          template: "<button>{{ label }}<slot /></button>",
        },
        UFormField: {
          props: ["label", "error", "required"],
          template:
            "<label><span>{{ label }}</span><slot /><span v-if='error'>{{ error }}</span></label>",
        },
        USelect: {
          props: ["items", "modelValue", "required"],
          template:
            "<select :value='modelValue' :required='required'><option v-for='item in items' :key='item.value' :value='item.value'>{{ item.label }}</option></select>",
        },
      },
    },
  });

afterEach(cleanup);

describe("Template Studio header", () => {
  it("requires an owner Team in Template details before first save", async () => {
    renderHeader(draftRevision, "idle", {
      template: { ...template, id: "", ownerTeamId: "" },
      ownerTeamId: null,
      ownerTeamItems: [
        { label: "Platform Engineering", value: "team-platform" },
      ],
      ownerTeamError: "Select an owner Team",
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Operational Readiness" })
    );

    const ownerTeam = screen.getByRole("combobox", { name: "Owner Team" });
    expect((ownerTeam as HTMLSelectElement).required).toBe(true);
    expect(
      screen.getByRole("option", { name: "Platform Engineering" })
    ).toBeTruthy();
    expect(screen.getByText("Select an owner Team")).toBeTruthy();
  });

  it("shows the immutable owner in Template details", async () => {
    renderHeader(draftRevision, "idle", {
      ownerTeamId: "team-missing-from-mirror",
      ownerTeamItems: [],
    });
    await fireEvent.click(
      screen.getByRole("button", { name: "Operational Readiness" })
    );

    expect(screen.getByText("team-missing-from-mirror")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Owner Team" })).toBeNull();
  });

  it("keeps the header focused on one Revision status", () => {
    renderHeader();

    expect(screen.getByText("Draft", { exact: true })).toBeTruthy();
    expect(screen.queryByText("Template active")).toBeNull();
    expect(screen.queryByText("Revision draft")).toBeNull();
    expect(screen.queryByText("Local only")).toBeNull();
  });

  it("reports local draft persistence once", () => {
    renderHeader(draftRevision, "saved");

    expect(screen.queryByText("Local only")).toBeNull();
    expect(screen.getByText("Saved locally")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Draft" })).toBeTruthy();
  });

  it("renders a published Revision snapshot without editable snapshot fields", () => {
    const publishedRevision: TemplateRevisionDetail = {
      ...draftRevision,
      id: "revision-published-4",
      name: "Published Operational Readiness",
      status: "published",
      revisionNumber: 4,
      publishedByActorId: "actor-publisher",
      publishedAt: "2026-08-20T12:00:00Z",
    };

    renderHeader(publishedRevision);

    expect(screen.getByText("Published Operational Readiness")).toBeTruthy();
    expect(screen.getByText("Published · v4")).toBeTruthy();
    expect(screen.queryByText("Revision published")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Published Operational Readiness" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Draft" })).toBeNull();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getAllByTestId("header-separator")).toHaveLength(1);
  });

  it("keeps draft actions without publication, lifecycle, or delete controls", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: "Save Draft" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview" })).toBeTruthy();
    expect(screen.getByTestId("markdown-modal-trigger")).toBeTruthy();
    expect(screen.getAllByTestId("header-separator")).toHaveLength(2);
    for (const action of [
      "Publish",
      "Archive",
      "Restore",
      "Delete draft",
      "Delete permanently",
    ]) {
      expect(screen.queryByRole("button", { name: action })).toBeNull();
    }
  });

  it("uses the template name as the page heading and names icon actions", () => {
    renderHeader();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Operational Readiness",
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Export or import Markdown" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share template" })).toBeTruthy();
  });

  it("reflows actions below the desktop breakpoint", () => {
    renderHeader();

    expect(screen.getByRole("banner").className).toContain("flex-wrap");
    expect(screen.getByTestId("studio-header-actions").className).toContain(
      "basis-full"
    );
    expect(screen.getByTestId("studio-header-actions").className).toContain(
      "flex-wrap"
    );
  });

  it("shows a neutral cold-route loading state", () => {
    renderHeader(draftRevision, "idle", {
      template: null,
      revision: null,
      loading: true,
    });

    expect(
      screen.getByRole("status", { name: "Loading template" })
    ).toBeTruthy();
    expect(screen.getByRole("banner").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Untitled")).toBeNull();
    expect(screen.queryByText("Draft", { exact: true })).toBeNull();
    expect(screen.queryByText("Pillars", { exact: true })).toBeNull();
  });
});
