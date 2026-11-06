import { cleanup, render, waitFor } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { usePillarNotes } from "~/ui/usePillarNotes";
import { attachmentMutations } from "~/services/entity/AttachmentMutations";
import { noteMutations } from "~/services/entity/NoteMutations";

vi.mock("~/services/entity/AttachmentMutations", () => ({
  attachmentMutations: {
    fetchForScope: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    seed: vi.fn(),
  },
}));

vi.mock("~/services/entity/NoteMutations", () => ({
  noteMutations: {
    fetchByScope: vi.fn(),
    save: vi.fn(),
    seed: vi.fn(),
  },
}));

describe("usePillarNotes", () => {
  let pillarNotes: ReturnType<typeof usePillarNotes>;
  let fetchMock: ReturnType<typeof vi.fn>;

  const mountHarness = () => {
    const Harness = defineComponent({
      setup() {
        pillarNotes = usePillarNotes("review-123", "reliability");
        return () => null;
      },
    });

    return render(Harness);
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("$fetch", fetchMock);
    vi.mocked(noteMutations.fetchByScope).mockResolvedValue(null);
    vi.mocked(attachmentMutations.fetchForScope).mockResolvedValue([]);
    vi.mocked(noteMutations.save).mockResolvedValue();
    vi.mocked(noteMutations.seed).mockResolvedValue();
    vi.mocked(attachmentMutations.seed).mockResolvedValue();
    vi.mocked(attachmentMutations.delete).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("hydrates remote notes into local state when the browser has no local copy", async () => {
    fetchMock.mockResolvedValue({
      notes: {
        content: "Remote note",
        updatedAt: "2026-03-21T12:00:00.000Z",
      },
      attachments: [
        {
          id: "att-remote-1",
          filename: "evidence.pdf",
          contentType: "application/pdf",
          sizeBytes: 42,
          objectKey: "reviews/review-123/pillars/reliability/evidence.pdf",
          createdBy: "heitorl",
          createdByName: "Heitor Lessa",
          createdAt: "2026-03-21T12:00:00.000Z",
        },
      ],
    });

    mountHarness();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reviews/review-123/pillars/reliability/notes"
      );
    });

    expect(pillarNotes.notes.value.content).toBe("Remote note");
    expect(pillarNotes.attachments.value).toHaveLength(1);
    expect(noteMutations.seed).toHaveBeenCalledWith({
      reviewId: "review-123",
      scopeType: "pillar",
      scopeId: "reliability",
      content: "Remote note",
      updatedAt: "2026-03-21T12:00:00.000Z",
    });
    expect(attachmentMutations.seed).toHaveBeenCalled();
  });

  it("saves notes and attachment changes locally first without calling remote write routes", async () => {
    fetchMock.mockResolvedValue({
      notes: { content: "", updatedAt: "" },
      attachments: [],
    });

    vi.mocked(noteMutations.fetchByScope)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "review-123:pillar:reliability",
        reviewId: "review-123",
        scopeType: "pillar",
        scopeId: "reliability",
        content: "Saved locally",
        updatedAt: "2026-03-21T13:00:00.000Z",
      });

    vi.mocked(attachmentMutations.create).mockResolvedValue({
      id: "att-local-1",
      filename: "evidence.pdf",
      contentType: "application/pdf",
      sizeBytes: 128,
      objectKey:
        "reviews/review-123/pillar/reliability/att-local-1/evidence.pdf",
      createdBy: "heitorl",
      createdByName: "Heitor Lessa",
      createdAt: "2026-03-21T13:00:00.000Z",
    });

    mountHarness();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    pillarNotes.notes.value.content = "Saved locally";
    await pillarNotes.save();
    await pillarNotes.uploadAttachment(
      new File(["hello"], "evidence.pdf", { type: "application/pdf" })
    );
    await pillarNotes.removeAttachment("att-local-1");

    expect(noteMutations.save).toHaveBeenCalledWith(
      "review-123",
      "pillar",
      "reliability",
      "Saved locally"
    );
    expect(attachmentMutations.create).toHaveBeenCalled();
    expect(attachmentMutations.delete).toHaveBeenCalledWith(
      "review-123",
      "att-local-1"
    );

    const writeCalls = fetchMock.mock.calls.filter(([, options]) => options);
    expect(writeCalls).toEqual([]);
  });
});
