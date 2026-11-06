import { describe, it, expect, afterEach, vi } from "vitest";
import { ref, nextTick } from "vue";
import { render, screen, cleanup } from "@testing-library/vue";
import RecentChanges from "~/components/sync/RecentChanges.vue";

const mockEntries = ref<Array<Record<string, unknown>>>([]);
const mockIsLoading = ref(false);
const mockIsLoadingMore = ref(false);
const mockHasMore = ref(false);
const mockLoadMore = vi.fn();
const mockUsers = ref<{ id: string; displayName: string }[]>([]);
const mockActor = ref({
  id: "okta-sub-1",
  name: "Okta User",
  roles: ["member"],
});

vi.mock("~/composables/catalog/useCatalogUserSearch", () => ({
  useCatalogUserSearch: () => ({ allUsers: mockUsers }),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({ actor: mockActor }),
}));

vi.mock("~/composables/sync/useFieldVersions", () => ({
  useFieldVersions: vi.fn(() => ({
    entries: mockEntries,
    isLoading: mockIsLoading,
    isLoadingMore: mockIsLoadingMore,
    hasMore: mockHasMore,
    loadMore: mockLoadMore,
  })),
}));

// Hoisted to module scope — does not close over any test-local variables.
const renderComponent = () => {
  return render(RecentChanges, {
    props: { reviewId: "rev-1" },
    global: {
      stubs: {
        DataTable: {
          template: `
              <div data-testid="recent-changes-table">
                <div v-for="row in data" :key="String(row[rowKey])" class="row">
                  <slot name="cell-question" :row="row" />
                  <slot name="cell-answer" :row="row" />
                  <slot name="cell-who" :row="row" />
                </div>
              </div>
            `,
          props: ["data", "rowKey", "columns"],
        },
        UTooltip: {
          template: "<div><slot /></div>",
        },
        UInput: true,
        UDropdownMenu: true,
        UButton: true,
        UPopover: {
          template: "<div><slot /><slot name='content' /></div>",
        },
        Icon: true,
        InlineMarkdown: {
          template: "<span>{{ text }}</span>",
          props: ["text"],
        },
      },
    },
  });
};

