import { BASE_URL } from "~/utils/baseUrl";

/**
 * Build a `dataschema` URL for a versioned event type name.
 *
 * @example
 *   buildDataSchemaUrl("ProductCreated.v1")
 *   // → "http://localhost:3000/schemas/ProductCreated.v1.json"  (dev)
 *   // → "https://orr-sample.vercel.app/schemas/ProductCreated.v1.json"  (prod)
 */
export function buildDataSchemaUrl(eventTypeName: string): string {
  return `${BASE_URL}/schemas/${eventTypeName}.json`;
}
