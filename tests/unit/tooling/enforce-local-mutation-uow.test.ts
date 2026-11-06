import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";
import { enforceLocalMutationUow } from "../../../oxlint-plugins/enforce-local-mutation-uow.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { sourceType: "module" },
});

ruleTester.run("enforce-local-mutation-uow", enforceLocalMutationUow, {
  valid: [
    `
      import { localOutbox } from "#shared/db/schema";
      await db.select().from(localOutbox);
      await db.update(localOutbox).set({ status: "synced" });
      await db.delete(localOutbox);
    `,
    `await localMutation.commit({ stateWrite, event, outbox });`,
    {
      code: `
        import { localOutbox } from "#shared/db/schema";
        await tx.insert(localOutbox).values(row);
      `,
      options: [{ allowedBypassCount: 1 }],
    },
  ],
  invalid: [
    {
      code: `
        import { localOutbox } from "#shared/db/schema";
        await tx.insert(localOutbox).values(row);
      `,
      errors: [{ messageId: "useLocalMutation" }],
    },
    {
      code: `
        import { localOutbox as outboxTable } from "#shared/db/schema/sync";
        await tx.insert(outboxTable).values(row);
      `,
      errors: [{ messageId: "useLocalMutation" }],
    },
    {
      code: `
        import * as schema from "#shared/db/schema";
        await tx.insert(schema.localOutbox).values(row);
      `,
      errors: [{ messageId: "useLocalMutation" }],
    },
    {
      code: `
        import * as schema from "#shared/db/schema";
        const { localOutbox: queue } = schema;
        const alias = queue;
        await tx.insert(alias).values(row);
      `,
      errors: [{ messageId: "useLocalMutation" }],
    },
    {
      code: `import { localOutbox } from "#shared/db/schema";`,
      options: [{ allowedBypassCount: 1 }],
      errors: [{ messageId: "staleAllowance" }],
    },
  ],
});
