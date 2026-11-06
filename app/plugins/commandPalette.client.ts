import { onKeyStroke } from "@vueuse/core";
import type { Application } from "~/composables/applications/useApplications";
import {
  useCommandPalette,
  type Command,
  type CommandSource,
} from "~/composables/nav/useCommandPalette";
import { teamMutations } from "~/services/entity/TeamMutations";
import {
  clearBrowserCachesAndStaleWorkers,
  clearAndHardReload,
} from "~/utils/browserCache";
import { nextColorMode } from "~/utils/colorMode";

interface Team {
  id: string;
  name: string;
  orgName: string;
}

export default defineNuxtPlugin({
  name: "command-palette",
  setup() {
    const { toggle, registerCommands, registerSource } = useCommandPalette();

    const colorMode = useColorMode();
    const toast = useToast();

    const globalNavCommands: Command[] = [
      {
        id: "nav-teams",
        title: "Go to Teams dashboard",
        group: "Navigation",
        icon: "lucide:users",
        keywords: ["home", "main", "teams", "dashboard"],
        to: "/teams",
      },
      {
        id: "nav-products",
        title: "Go to Products",
        group: "Navigation",
        icon: "lucide:box",
        to: "/products",
      },
      {
        id: "nav-applications",
        title: "Go to Applications",
        group: "Navigation",
        icon: "lucide:layout-dashboard",
        keywords: ["applications", "apps", "legacy"],
        to: "/applications",
      },
      {
        id: "nav-templates",
        title: "Go to Templates",
        group: "Navigation",
        icon: "lucide:file-text",
        keywords: ["templates", "template", "studio", "pillars", "questions"],
        to: "/templates",
      },
      {
        id: "nav-events",
        title: "Go to Events",
        group: "Navigation",
        icon: "lucide:history",
        keywords: ["events", "audit", "activity", "cloudtrail", "log"],
        to: "/events",
      },
      {
        id: "nav-system",
        title: "Go to System",
        group: "Navigation",
        icon: "lucide:activity",
        keywords: ["system", "database", "storage", "sync", "status", "health"],
        to: "/system",
      },
      {
        id: "toggle-dark-mode",
        title: "Toggle dark mode",
        group: "Settings",
        icon: "lucide:moon",
        keywords: ["theme", "light", "dark", "appearance", "color"],
        run: () => {
          colorMode.preference = nextColorMode(colorMode.value);
        },
      },
      {
        id: "clear-browser-cache",
        title: "Clear cache and stale workers",
        group: "Settings",
        icon: "lucide:eraser",
        keywords: [
          "cache",
          "service worker",
          "pwa",
          "reload",
          "hard refresh",
          "stale",
        ],
        run: async () => {
          const { cacheCount, serviceWorkerCount } =
            await clearBrowserCachesAndStaleWorkers();

          if (cacheCount === 0 && serviceWorkerCount === 0) {
            toast.add({
              title: "Nothing to clear",
              description: "No browser caches or service workers were found.",
              color: "neutral",
            });
            return;
          }

          toast.add({
            title: "Cache cleared",
            description: "Reloading with fresh browser state…",
            color: "success",
          });

          window.setTimeout(() => {
            clearAndHardReload();
          }, 150);
        },
      },
    ];

    registerCommands(globalNavCommands, "global");

    let cachedApplications: Application[] | null = null;

    const applicationsSource: CommandSource = {
      id: "applications-source",
      group: "Applications",
      getCommands: async (): Promise<Command[]> => {
        if (!cachedApplications) {
          try {
            const response = await $fetch<Application[]>("/api/applications");
            cachedApplications = response;
          } catch {
            return [];
          }
        }

        return cachedApplications.map((app) => ({
          id: `app-${app.id}`,
          title: app.name,
          group: "Applications",
          icon: "lucide:app-window",
          keywords: [app.owner, app.status, "application", "team", "go to"],
          to: `/teams/${app.teamId}`,
        }));
      },
    };

    registerSource(applicationsSource, "global");

    let cachedTeams: Team[] | null = null;

    const teamsSource: CommandSource = {
      id: "teams-source",
      group: "Teams",
      getCommands: async (): Promise<Command[]> => {
        if (!cachedTeams) {
          const localTeams = await teamMutations.fetchAll();

          if (localTeams.length > 0) {
            cachedTeams = localTeams;
          } else {
            try {
              cachedTeams = await $fetch<Team[]>("/api/teams");
            } catch {
              return [];
            }
          }
        }

        return cachedTeams.map((team) => ({
          id: `team-${team.id}`,
          title: team.name,
          group: "Teams",
          icon: "lucide:users",
          keywords: [team.orgName, "team", "go to"],
          to: `/teams/${team.id}`,
        }));
      },
    };

    registerSource(teamsSource, "global");

    onKeyStroke("k", (e) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        toggle();
      }
    });
  },
});
