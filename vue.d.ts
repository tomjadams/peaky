// Vue SFC type shim for plain `tsc`.
// `nuxi typecheck` (vue-tsc) handles .vue files natively; this declaration
// lets tsc resolve component imports in test files without erroring.
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, any>, object, unknown>;
  export default component;
}
