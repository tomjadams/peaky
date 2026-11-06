import { assertTemplatePublishingConfigMatches } from "#shared/config/template-publishing";

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  assertTemplatePublishingConfigMatches(
    config.templatePublishingEnabled,
    config.public.templatePublishingEnabled
  );
});
