<script setup lang="ts">
import type { ComputedRef } from "vue";
import type { TemplateCatalogEntry } from "~/models";
import { FEATURED_TEMPLATES } from "~/constants/featuredTemplates";
import { useCatalogGroupSearch } from "~/composables/catalog/useCatalogGroupSearch";
import { fetchTemplateRevisionDetail } from "~/composables/templates/domain/useTemplateCatalog";
import { formatRelativeTime } from "~/utils/date";
import ReviewWizardTemplateCard from "./ReviewWizardTemplateCard.vue";
import type { TemplateShelfCard } from "./ReviewWizardTemplateCard.vue";

interface TemplateSummary {
  id: string;
  name: string;
  revisionNumber: number | null;
}

interface TeamLaunchContext {
  id: string;
  name: string;
}

interface Props {
  templateSearch: string;
  selectedTemplateIds: string[];
  selectedTemplateSummaries: TemplateSummary[];
  templates: TemplateCatalogEntry[];
  teamContext?: TeamLaunchContext | null;
}

const props = withDefaults(defineProps<Props>(), {
  teamContext: null,
});

const emit = defineEmits<{
  "update:templateSearch": [value: string];
  "toggle-template": [templateId: string];
}>();

// ── Owner resolution ────────────────────────────────────────────────────
// Templates carry an ownerTeamId; resolving it to a human name needs the
// directory groups mirror. A raw id lookup (not the display-name-deduped
// list) is used deliberately: dedup can drop an id whose group shares a
// display name with a higher-scoring duplicate, which would make an
// otherwise-real id fail to resolve. Any id — including fixture data like
// "team-platform", which has no directory row at all — that still doesn't
// resolve just omits the "by X" segment; it never falls back to the raw id.
const { allGroups, refresh: refreshGroups } = useCatalogGroupSearch();
// The mirror resource caches behind a loaded-flag; refresh once on mount so
// owner names resolve even when the wizard opens before (or right after)
// a directory sync — a cheap local query, never a network call.
onMounted(() => {
  void refreshGroups();
});
const ownerNameById = computed(() => {
  const map = new Map<string, string>();
  for (const group of allGroups.value) {
    map.set(group.id, group.displayName);
  }
  return map;
});
function resolveOwnerName(ownerTeamId: string): string | null {
  return ownerNameById.value.get(ownerTeamId) ?? null;
}

// ── Question counts ─────────────────────────────────────────────────────
// Pillar counts come straight off the catalog entry (already normalized).
// Question counts need each revision's full pillar/question tree, which
// isn't in the catalog summary, so visible revisions are fetched lazily and cached.
// Only revisions whose cards are actually on screen are fetched — a
// hundred-template catalog must not turn into a hundred detail requests
// the moment the wizard opens. (visibleRevisionIds is defined below, after
// the shelves decide what renders.)
const questionCountsById = shallowRef(new Map<string, number>());

// ── Card assembly ────────────────────────────────────────────────────────
const allCards = computed<TemplateShelfCard[]>(() => {
  const cards: TemplateShelfCard[] = [];
  for (const entry of props.templates) {
    if (entry.template.status !== "active") continue;
    const pillarCountFor = (revisionId: string) =>
      entry.pillarSlugsByRevisionId[revisionId]?.length ?? 0;

    for (const revision of entry.publishedRevisions) {
      if (revision.status !== "published") continue;
      cards.push({
        id: revision.id,
        templateId: entry.template.id,
        name: revision.name,
        description: revision.description,
        revisionNumber: revision.revisionNumber,
        pillarCount: pillarCountFor(revision.id),
        questionCount: questionCountsById.value.get(revision.id) ?? 0,
        reviewsCount: entry.reviewsCount ?? 0,
        ownerTeamId: entry.template.ownerTeamId,
        updatedAt: revision.publishedAt ?? entry.template.updatedAt,
      });
    }
  }
  return cards;
});

