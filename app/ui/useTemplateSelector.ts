export const useTemplateSelector = () => {
  const isCollapsed = useState("template-selector-collapsed", () => false);
  const activeTemplateRevisionId = useState<string | null>(
    "template-selector-active-revision",
    () => null
  );
  const activePillarSlug = useState<string | null>(
    "template-selector-active-pillar",
    () => null
  );

  const setActiveTemplateRevision = (revisionId: string | null) => {
    activeTemplateRevisionId.value = revisionId;
  };

  const setActivePillar = (slug: string | null) => {
    activePillarSlug.value = slug;
  };

  return {
    isCollapsed,
    activeTemplateRevisionId,
    activePillarSlug,
    setActiveTemplateRevision,
    setActivePillar,
  };
};
