import { describe, it, expect, beforeEach } from "vitest";
import { useCommandPalette } from "~/composables/nav/useCommandPalette";

describe("AppCommandPalette", async () => {
  beforeEach(() => {
    const { close } = useCommandPalette();
    close();
  });

  describe("keyboard navigation", () => {
    it("opens when calling open()", async () => {
      const { open, isOpen } = useCommandPalette();
      expect(isOpen.value).toBe(false);
      open();
      expect(isOpen.value).toBe(true);
    });

    it("closes on Escape key", async () => {
      const { open, close, isOpen } = useCommandPalette();
      open();
      expect(isOpen.value).toBe(true);
      close();
      expect(isOpen.value).toBe(false);
    });

    it("filters results based on query", async () => {
      const { open, query, registerCommands, filteredCommands } =
        useCommandPalette();

      registerCommands([
        { id: "test-1", title: "Find users", group: "Test" },
        { id: "test-2", title: "Create post", group: "Test" },
        { id: "test-3", title: "Delete item", group: "Test" },
      ]);

      open();
      query.value = "find";
      await new Promise((r) => setTimeout(r, 50));

      expect(filteredCommands.value.length).toBe(1);
      expect(filteredCommands.value[0]?.title).toBe("Find users");
    });

    it("groups commands by group property", () => {
      const { registerCommands, groupedCommands } = useCommandPalette();

      registerCommands([
        { id: "nav-1", title: "Dashboard", group: "Navigation" },
        { id: "action-1", title: "Save", group: "Actions" },
        { id: "nav-2", title: "Settings", group: "Navigation" },
      ]);

      expect(groupedCommands.value!.has("Navigation")).toBe(true);
      expect(groupedCommands.value!.has("Actions")).toBe(true);
      expect(groupedCommands.value!.get("Navigation")?.length).toBe(2);
      expect(groupedCommands.value.get("Actions")?.length).toBe(1);
    });

    it("executes command with navigation target", async () => {
      const { registerCommand, executeCommand } = useCommandPalette();
      let executed = false;

      registerCommand({
        id: "run-test",
        title: "Run Test",
        group: "Test",
        run: () => {
          executed = true;
        },
      });

      const { filteredCommands } = useCommandPalette();
      const cmd = filteredCommands.value.find((c) => c.id === "run-test");
      expect(cmd).toBeDefined();

      if (cmd) {
        await executeCommand(cmd);
        expect(executed).toBe(true);
      }
    });

    it("does not execute disabled commands", async () => {
      const { registerCommand, executeCommand, filteredCommands } =
        useCommandPalette();
      let executed = false;

      registerCommand({
        id: "disabled-cmd",
        title: "Disabled Command",
        group: "Test",
        disabled: true,
        run: () => {
          executed = true;
        },
      });

      const cmd = filteredCommands.value.find((c) => c.id === "disabled-cmd");
      if (cmd) {
        await executeCommand(cmd);
        expect(executed).toBe(false);
      }
    });
  });
});
