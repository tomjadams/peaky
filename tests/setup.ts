import { config } from "@vue/test-utils";

// Stub router components unavailable in the test environment.
// Components that render <RouterLink> or <NuxtLink> would otherwise
// produce "Failed to resolve component" warnings on every test.
config.global.stubs["RouterLink"] = { template: "<a><slot /></a>" };
config.global.stubs["NuxtLink"] = { template: "<a><slot /></a>" };

// Suppress known framework-level warnings that are not actionable in tests:
//
// 1. "inject() can only be used inside setup()" — emitted by Nuxt's own
//    runtime initialisation when the nuxt test environment boots; it fires
//    even in pure unit tests that mount no components and cannot be fixed
//    at the test layer. These warnings bypass VTU's warnHandler because
//    they originate before any VTU app instance is created.
//
// 2. "Missing ref owner context" — emitted by reka-ui's CheckboxRoot
//    which attaches a ref to a hoisted vnode. Upstream issue; tests pass
//    correctly despite the warning.
const SUPPRESSED: string[] = [
  "inject() can only be used inside setup() or functional components",
  "Missing ref owner context. ref cannot be used on hoisted vnodes",
];

const _originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  const msg = args.map(String).join(" ");
  if (SUPPRESSED.some((p) => msg.includes(p))) return;
  _originalWarn(...args);
};

config.global.config.warnHandler = (msg: string, _instance, _trace) => {
  if (SUPPRESSED.some((p) => msg.startsWith(p))) return;
  _originalWarn("[Vue warn]:", msg);
};
