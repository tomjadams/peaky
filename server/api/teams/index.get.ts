import { getTeamsWithMetrics } from "../../data/teams";

export default defineEventHandler(() => {
  return getTeamsWithMetrics().toSorted((a, b) => {
    const orgCompare = a.orgName.localeCompare(b.orgName);
    if (orgCompare !== 0) return orgCompare;
    return a.name.localeCompare(b.name);
  });
});
