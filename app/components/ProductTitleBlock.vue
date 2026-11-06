<script setup lang="ts">
export interface TitleBlockPerson {
  name: string;
  href: string;
}

export interface TitleBlockEntity {
  label: string;
  href: string;
}

export interface TitleBlockReference {
  /** Field name, e.g. "Roadmap". */
  label: string;
  /** What it points at, e.g. "View roadmap" or "#help-checkout". */
  value: string;
  icon: string;
  href?: string;
}

defineProps<{
  productManager: TitleBlockPerson;
  engineeringLead: TitleBlockPerson | null;
  teams: TitleBlockEntity[];
  applications: TitleBlockEntity[];
  references: TitleBlockReference[];
  /** "Added by {name}" — the title block's drawn-by field. */
  addedBy: string;
}>();

const countLabel = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;
</script>

<template>
  <!-- The product's title block. On a drafted map or an engineering drawing
       the title block is the ruled panel that names who drew the sheet, who
       approved it, and which documents it references — exactly this content.
       Built the way one is drawn: an outer frame, an inset neatline, a
       caption rule, and hairline cell divisions. No fill, no shadow; the
       lines do all of it. -->
  <section
    class="title-block border-accented bg-default rounded-lg border"
    aria-labelledby="product-title-block-caption"
  >
    <div class="title-block__neatline border-default rounded-[4px] border">
      <div
        class="border-default flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-6 py-4"
      >
        <h2
          id="product-title-block-caption"
          class="text-highlighted text-base font-semibold"
        >
          Ownership and resources
        </h2>
        <p class="text-dimmed text-[13px]">Added by {{ addedBy }}</p>
      </div>

      <div class="title-block__cells">
        <!-- Contacts first and widest: the names are the point of this
             panel, and this is the drawn-by / checked-by stack a real title
             block opens with. -->
        <div class="title-block__cell title-block__cell--contacts">
          <h3 class="title-block__field">Contacts</h3>
          <dl class="mt-2 space-y-2.5">
            <div>
              <dt class="text-dimmed text-[13px]">Product manager</dt>
              <dd>
                <a
                  :href="productManager.href"
                  target="_blank"
                  rel="noreferrer"
                  class="text-primary hover:text-primary/80 text-[15px] font-semibold transition-colors"
                >
                  {{ productManager.name }}
                </a>
              </dd>
            </div>
            <div>
              <dt class="text-dimmed text-[13px]">Engineering lead</dt>
              <dd>
                <a
                  v-if="engineeringLead"
                  :href="engineeringLead.href"
                  target="_blank"
                  rel="noreferrer"
                  class="text-primary hover:text-primary/80 text-[15px] font-semibold transition-colors"
                >
                  {{ engineeringLead.name }}
                </a>
                <span v-else class="title-block__blank mt-0.5">Not set</span>
              </dd>
            </div>
          </dl>
        </div>

        <div class="title-block__cell">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="title-block__field">Teams</h3>
            <span
              v-if="teams.length > 0"
              class="text-dimmed shrink-0 text-[13px] tabular-nums"
            >
              {{ countLabel(teams.length, "team") }}
            </span>
          </div>
          <div v-if="teams.length > 0" class="mt-2 flex flex-wrap gap-1.5">
            <a
              v-for="team in teams"
              :key="team.href"
              :href="team.href"
              target="_blank"
              rel="noreferrer"
              class="border-default bg-muted text-muted hover:border-accented hover:text-primary inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium transition-colors"
            >
              {{ team.label }}
            </a>
          </div>
          <span v-else class="title-block__blank mt-2">None assigned</span>
        </div>

        <div class="title-block__cell">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="title-block__field">Applications</h3>
            <span
              v-if="applications.length > 0"
              class="text-dimmed shrink-0 text-[13px] tabular-nums"
            >
              {{ countLabel(applications.length, "application") }}
            </span>
          </div>
          <div
            v-if="applications.length > 0"
            class="mt-2 flex flex-wrap gap-1.5"
          >
            <a
              v-for="application in applications"
              :key="application.href"
              :href="application.href"
              target="_blank"
              rel="noreferrer"
              class="border-default bg-muted text-muted hover:border-accented hover:text-primary inline-flex items-center rounded-md border px-2 py-0.5 text-[13px] font-medium transition-colors"
            >
              {{ application.label }}
            </a>
          </div>
          <span v-else class="title-block__blank mt-2">None linked</span>
        </div>

        <div class="title-block__cell title-block__cell--references">
          <h3 class="title-block__field">References</h3>
          <dl v-if="references.length > 0" class="mt-2 space-y-1.5">
            <div
              v-for="reference in references"
              :key="reference.label"
              class="flex min-w-0 items-baseline gap-2"
            >
              <dt class="text-dimmed shrink-0 text-[13px]">
                {{ reference.label }}
              </dt>
              <dd class="min-w-0 flex-1">
                <a
                  v-if="reference.href"
                  :href="reference.href"
                  target="_blank"
                  rel="noreferrer"
                  class="text-primary hover:text-primary/80 inline-flex max-w-full min-w-0 items-center gap-1.5 text-sm font-medium transition-colors"
                >
                  <Icon :name="reference.icon" class="h-3.5 w-3.5 shrink-0" />
                  <span class="truncate">{{ reference.value }}</span>
                </a>
                <span
                  v-else
                  class="text-default inline-flex max-w-full min-w-0 items-center gap-1.5 text-sm font-medium"
                >
                  <Icon
                    :name="reference.icon"
                    class="text-muted h-3.5 w-3.5 shrink-0"
                  />
                  <span class="truncate">{{ reference.value }}</span>
                </span>
              </dd>
            </div>
          </dl>
          <span v-else class="title-block__blank mt-2">No links added</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Neatline: the inner hairline frame a drafted sheet carries inside its
   outer border, the same device the stat plate uses — in the standard
   hairline here, because this panel sits on white, not chart paper. Every
   internal rule stops at it, so the frame reads as double-ruled rather
   than crossed. */
