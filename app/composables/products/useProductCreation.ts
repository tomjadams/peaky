import type { Product, ProductOrigin } from "~/models";
import { useCurrentActor } from "~/composables/auth/useCurrentActor";
import { productMutations } from "~/services/entity/ProductMutations";

export interface ProductFormState {
  name: string;
  origin: ProductOrigin | "";
  isExternal: boolean;
  productManagerId: string;
  engineeringLeadId: string;
  teamIds: string[];
  componentIds: string[];
  roadmapUrl: string;
  documentationUrl: string;
  supportChannel: string;
}

const emptyForm = (): ProductFormState => ({
  name: "",
  origin: "",
  isExternal: false,
  productManagerId: "",
  engineeringLeadId: "",
  teamIds: [],
  componentIds: [],
  roadmapUrl: "",
  documentationUrl: "",
  supportChannel: "",
});

export const useProductCreation = () => {
  const { actor } = useCurrentActor();
  const form = reactive<ProductFormState>(emptyForm());
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const localProductId = ref<string | null>(null);

  const isValid = computed(() => {
    return (
      form.name.trim().length > 0 &&
      form.origin !== "" &&
      form.productManagerId.trim().length > 0 &&
      form.teamIds.length > 0
    );
  });

  const resetForm = () => {
    Object.assign(form, emptyForm());
    error.value = null;
    localProductId.value = null;
  };

  const populateFrom = (product: Product) => {
    form.name = product.name;
    form.origin = product.origin;
    form.isExternal = product.isExternal;
    form.productManagerId = product.productManagerId;
    form.engineeringLeadId = product.engineeringLeadId ?? "";
    form.teamIds = [...product.teamIds];
    form.componentIds = [...product.componentIds];
    form.roadmapUrl = product.roadmapUrl ?? "";
    form.documentationUrl = product.documentationUrl ?? "";
    form.supportChannel = product.supportChannel ?? "";
    localProductId.value = product.id;
  };

  const toPayload = () => ({
    name: form.name.trim(),
    origin: form.origin as ProductOrigin,
    isExternal: form.isExternal,
    productManagerId: form.productManagerId,
    engineeringLeadId: form.engineeringLeadId || undefined,
    teamIds: form.teamIds,
    componentIds: form.componentIds,
    roadmapUrl: form.roadmapUrl || undefined,
    documentationUrl: form.documentationUrl || undefined,
    supportChannel: form.supportChannel || undefined,
  });

  /**
   * Submit create - local-first approach.
   * Commits to local database first, queues for remote sync.
   */
  const submitCreateLocal = async (): Promise<string> => {
    submitting.value = true;
    error.value = null;

    try {
      const productId = await productMutations.create({
        ...toPayload(),
        createdBy: actor.value.id,
      });
      localProductId.value = productId;
      return productId;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Operation failed";
      throw err;
    } finally {
      submitting.value = false;
    }
  };

  /**
   * Submit update - local-first approach.
   * Commits to local database first, queues for remote sync.
   */
  const submitUpdateLocal = async (productId: string): Promise<void> => {
    submitting.value = true;
    error.value = null;

    try {
      await productMutations.update(productId, toPayload());
      localProductId.value = productId;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Operation failed";
      throw err;
    } finally {
      submitting.value = false;
    }
  };

  return {
    form,
    submitting: readonly(submitting),
    error: readonly(error),
    isValid,
    resetForm,
    populateFrom,
    submitCreateLocal,
    submitUpdateLocal,
    localProductId: readonly(localProductId),
  };
};
