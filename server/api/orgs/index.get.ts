import { organizations } from "../../data/organizations";

export default defineEventHandler(() => {
  return organizations.toSorted((a, b) => a.name.localeCompare(b.name));
});
