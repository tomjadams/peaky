/**
 * Generate JSON Schema files for all domain event `data` payloads.
 *
 * Reads the event catalog, converts each Zod schema to JSON Schema Draft-07,
 * and writes a `.json` file per event type to `public/schemas/`.
 *
 * These files are served as static assets at `dataschema` URLs in CloudEvents
 * envelopes, available at `/schemas/{EventName.v1}.json` on the Nuxt app.
 *
 * Usage:
 *   pnpm events:schemas
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { EVENT_CATALOG_ENTRIES } from "../app/services/events/schemas/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = join(__dirname, "../public/schemas");

mkdirSync(OUTPUT_DIR, { recursive: true });

let generated = 0;

for (const entry of EVENT_CATALOG_ENTRIES) {
  const jsonSchema = zodToJsonSchema(entry.schema, {
    name: entry.type,
    $refStrategy: "none",
    markdownDescription: true,
    definitions: {},
  });

  // Annotate with event metadata so the file is self-describing
  const output = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://orr-sample.vercel.app/schemas/${entry.type}.json`,
    title: entry.type,
    description: entry.description,
    "x-peaky-event": {
      type: entry.type,
      sources: entry.sources,
    },
    // Inline the actual schema definition (zodToJsonSchema wraps it under `definitions`)
    ...((jsonSchema as Record<string, unknown>).definitions
      ? (
          (jsonSchema as Record<string, unknown>).definitions as Record<
            string,
            unknown
          >
        )[entry.type]
      : jsonSchema),
  };

  const outPath = join(OUTPUT_DIR, `${entry.type}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`  ✓ ${entry.type}`);
  generated++;
}

console.log(`\nGenerated ${generated} event schema files → ${OUTPUT_DIR}`);
