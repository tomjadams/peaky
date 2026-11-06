import { getProductsWithMetrics } from "../../data/products";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const status = query.status === "archived" ? "archived" : "active";

  return getProductsWithMetrics(status).toSorted((a, b) => {
    const dateCompare =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.name.localeCompare(b.name);
  });
});
