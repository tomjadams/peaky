import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import { useDeploymentVersion } from "~/composables/useDeploymentVersion";

const { useNuxtAppMock } = vi.hoisted(() => ({
  useNuxtAppMock: vi.fn(),
}));
const fetchMock = vi.fn();
const wrappers: Array<ReturnType<typeof mount>> = [];

mockNuxtImport("useNuxtApp", () => useNuxtAppMock);

function mountComposable() {
  let state: ReturnType<typeof useDeploymentVersion> | undefined;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useDeploymentVersion();
        return {};
      },
      template: "<div />",
    })
  );

  wrappers.push(wrapper);
  return { wrapper, getState: () => state! };
}

describe("useDeploymentVersion", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    useNuxtAppMock.mockReturnValue({
      $config: { app: { buildId: "client-build" } },
    });
    vi.stubGlobal("$fetch", fetchMock);
  });

  afterEach(() => {
    for (const wrapper of wrappers.splice(0)) wrapper.unmount();
    vi.unstubAllGlobals();
    useNuxtAppMock.mockReset();
  });

  it("detects a replacement deployment on mount", async () => {
    fetchMock.mockResolvedValue({ buildId: "server-build" });

    const { getState } = mountComposable();
    await nextTick();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    expect(getState().hasNewVersion.value).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", {
      headers: { "Cache-Control": "no-cache" },
    });
  });

  it("does not prompt when the current deployment still matches", async () => {
    fetchMock.mockResolvedValue({ buildId: "client-build" });

    const { getState } = mountComposable();
    await nextTick();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    expect(getState().hasNewVersion.value).toBe(false);
  });

  it("does not query the health endpoint for a development client", async () => {
    useNuxtAppMock.mockReturnValue({
      $config: { app: { buildId: "dev" } },
    });

    const { getState } = mountComposable();
    await nextTick();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getState().hasNewVersion.value).toBe(false);
  });
});