function sortByPopularity(cards: TemplateShelfCard[]): TemplateShelfCard[] {
  return cards.toSorted((a, b) => {
    if (b.reviewsCount !== a.reviewsCount)
      return b.reviewsCount - a.reviewsCount;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

// ── Featured shelf ───────────────────────────────────────────────────────
const publishedCardByTemplateId = computed(() => {
  const map = new Map<string, TemplateShelfCard>();
  for (const card of allCards.value) {
    if (!map.has(card.templateId)) map.set(card.templateId, card);
  }
  return map;
});

const featuredCards = computed(() =>
  FEATURED_TEMPLATES.flatMap((config) => {
    const card = publishedCardByTemplateId.value.get(config.templateId);
    return card ? [{ card, note: config.note }] : [];
  })
);
const featuredCardIds = computed(
  () => new Set(featuredCards.value.map((featured) => featured.card.id))
);

// ── Remaining shelves (context / all) ───────────────────────────────────
const basePool = computed(() =>
  allCards.value.filter((card) => !featuredCardIds.value.has(card.id))
);

const contextCards = computed(() => {
  if (!props.teamContext) return [];
  return basePool.value.filter(
    (card) => card.ownerTeamId === props.teamContext!.id
  );
});
const contextCardIds = computed(
  () => new Set(contextCards.value.map((card) => card.id))
);
const contextHeading = computed(() =>
  props.teamContext
    ? `${props.teamContext.name} templates`
    : "This team's templates"
);

const allTemplatesCards = computed(() =>
  sortByPopularity(
    basePool.value.filter((card) => !contextCardIds.value.has(card.id))
  )
);

// ── Shelf preview caps ───────────────────────────────────────────────────
// Long groups preview their top rows and reveal on demand; the header's
// K-of-N count shows how much is hidden. A group hiding only a handful
// opens in one click ("Show all N"); past that it reveals a page of the
// grid at a time, so a hundred-template catalog never lands as one dump.
// Search results are never capped — a search is an explicit ask for
// everything that matches.
const REVEAL_STEP = 24;
const SHOW_ALL_THRESHOLD = 12;

function useShelfPreview(
  pool: ComputedRef<TemplateShelfCard[]>,
  preview: number,
  noun: string
) {
  const revealed = ref(0);
  const visible = computed(() => pool.value.slice(0, preview + revealed.value));
  const hidden = computed(() => pool.value.length - visible.value.length);
  const hasToggle = computed(() => pool.value.length > preview);
  const isRevealed = computed(() => revealed.value > 0);
  const toggleLabel = computed(() => {
    if (hidden.value === 0) return "Show fewer";
    if (hidden.value <= SHOW_ALL_THRESHOLD)
      return `Show all ${pool.value.length} ${noun}`;
    return `Show ${Math.min(REVEAL_STEP, hidden.value)} more`;
  });
  function toggle() {
    if (hidden.value === 0) revealed.value = 0;
    else if (hidden.value <= SHOW_ALL_THRESHOLD)
      revealed.value = pool.value.length - preview;
    else revealed.value += REVEAL_STEP;
  }
  return { visible, hasToggle, isRevealed, toggleLabel, toggle };
}

const allShelf = useShelfPreview(allTemplatesCards, 6, "templates");

// ── Search + count grammar ───────────────────────────────────────────────
const isSearching = computed(() => props.templateSearch.trim().length > 0);
const filterPool = computed<TemplateShelfCard[]>(() => allCards.value);

function matchesSearch(card: TemplateShelfCard, query: string): boolean {
  return (
    card.name.toLowerCase().includes(query) ||
    card.description.toLowerCase().includes(query)
  );
}

const searchResults = computed<TemplateShelfCard[]>(() => {
  if (!isSearching.value) return [];
  const query = props.templateSearch.trim().toLowerCase();
  return sortByPopularity(
    filterPool.value.filter((card) => matchesSearch(card, query))
  );
});

// Mirrors DataTable.vue's countLabel grammar exactly: "{K} of {N} {noun}"
// while a set is partially shown, "{N} {noun}" once it's complete.
function countLabel(
  filtered: number,
  total: number,
  nounSingular = "template"
): string {
  const noun = (n: number) => (n === 1 ? nounSingular : `${nounSingular}s`);
  if (filtered < total) return `${filtered} of ${total} ${noun(total)}`;
  return `${total} ${noun(total)}`;
}

const allTemplatesCountLabel = computed(() =>
  countLabel(allShelf.visible.value.length, allTemplatesCards.value.length)
);
const searchCountLabel = computed(() =>
  countLabel(searchResults.value.length, filterPool.value.length)
);

// ── Visibility-driven question counts ───────────────────────────────────
// Fetch revision details only for the cards actually rendered right now —
// featured, context, the revealed slice of each capped shelf, and search
// results. Results cache in questionCountsById, so re-reveals are free.
const visibleRevisionIds = computed(() => {
  const ids = new Set<string>();
  if (isSearching.value) {
    for (const card of searchResults.value) ids.add(card.id);
    return [...ids];
  }
  for (const featured of featuredCards.value) ids.add(featured.card.id);
  for (const card of contextCards.value) ids.add(card.id);
  for (const card of allShelf.visible.value) ids.add(card.id);
  return [...ids];
});

watch(
  visibleRevisionIds,
  async (ids) => {
    const missing = ids.filter((id) => !questionCountsById.value.has(id));
    if (missing.length === 0) return;
    const entries = await Promise.all(
      missing.map(async (id) => {
        try {
          const detail = await fetchTemplateRevisionDetail(id);
          const count = detail.pillars.reduce(
            (sum, pillar) => sum + pillar.questions.length,
            0
          );
          return [id, count] as const;
        } catch {
          // One bad revision shouldn't take the whole shelf down — it just
          // shows 0 questions until it can be fetched.
          return [id, 0] as const;
        }
      })
    );
    const next = new Map(questionCountsById.value);
    for (const [id, count] of entries) next.set(id, count);
    questionCountsById.value = next;
  },
  { immediate: true }
);

// ── Entrance ─────────────────────────────────────────────────────────────
// One quiet settle when the step first paints — shelf blocks rise a few
// pixels with a short stagger, then the view is still. Armed in onMounted
// per the house rule so SSR markup and no-JS render fully visible.
const entranceArmed = ref(false);
onMounted(() => {
  entranceArmed.value = true;
});

function ownerNameFor(card: TemplateShelfCard): string | null {
  return resolveOwnerName(card.ownerTeamId);
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;
function structureLabelFor(card: TemplateShelfCard): string {
  const parts = [
    plural(card.pillarCount, "pillar"),
    plural(card.questionCount, "question"),
  ];
  if (card.reviewsCount > 0) parts.push(plural(card.reviewsCount, "review"));
  return parts.join(" · ");
}

function isSelected(templateId: string): boolean {
  return props.selectedTemplateIds.includes(templateId);
}
</script>

<template>
  <section
    data-testid="wizard-step-1"
    class="space-y-4"
    :class="{ 'wizard-entrance': entranceArmed }"
  >
    <p class="text-muted text-sm">
      Select between 1 and 3 Revisions for this review.
    </p>

    <!-- Search, filters, and the selection tray stay pinned under the app
         header while the shelves scroll — deep in a long catalog, the way
         back out (search) and the 3-slot selection state stay in reach.
         Solid background: translucency here smears the cards passing
         beneath into ghost text. The bottom hairline is the toolbar's own
         edge, stuck or not. -->
    <div
      class="wiz-reveal bg-default border-default sticky top-[84px] z-20 space-y-4 border-b pb-3"
      style="--wiz-i: 0"
    >
      <div class="flex flex-wrap items-center gap-3">
        <SearchInput
          :model-value="templateSearch"
          placeholder="Search Revisions..."
          class="sm:max-w-md"
          @update:model-value="emit('update:templateSearch', String($event))"
        />
      </div>

      <div
        v-if="selectedTemplateSummaries.length > 0"
        class="bg-elevated border-default rounded-lg border p-3"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-default text-[13px] font-semibold">
            Selected Revisions
          </span>
          <span
            class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[13px] font-medium"
          >
            {{ selectedTemplateSummaries.length }}/3
          </span>
        </div>

        <div class="flex flex-wrap gap-2">
          <span
            v-for="template in selectedTemplateSummaries"
            :key="template.id"
            class="bg-default border-default text-muted rounded-full border px-2.5 py-1 text-[13px]"
          >
            {{ template.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- Searching: every shelf flattens into one labeled result list. -->
    <template v-if="isSearching">
      <p class="text-muted text-[13px] font-medium">{{ searchCountLabel }}</p>
      <div v-if="searchResults.length > 0" class="shelf-mat">
        <div class="grid gap-3 sm:grid-cols-2">
          <ReviewWizardTemplateCard
            v-for="card in searchResults"
            :key="card.id"
            :card="card"
            :selected="isSelected(card.id)"
            :owner-name="ownerNameFor(card)"
            @toggle="emit('toggle-template', $event)"
          />
        </div>
      </div>
      <div
        v-else
        class="bg-elevated border-default text-muted rounded-lg border px-4 py-6 text-sm"
      >
        No templates match your search.
      </div>
    </template>

    <template v-else>
      <!-- Featured shelf -->
      <div
        v-if="featuredCards.length > 0"
        class="wiz-reveal space-y-3"
        style="--wiz-i: 1"
      >
        <h3 class="text-default text-sm font-semibold">Featured</h3>
        <div class="shelf-mat space-y-4">
          <button
            v-for="featured in featuredCards"
            :key="featured.card.id"
            type="button"
            :data-testid="`template-card-${featured.card.id}`"
            :aria-pressed="isSelected(featured.card.id)"
            class="border-t-inverted border-accented bg-elevated focus-visible:outline-primary block w-full rounded-b-lg border border-t-2 p-5 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.995] dark:bg-slate-800"
            @click="emit('toggle-template', featured.card.id)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-default text-[17px] font-bold">
                    {{ featured.card.name }}
                  </h3>
                  <span
                    class="border-default bg-muted text-muted shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[13px] font-medium"
                  >
                    {{
                      featured.card.revisionNumber === null
                        ? "Published"
                        : `v${featured.card.revisionNumber}`
                    }}
                  </span>
                  <span
                    class="shrink-0 rounded-full border border-[#EDDCC0] bg-[#FDF3E3] px-2 py-0.5 text-[13px] text-[#92400E] dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    {{ featured.note }}
                  </span>
                </div>

                <p class="text-dimmed mt-1.5 text-[13px]">
                  <template v-if="ownerNameFor(featured.card)"
                    >by {{ ownerNameFor(featured.card) }} · </template
                  >updated {{ formatRelativeTime(featured.card.updatedAt) }}
                </p>
                <p class="text-dimmed mt-1 text-[13px]">
                  {{ structureLabelFor(featured.card) }}
                </p>
                <p class="text-muted mt-2 line-clamp-1 text-sm">
                  {{ featured.card.description }}
                </p>
              </div>

              <!-- Visual affordance only — the whole hero is the button. -->
              <span
                class="pointer-events-none inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[7px] border-[1.5px] px-4 text-[15px] font-semibold"
                :class="
                  isSelected(featured.card.id)
                    ? 'border-sky-600 bg-[#EAF3FA] text-sky-700 dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-300'
                    : 'border-[#02507c] bg-[#0369A1] text-white dark:border-sky-300 dark:bg-sky-400 dark:text-[#082f49]'
                "
              >
                <Icon
                  v-if="isSelected(featured.card.id)"
                  name="lucide:check"
                  class="h-4 w-4"
                />
                {{ isSelected(featured.card.id) ? "Selected" : "Select" }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Context shelf: this team's own templates -->
      <div
        v-if="contextCards.length > 0"
        class="wiz-reveal space-y-3"
        style="--wiz-i: 2"
      >
        <h3 class="text-default text-sm font-semibold">
          {{ contextHeading }}
        </h3>
        <div class="shelf-mat">
          <div class="grid gap-3 sm:grid-cols-2">
            <ReviewWizardTemplateCard
              v-for="card in contextCards"
              :key="card.id"
              :card="card"
              :selected="isSelected(card.id)"
              :owner-name="ownerNameFor(card)"
              @toggle="emit('toggle-template', $event)"
            />
          </div>
        </div>
      </div>

      <!-- All templates shelf -->
      <div
        v-if="allTemplatesCards.length > 0"
        class="wiz-reveal space-y-3"
        style="--wiz-i: 3"
      >
        <div class="flex items-baseline justify-between">
          <h3 class="text-default text-sm font-semibold">All templates</h3>
          <span class="text-muted text-[13px] font-medium">{{
            allTemplatesCountLabel
          }}</span>
        </div>
        <div class="shelf-mat space-y-2">
          <div class="grid gap-3 sm:grid-cols-2">
            <ReviewWizardTemplateCard
              v-for="card in allShelf.visible.value"
              :key="card.id"
              :card="card"
              :selected="isSelected(card.id)"
              :owner-name="ownerNameFor(card)"
              @toggle="emit('toggle-template', $event)"
            />
          </div>
          <button
            v-if="allShelf.hasToggle.value"
            type="button"
            :aria-expanded="allShelf.isRevealed.value"
            class="text-muted hover:text-default hover:bg-default/70 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-colors"
            @click="allShelf.toggle"
          >
            <Icon
              :name="
                allShelf.toggleLabel.value === 'Show fewer'
                  ? 'lucide:chevron-up'
                  : 'lucide:chevron-down'
              "
              class="h-4 w-4"
            />
            {{ allShelf.toggleLabel.value }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* Each shelf is a cutting mat — the Guided Drafting Room's signature
   material at catalog scale. Template cards read as sheets lying on the
   table; the sheet's own background always paints over the mat, never the
   reverse. Same recipe as the room: 1px radial-gradient dots on a 24px
   grid over the well. */
.shelf-mat {
  padding: 0.75rem;
  border-radius: 8px;
  background-color: #f4f5f7;
  background-image: radial-gradient(#e4e7eb 1px, transparent 1px);
  background-size: 24px 24px;
}

.dark .shelf-mat {
  background-color: rgb(30 41 59 / 0.3);
  background-image: radial-gradient(rgb(51 65 85 / 0.5) 1px, transparent 1px);
}

/* One quiet settle on first paint: shelf blocks rise 6px with a 40ms
   stagger, then stillness. Armed after hydration (see entranceArmed), so
   SSR markup and no-JS render the finished view. */
.wizard-entrance .wiz-reveal {
  animation: wiz-rise 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--wiz-i, 0) * 40ms);
}

@keyframes wiz-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wizard-entrance .wiz-reveal {
    animation: none;
  }
}
</style>
