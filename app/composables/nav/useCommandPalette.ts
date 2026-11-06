import { ref, computed, readonly, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";
import type FuseDefault from "fuse.js";

export interface Command {
  id: string;
  title: string;
  group: string;
  keywords?: string[];
  icon?: string;
  shortcut?: string;
  run?: () => void | Promise<void>;
  to?: string | RouteLocationRaw;
  href?: string;
  disabled?: boolean;
  hidden?: boolean;
}

export interface CommandSource {
  id: string;
  group: string;
  getCommands: (query: string) => Command[] | Promise<Command[]>;
}

type CommandScope = "global" | "route" | "lifecycle";

interface RegisteredCommand {
  command: Command;
  scope: CommandScope;
  routePattern?: string;
  registeredAtRoute?: string;
}

interface RegisteredSource {
  source: CommandSource;
  scope: CommandScope;
  routePattern?: string;
  registeredAtRoute?: string;
}

const isOpen = ref(false);
const shouldMount = ref(false);
const query = ref("");
const commands = ref<RegisteredCommand[]>([]);
const sources = ref<RegisteredSource[]>([]);
const sourceResults = ref<Map<string, Command[]>>(new Map());
const loadingSources = ref<Set<string>>(new Set());
const currentRoutePath = ref("");

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let fuseConstructor: typeof FuseDefault | null = null;
let fusePromise: Promise<typeof FuseDefault> | null = null;

async function ensureFuseLoaded(): Promise<typeof FuseDefault> {
  if (fuseConstructor) {
    return fuseConstructor;
  }

  if (!fusePromise) {
    fusePromise = import("fuse.js")
      .then((module) => {
        fuseConstructor = module.default;
        return module.default;
      })
      .catch((error) => {
        fusePromise = null;
        throw error;
      });
  }

  return fusePromise;
}

function matchesCommandQuery(command: Command, searchQuery: string): boolean {
  const haystacks = [command.title, command.group, ...(command.keywords ?? [])];

  return haystacks.some((value) => {
    return value.toLowerCase().includes(searchQuery);
  });
}

export function useCommandPalette() {
  const route = useRoute();

  // Track route changes and clean up lifecycle commands from the OLD route only.
  // This prevents the race condition where commands from the new page get cleared.
  watch(
    () => route.path,
    (newPath, oldPath) => {
      if (oldPath && newPath !== oldPath) {
        // Only remove lifecycle commands that were registered on the OLD route
        commands.value = commands.value.filter(
          (c) => c.scope !== "lifecycle" || c.registeredAtRoute === newPath
        );
        sources.value = sources.value.filter(
          (s) => s.scope !== "lifecycle" || s.registeredAtRoute === newPath
        );
      }
      currentRoutePath.value = newPath;
    },
    { immediate: true }
  );

  const open = () => {
    shouldMount.value = true;
    isOpen.value = true;
    query.value = "";
    sourceResults.value = new Map();
    void refreshSources();
  };

  const close = () => {
    isOpen.value = false;
    query.value = "";
  };

  const toggle = () => {
    if (isOpen.value) close();
    else open();
  };

  const registerCommand = (
    command: Command,
    scope: CommandScope = "global",
    routePattern?: string
  ) => {
    const registeredAtRoute = scope === "lifecycle" ? route.path : undefined;
    commands.value.push({ command, scope, routePattern, registeredAtRoute });
    return () => {
      commands.value = commands.value.filter(
        (c) => c.command.id !== command.id
      );
    };
  };

  const registerCommands = (
    cmds: Command[],
    scope: CommandScope = "global",
    routePattern?: string
  ) => {
    const unregisters = cmds.map((cmd) =>
      registerCommand(cmd, scope, routePattern)
    );
    return () => unregisters.forEach((u) => u());
  };

  const registerSource = (
    source: CommandSource,
    scope: CommandScope = "global",
    routePattern?: string
  ) => {
    const registeredAtRoute = scope === "lifecycle" ? route.path : undefined;
    sources.value.push({ source, scope, routePattern, registeredAtRoute });
    return () => {
      sources.value = sources.value.filter((s) => s.source.id !== source.id);
      sourceResults.value.delete(source.id);
    };
  };

  const matchesRoute = (pattern?: string) => {
    if (!pattern) return true;
    const currentPath = route.path;
    if (pattern.includes("*")) {
      // Escape regex metachars in the pattern so brackets, dots, and parens
      // in route templates cannot accidentally activate regex semantics, then
      // translate the intentional `*` wildcard back to `.*`.
      const escaped = pattern
        .replace(/[\\^$.+?()[\]{}|]/g, "\\$&")
        .replace(/\*/g, ".*");
      // eslint-disable-next-line security/detect-non-literal-regexp -- input fully escaped above; only `*` survives as wildcard
      const regex = new RegExp(`^${escaped}$`);
      return regex.test(currentPath);
    }
    return currentPath === pattern || currentPath.startsWith(pattern);
  };

  const activeCommands = computed(() => {
    return commands.value
      .filter((c) => {
        if (c.scope === "global") return true;
        if (c.scope === "route") return matchesRoute(c.routePattern);
        return true;
      })
      .map((c) => c.command)
      .filter((c) => !c.hidden);
  });

  const activeSources = computed(() => {
    return sources.value.filter((s) => {
      if (s.scope === "global") return true;
      if (s.scope === "route") return matchesRoute(s.routePattern);
      return true;
    });
  });

  const refreshSources = async () => {
    const q = query.value;
    for (const { source } of activeSources.value) {
      loadingSources.value.add(source.id);
      try {
        const results = await source.getCommands(q);
        sourceResults.value.set(source.id, results);
      } catch {
        sourceResults.value.set(source.id, []);
      } finally {
        loadingSources.value.delete(source.id);
      }
    }
  };

  const debouncedRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void refreshSources();
    }, 150);
  };

  watch(query, () => {
    if (query.value.trim()) {
      void ensureFuseLoaded();
    }
    debouncedRefresh();
  });

  const allActiveCommands = computed(() => {
    const all = [...activeCommands.value];
    for (const results of sourceResults.value.values()) {
      all.push(...results.filter((c) => !c.hidden));
    }
    return all;
  });

  const filteredCommands = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return allActiveCommands.value;

    if (!fuseConstructor) {
      return allActiveCommands.value.filter((command) =>
        matchesCommandQuery(command, q)
      );
    }

    const fuse = new fuseConstructor(allActiveCommands.value, {
      keys: ["title", "keywords", "group"],
      threshold: 0.4,
      ignoreLocation: true,
    });

    return fuse.search(q).map((r) => r.item);
  });

  const groupedCommands = computed(() => {
    const groups = new Map<string, Command[]>();
    for (const cmd of filteredCommands.value) {
      const group = cmd.group || "Other";
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(cmd);
    }
    return groups;
  });

  const executeCommand = async (command: Command) => {
    if (command.disabled) return;

    if (command.to) {
      await navigateTo(command.to);
      close();
      return;
    }

    if (command.href) {
      window.open(command.href, "_blank");
      close();
      return;
    }

    if (command.run) {
      close();
      try {
        await command.run();
      } catch (e) {
        console.error("Command execution failed:", e);
      }
    }
  };

  const isLoading = computed(() => loadingSources.value.size > 0);

  const isSourceLoading = (sourceId: string) =>
    loadingSources.value.has(sourceId);

  return {
    isOpen: readonly(isOpen),
    shouldMount: readonly(shouldMount),
    query,
    open,
    close,
    toggle,
    registerCommand,
    registerCommands,
    registerSource,
    filteredCommands,
    groupedCommands,
    executeCommand,
    isLoading,
    isSourceLoading,
  };
}
