import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/vue";
import NavigationSidebar from "~/components/NavigationSidebar.vue";

vi.mock("~/composables/useAuth", () => ({
  useAuth: () => ({
    user: { __v_isRef: true, value: null },
  }),
}));

vi.mock("~/composables/auth/useCurrentActor", () => ({
  useCurrentActor: () => ({
    actor: {
      __v_isRef: true,
      value: { name: "Reviewer", roles: ["reviewer"] },
    },
    isSelfClaimAdmin: { __v_isRef: true, value: false },
  }),
}));

const global = {
  stubs: {
    Icon: true,
    PeakyLogo: true,
    ProfileModal: { template: "<div><slot /></div>" },
    UTooltip: { template: "<div><slot /></div>" },
    NuxtLink: {
      props: ["to"],
      template: '<a :href="to"><slot /></a>',
    },
  },
};

afterEach(cleanup);

it("positions the default sidebar from the measured app header", () => {
  const { container } = render(NavigationSidebar, { global });
  const sidebar = container.querySelector(".nav-sidebar");

  expect(sidebar?.classList.contains("nav-sidebar--below-header")).toBe(true);
  expect(sidebar?.classList.contains("inset-y-0")).toBe(false);
});

it("keeps compact chrome full-height and preserves navigation hit areas", () => {
  const { container } = render(NavigationSidebar, {
    props: { compact: true },
    global,
  });
  const sidebar = container.querySelector(".nav-sidebar");

  expect(sidebar?.classList.contains("inset-y-0")).toBe(true);
  expect(sidebar?.classList.contains("nav-sidebar--below-header")).toBe(false);
  for (const item of container.querySelectorAll(".nav-sidebar__menu-item")) {
    expect(item.classList.contains("h-12")).toBe(true);
    expect(item.classList.contains("w-12")).toBe(true);
  }
});
