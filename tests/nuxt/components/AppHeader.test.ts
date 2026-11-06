import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/vue";
import { nextTick } from "vue";
import AppHeader from "~/components/AppHeader.vue";

let headerHeight = 145;
let resizeCallback: ResizeObserverCallback | null = null;

class ResizeObserverMock implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  document.documentElement.style.removeProperty("--app-header-height");
  headerHeight = 145;
  resizeCallback = null;
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, 625, headerHeight)
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--app-header-height");
});

it("publishes the rendered header height for fixed app chrome", async () => {
  const view = render(AppHeader, {
    global: {
      stubs: {
        Icon: true,
        NuxtLink: { template: "<a><slot /></a>" },
        SyncStatusIndicator: { template: "<button>Sync</button>" },
        ThemeToggle: { template: "<button>Theme</button>" },
        UButton: {
          props: ["label"],
          template: "<button>{{ label }}<slot /></button>",
        },
      },
    },
  });
  await nextTick();

  expect(
    document.documentElement.style.getPropertyValue("--app-header-height")
  ).toBe("145px");

  headerHeight = 77;
  resizeCallback?.([], {} as ResizeObserver);
  await nextTick();
  expect(
    document.documentElement.style.getPropertyValue("--app-header-height")
  ).toBe("77px");

  view.unmount();
  expect(
    document.documentElement.style.getPropertyValue("--app-header-height")
  ).toBe("");
});
