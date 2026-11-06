export default defineAppConfig({
  ui: {
    colors: {
      primary: "sky",
      secondary: "green",
      neutral: "slate",
    },
    button: {
      slots: {
        // "Instrument keys" — geometry only here; color/state deltas live in
        // compoundVariants below so the default (untouched) classes for
        // secondary/success/warning/error/info colors still show through.
        base: "rounded-[7px] justify-center font-semibold transition-[color,background-color,border-color,transform] duration-150 disabled:opacity-45 aria-disabled:opacity-45",
      },
      variants: {
        size: {
          xs: { base: "h-8 px-2.5 py-0 text-xs gap-1.5" },
          sm: { base: "h-9 px-3.5 py-0 text-sm gap-2" },
          md: {
            base: "h-11 px-4 py-0 text-[15px] gap-2",
            leadingIcon: "size-4",
            trailingIcon: "size-4",
          },
          lg: {
            base: "h-12 px-5 py-0 text-base gap-2",
            leadingIcon: "size-[18px]",
            trailingIcon: "size-[18px]",
          },
          xl: { base: "h-14 px-6 py-0 text-base gap-2.5" },
        },
      },
      compoundVariants: [
        // PRIMARY (solid) — a machined "pressed key": solid darken on
        // hover/active (never an opacity fade) plus a subtle inset bottom
        // edge and a 1px press nudge.
        {
          color: "primary",
          variant: "solid",
          class:
            "font-bold shadow-[inset_0_-1px_0_rgba(2,44,69,0.45)] hover:bg-primary-800 active:bg-primary-900 active:translate-y-[0.5px] dark:hover:bg-primary-500 dark:active:bg-primary-600",
        },
        // SECONDARY (neutral outline) — border-accented ring at 1.5px, well
        // fill + one-step-darker border on hover, no color tints.
        {
          color: "neutral",
          variant: "outline",
          class:
            "ring-[1.5px] ring-accented hover:bg-muted hover:ring-neutral-400 active:bg-muted active:ring-neutral-400 active:translate-y-[0.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0 dark:hover:ring-neutral-500 dark:active:ring-neutral-500",
        },
        // GHOST — muted text that resolves to ink + a well fill on hover.
        {
          color: "neutral",
          variant: "ghost",
          class:
            "text-muted hover:text-highlighted hover:bg-muted active:text-highlighted active:bg-muted active:translate-y-[0.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:bg-transparent",
        },
        // TEXT/LINK — muted text that darkens to ink, no border ever.
        {
          color: "neutral",
          variant: "link",
          class:
            "hover:text-highlighted active:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:ring-0",
        },
        // Square (icon-only) buttons stay true squares at the new heights.
        { size: "xs", square: true, class: "h-8 w-8 p-0" },
        { size: "sm", square: true, class: "h-9 w-9 p-0" },
        { size: "md", square: true, class: "h-11 w-11 p-0" },
        { size: "lg", square: true, class: "h-12 w-12 p-0" },
        { size: "xl", square: true, class: "h-14 w-14 p-0" },
      ],
    },
    input: {
      slots: {
        root: "w-full",
        base: "w-full rounded-lg border-0 bg-white px-4 py-2.5 text-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 hover:ring-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary focus:hover:ring-primary dark:bg-slate-900 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:hover:ring-slate-600 dark:focus:hover:ring-primary",
      },
      variants: {
        size: {
          xs: { base: "px-2 py-1 text-xs" },
          sm: { base: "px-3 py-1.5 text-sm" },
          md: { base: "px-4 py-2 text-sm" },
          lg: { base: "px-4 py-2.5 text-base" },
          xl: { base: "px-5 py-3 text-base" },
        },
      },
      defaultVariants: {
        size: "md",
      },
    },
    select: {
      slots: {
        base: "w-full rounded-lg border-0 bg-white text-slate-900 ring-1 ring-inset ring-slate-300 transition-colors hover:ring-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary focus:hover:ring-primary dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:hover:ring-slate-600 dark:focus:hover:ring-primary",
        value: "truncate text-slate-900 dark:text-white",
        placeholder: "truncate text-slate-500 dark:text-slate-400",
        content:
          "max-h-72 w-(--reka-select-trigger-width) rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.10)] ring-0 dark:border-slate-700 dark:bg-slate-900",
        viewport: "relative scroll-py-1 overflow-y-auto p-1",
        item: "group relative w-full flex items-start rounded-md px-3 py-2 text-sm text-slate-700 outline-none transition-colors data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 dark:text-slate-300 dark:data-[highlighted]:bg-slate-800 dark:data-[highlighted]:text-white",
      },
      defaultVariants: {
        size: "md",
        variant: "none",
      },
    },
    textarea: {
      slots: {
        root: "w-full",
        base: "w-full rounded-lg border-0 bg-white px-4 py-3 text-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 hover:ring-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary focus:hover:ring-primary dark:bg-slate-900 dark:ring-slate-700 dark:placeholder:text-slate-500 dark:hover:ring-slate-600 dark:focus:hover:ring-primary",
      },
      variants: {
        size: {
          sm: { base: "px-3 py-2 text-sm" },
          md: { base: "px-4 py-3 text-sm" },
          lg: { base: "px-4 py-3 text-base" },
        },
      },
      defaultVariants: {
        size: "md",
      },
    },
    selectMenu: {
      slots: {
        // Mirrors `select.slots.base/value/placeholder` above so USelectMenu
        // triggers match USelect triggers (previously only content/overlay
        // was themed here).
        base: "w-full rounded-lg border-0 bg-white text-slate-900 ring-1 ring-inset ring-slate-300 transition-colors hover:ring-slate-400 focus:ring-2 focus:ring-inset focus:ring-primary focus:hover:ring-primary dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:hover:ring-slate-600 dark:focus:hover:ring-primary",
        value: "truncate text-slate-900 dark:text-white",
        placeholder: "truncate text-slate-500 dark:text-slate-400",
        content: "rounded-lg shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
        item: "text-[15px]",
      },
    },
    dropdownMenu: {
      slots: {
        content: "rounded-lg shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
        item: "text-[15px]",
      },
    },
    popover: {
      slots: {
        content: "rounded-lg shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
      },
    },
    tooltip: {
      slots: {
        // text-sm (14px) already clears the 13px floor. Stock radius
        // (rounded-sm, 2px) and stock shadow (shadow-sm, a resting shadow)
        // both read "stock" — overlay radius + shadow token match the
        // popover/dropdownMenu pattern above.
        content:
          "bg-slate-800 text-white text-sm font-medium px-3 py-1.5 rounded-md shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
      },
    },
    badge: {
      // Stock badge sizes render at text-[8px]/[10px]/xs (8/10/12px) on
      // rounded-sm (2px) — all below the 13px floor and on the retired 2px
      // radius. Bump xs/sm/md to >=13px on rounded-md (6px, the chip/badge
      // radius per Cartographer), with padding nudged up to match. lg/xl are
      // already >=14px and untouched.
      variants: {
        size: {
          xs: { base: "text-[13px]/4 px-2 py-1 gap-1 rounded-md" },
          sm: { base: "text-[13px]/4 px-2 py-1 gap-1 rounded-md" },
          md: { base: "text-sm px-2.5 py-1 gap-1 rounded-md" },
        },
      },
    },
    toast: {
      slots: {
        root: "rounded-lg ring ring-default shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
        title: "text-[15px] font-semibold text-highlighted",
        description: "text-[14px] text-muted",
      },
    },
  },
});
