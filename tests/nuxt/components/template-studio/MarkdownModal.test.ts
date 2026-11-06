import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import MarkdownModal from "~/components/template-studio/MarkdownModal.vue";
import type { TemplateRevisionDetail } from "~/models";

const template: TemplateRevisionDetail = {
  id: "revision-1",
  templateId: "template-1",
  name: "Operational Readiness Review",
  description: "",
  status: "draft",
  revisionNumber: null,
  revisionSummary: null,
  createdByActorId: "actor-system",
  updatedByActorId: "actor-system",
  publishedByActorId: null,
  createdAt: "2026-08-20T10:00:00Z",
  updatedAt: "2026-08-20T10:00:00Z",
  publishedAt: null,
  pillars: [],
};

const renderModal = () =>
  render(MarkdownModal, {
    props: { isOpen: true, template },
    global: {
      stubs: {
        Icon: true,
        UModal: {
          template: '<div><slot name="content" /></div>',
          props: ["open", "title", "ui"],
        },
        UTextarea: {
          template:
            '<textarea :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: [
            "modelValue",
            "placeholder",
            "readonly",
            "autoresize",
            "rows",
            "variant",
            "color",
            "highlight",
            "ui",
          ],
        },
      },
    },
  });

describe("TemplateStudioMarkdownModal", () => {
  afterEach(cleanup);

  it("reviews a valid import before replacing the template", async () => {
    const { emitted } = renderModal();

    await fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await fireEvent.update(
      screen.getByPlaceholderText(/^# Template:/),
      "# Template: Imported\n\n## Pillar: Reliability\n\n### Question 1 [Critical]\nIs the service ready?"
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Review import" })
    );

    expect(
      screen.getByRole("heading", { name: "Review import" })
    ).toBeDefined();
    expect(emitted().import).toBeUndefined();

    await fireEvent.click(
      screen.getByRole("button", { name: "Replace template" })
    );
    expect(emitted().import).toHaveLength(1);
  });

  it("rejects legacy Rules Markdown without emitting a partial import", async () => {
    const { emitted } = renderModal();

    await fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await fireEvent.update(
      screen.getByPlaceholderText(/^# Template:/),
      `# Template: Legacy\n\n## Pillar: Reliability\n\n## Rules\n`
    );
    await fireEvent.click(
      screen.getByRole("button", { name: "Review import" })
    );

    expect(
      screen.getByText(
        'Template Rules are no longer supported. Remove the "## Rules" section and try again.'
      )
    ).toBeDefined();
    expect(emitted().import).toBeUndefined();
  });
});
