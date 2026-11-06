import { describe, it, expect, beforeEach } from "vitest";
import {
  useCommandPalette,
  type Command,
  type CommandSource,
} from "~/composables/nav/useCommandPalette";

describe("useCommandPalette", async () => {
  beforeEach(() => {
    // Reset the composable state between tests
    const { close } = useCommandPalette();
    close();
  });

  describe("open/close/toggle", () => {
    it("should start closed", () => {
      const { isOpen } = useCommandPalette();
      expect(isOpen.value).toBe(false);
    });

    it("should open the palette", () => {
      const { isOpen, open } = useCommandPalette();
      open();
      expect(isOpen.value).toBe(true);
    });

    it("should close the palette", () => {
      const { isOpen, open, close } = useCommandPalette();
      open();
      close();
      expect(isOpen.value).toBe(false);
    });

    it("should toggle the palette", () => {
      const { isOpen, toggle } = useCommandPalette();
      toggle();
      expect(isOpen.value).toBe(true);
      toggle();
      expect(isOpen.value).toBe(false);
    });

    it("should clear query when opening", () => {
      const { query, open, close } = useCommandPalette();
      open();
      query.value = "test";
      close();
      open();
      expect(query.value).toBe("");
    });
  });

  describe("command registration", () => {
    it("should register a command", () => {
      const { registerCommand, filteredCommands } = useCommandPalette();

      const command: Command = {
        id: "test-cmd",
        title: "Test Command",
        group: "Test",
      };

      registerCommand(command);
      expect(filteredCommands.value).toContainEqual(command);
    });

    it("should unregister a command when cleanup is called", () => {
      const { registerCommand, filteredCommands } = useCommandPalette();

      const command: Command = {
        id: "test-cmd-2",
        title: "Test Command 2",
        group: "Test",
      };

      const unregister = registerCommand(command);
      expect(
        filteredCommands.value.find((c) => c.id === "test-cmd-2")
      ).toBeDefined();

      unregister();
      expect(
        filteredCommands.value.find((c) => c.id === "test-cmd-2")
      ).toBeUndefined();
    });

    it("should register multiple commands at once", () => {
      const { registerCommands, filteredCommands } = useCommandPalette();

      const commands: Command[] = [
        { id: "multi-1", title: "Multi 1", group: "Multi" },
        { id: "multi-2", title: "Multi 2", group: "Multi" },
      ];

      registerCommands(commands);
      expect(
        filteredCommands.value.find((c) => c.id === "multi-1")
      ).toBeDefined();
      expect(
        filteredCommands.value.find((c) => c.id === "multi-2")
      ).toBeDefined();
    });

    it("should filter hidden commands", () => {
      const { registerCommand, filteredCommands } = useCommandPalette();

      registerCommand({
        id: "hidden-cmd",
        title: "Hidden",
        group: "Test",
        hidden: true,
      });

      expect(
        filteredCommands.value.find((c) => c.id === "hidden-cmd")
      ).toBeUndefined();
    });
  });

  describe("fuzzy search filtering", () => {
    it("should filter commands by query", async () => {
      const { registerCommands, query, filteredCommands } = useCommandPalette();

      registerCommands([
        { id: "dashboard", title: "Go to Dashboard", group: "Nav" },
        { id: "settings", title: "Open Settings", group: "Nav" },
      ]);

      query.value = "dashboard";
      await new Promise((r) => setTimeout(r, 50));

      expect(filteredCommands.value.length).toBe(1);
      expect(filteredCommands.value[0]!.id).toBe("dashboard");
    });

    it("should match keywords", async () => {
      const { registerCommand, query, filteredCommands } = useCommandPalette();

      registerCommand({
        id: "home",
        title: "Go Home",
        group: "Nav",
        keywords: ["dashboard", "main"],
      });

      query.value = "main";
      await new Promise((r) => setTimeout(r, 50));

      expect(filteredCommands.value.length).toBeGreaterThan(0);
      expect(filteredCommands.value.find((c) => c.id === "home")).toBeDefined();
    });
  });

  describe("grouped commands", () => {
    it("should group commands by group property", () => {
      const { registerCommands, groupedCommands } = useCommandPalette();

      registerCommands([
        { id: "nav-1", title: "Nav 1", group: "Navigation" },
        { id: "nav-2", title: "Nav 2", group: "Navigation" },
        { id: "action-1", title: "Action 1", group: "Actions" },
      ]);

      expect(groupedCommands.value.get("Navigation")?.length).toBe(2);
      expect(groupedCommands.value.get("Actions")?.length).toBe(1);
    });
  });

  describe("command sources", () => {
    it("should register and call async sources", async () => {
      const { registerSource, open, filteredCommands } = useCommandPalette();

      const source: CommandSource = {
        id: "async-source",
        group: "Async",
        getCommands: async () => [
          { id: "async-1", title: "Async Command", group: "Async" },
        ],
      };

      registerSource(source);
      open();

      // Wait for async source to resolve
      await new Promise((r) => setTimeout(r, 200));

      expect(
        filteredCommands.value.find((c) => c.id === "async-1")
      ).toBeDefined();
    });

    it("should unregister source when cleanup is called", async () => {
      const { registerSource, open, filteredCommands } = useCommandPalette();

      const source: CommandSource = {
        id: "removable-source",
        group: "Removable",
        getCommands: async () => [
          { id: "removable-1", title: "Removable", group: "Removable" },
        ],
      };

      const unregister = registerSource(source);
      open();
      await new Promise((r) => setTimeout(r, 200));

      unregister();

      expect(
        filteredCommands.value.find((c) => c.id === "removable-1")
      ).toBeUndefined();
    });
  });

  describe("lifecycle scope commands", () => {
    it("should register lifecycle-scoped commands", () => {
      const { registerCommands, filteredCommands } = useCommandPalette();

      const commands: Command[] = [
        { id: "lifecycle-1", title: "Lifecycle Command", group: "Page" },
      ];

      registerCommands(commands, "lifecycle");
      expect(
        filteredCommands.value.find((c) => c.id === "lifecycle-1")
      ).toBeDefined();
    });

    it("should allow manual cleanup of lifecycle commands", () => {
      const { registerCommands, filteredCommands } = useCommandPalette();

      const commands: Command[] = [
        { id: "cleanup-test", title: "Cleanup Test", group: "Page" },
      ];

      const unregister = registerCommands(commands, "lifecycle");
      expect(
        filteredCommands.value.find((c) => c.id === "cleanup-test")
      ).toBeDefined();

      unregister();
      expect(
        filteredCommands.value.find((c) => c.id === "cleanup-test")
      ).toBeUndefined();
    });
  });
});