.title-block__neatline {
  margin: 5px;
  overflow: hidden;
}

/* Ruled cells. The divisions are internal to a bounded object — title-block
   vocabulary, the same allowance a table sheet has — never page-level
   section rules. One column stacks with horizontal rules; two columns and
   five columns rule vertically, and only where cells actually sit side by
   side. */
.title-block__cells {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.title-block__cell {
  padding: 1rem 1.5rem 1.25rem;
}

.title-block__cell + .title-block__cell {
  border-top: 1px solid var(--ui-border);
}

@media (min-width: 640px) {
  .title-block__cells {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .title-block__cell + .title-block__cell {
    border-top: 0;
  }

  .title-block__cell:nth-child(n + 3) {
    border-top: 1px solid var(--ui-border);
  }

  .title-block__cell:nth-child(even) {
    border-left: 1px solid var(--ui-border);
  }
}

@media (min-width: 1280px) {
  /* Uneven field widths, the way a drawn title block rules them: the two
     list cells stay narrow, the stacked contacts and the reference lines
     take the room they need. */
  .title-block__cells {
    grid-template-columns:
      minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr)
      minmax(0, 1.15fr);
  }

  .title-block__cell:nth-child(n + 3) {
    border-top: 0;
  }

  .title-block__cell:not(:first-child) {
    border-left: 1px solid var(--ui-border);
  }
}

.dark .title-block__cell {
  border-color: #334155;
}

/* Field name — the table-header voice, because this is a ruled object. */
.title-block__field {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ui-text-muted);
}

/* An unfilled field on a drawing: dashed means nothing is entered here yet,
   and nothing has to be. */
.title-block__blank {
  display: inline-flex;
  align-items: center;
  border: 1px dashed var(--ui-border);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 13px;
  color: var(--ui-text-dimmed);
}

.dark .title-block__blank {
  border-color: #334155;
}
</style>
