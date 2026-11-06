import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./shared/db/schema/index.ts",
  out: "./shared/db/migrations/sqlite",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});
