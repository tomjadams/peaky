import { getProductById } from "../../data/products";

export default defineEventHandler((event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Product ID is required",
    });
  }

  const product = getProductById(id);

  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: "Product not found",
    });
  }

  return product;
});