describe("RecentChanges", () => {
  afterEach(() => {
    cleanup();
    mockEntries.value = [];
    mockIsLoading.value = false;
    mockIsLoadingMore.value = false;
    mockHasMore.value = false;
    mockUsers.value = [];
    mockActor.value = {
      id: "okta-sub-1",
      name: "Okta User",
      roles: ["member"],
    };
  });

  it("shows the Overridden badge when isConflict is true", async () => {
    mockEntries.value = [
      {
        id: "entry-1",
        entityId: "rev-1:infrastructure-q-1",
        questionId: "infrastructure-q-1",
        pillarSlug: "infrastructure",
        answer: "yes",
        previousAnswer: null,
        rawAnswer: "yes",
        rawPreviousAnswer: null,
        actorId: "actor_bob",
        updatedAt: new Date().toISOString(),
        hlc: "1000:0001",
        isConflict: true,
        changeCount: 1,
        trail: [],
      },
    ];

    renderComponent();
    await nextTick();

    expect(screen.getByText("Overridden")).toBeDefined();
  });

  it("does not show the Overridden badge when isConflict is false", async () => {
    mockEntries.value = [
      {
        id: "entry-1",
        entityId: "rev-1:infrastructure-q-1",
        questionId: "infrastructure-q-1",
        pillarSlug: "infrastructure",
        answer: "yes",
        previousAnswer: null,
        rawAnswer: "yes",
        rawPreviousAnswer: null,
        actorId: "actor_dev",
        updatedAt: new Date().toISOString(),
        hlc: "1000:0001",
        isConflict: false,
        changeCount: 1,
        trail: [],
      },
    ];

    renderComponent();
    await nextTick();

    expect(screen.queryByText("Overridden")).toBeNull();
  });

  it("shows a short question reference instead of its storage ID", async () => {
    const questionId = "01932b3c-7d00-7000-8100-000000001001:question:01:01";
    mockEntries.value = [
      {
        id: "entry-1",
        entityId: `rev-1:${questionId}`,
        questionId,
        questionReference: "REL-1",
        pillarSlug: "reliability-resilience",
        answer: "yes",
        previousAnswer: null,
        rawAnswer: "yes",
        rawPreviousAnswer: null,
        actorId: "actor_dev",
        updatedAt: new Date().toISOString(),
        hlc: "1000:0001",
        isConflict: false,
        changeCount: 1,
        trail: [],
      },
    ];

    renderComponent();
    await nextTick();

    expect(screen.getByText("REL-1")).toBeDefined();
    expect(screen.queryByText(questionId)).toBeNull();
  });

  it("shows the current actor name instead of an opaque ID", async () => {
    mockEntries.value = [
      {
        id: "entry-1",
        entityId: "rev-1:infrastructure-q-1",
        questionId: "infrastructure-q-1",
        pillarSlug: "infrastructure",
        answer: "yes",
        previousAnswer: null,
        rawAnswer: "yes",
        rawPreviousAnswer: null,
        actorId: "okta-sub-1",
        updatedAt: new Date().toISOString(),
        hlc: "1000:0001",
        isConflict: false,
        changeCount: 1,
        trail: [],
      },
    ];

    renderComponent();
    await nextTick();

    expect(screen.getByText("Okta User")).toBeDefined();
    expect(screen.queryByText("Okta-sub-1")).toBeNull();
  });

  it("shows the grouped change count and intermediate trail", async () => {
    const firstAt = "2026-05-01T10:00:00.000Z";
    const secondAt = "2026-05-01T10:00:01.000Z";
    const thirdAt = "2026-05-01T10:00:02.000Z";
    mockEntries.value = [
      {
        id: "entry-3",
        entityId: "rev-1:infrastructure-q-1",
        questionId: "infrastructure-q-1",
        pillarSlug: "infrastructure",
        answer: "yes",
        previousAnswer: null,
        rawAnswer: "yes",
        rawPreviousAnswer: null,
        actorId: "actor_dev",
        updatedAt: thirdAt,
        hlc: "3000:0001",
        isConflict: false,
        changeCount: 3,
        trail: [
          {
            id: "entry-1",
            entityId: "rev-1:infrastructure-q-1",
            questionId: "infrastructure-q-1",
            pillarSlug: "infrastructure",
            answer: "yes",
            previousAnswer: null,
            rawAnswer: "yes",
            rawPreviousAnswer: null,
            actorId: "actor_dev",
            updatedAt: firstAt,
            hlc: "1000:0001",
            isConflict: false,
          },
          {
            id: "entry-2",
            entityId: "rev-1:infrastructure-q-1",
            questionId: "infrastructure-q-1",
            pillarSlug: "infrastructure",
            answer: "no",
            previousAnswer: "yes",
            rawAnswer: "no",
            rawPreviousAnswer: "yes",
            actorId: "actor_dev",
            updatedAt: secondAt,
            hlc: "2000:0001",
            isConflict: false,
          },
          {
            id: "entry-3",
            entityId: "rev-1:infrastructure-q-1",
            questionId: "infrastructure-q-1",
            pillarSlug: "infrastructure",
            answer: "yes",
            previousAnswer: "no",
            rawAnswer: "yes",
            rawPreviousAnswer: "no",
            actorId: "actor_dev",
            updatedAt: thirdAt,
            hlc: "3000:0001",
            isConflict: false,
          },
        ],
      },
    ];

    renderComponent();
    await nextTick();

    expect(screen.getByText("3 changes")).toBeDefined();
    expect(screen.getByText("Intermediate trail")).toBeDefined();
    expect(screen.getAllByText("No").length).toBeGreaterThan(0);
  });
});
