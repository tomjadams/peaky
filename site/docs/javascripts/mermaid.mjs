/**
 * Custom Mermaid Configuration - Modern "Neo" Style
 *
 * This module overrides Zensical's default mermaid rendering to apply our
 * violet/purple brand colors with the modern "neo" look from Mermaid 11.
 *
 * We can't use CSS to style mermaid diagrams because Zensical renders them
 * inside a closed Shadow DOM, which blocks external stylesheets.
 *
 * Instead, we:
 * 1. Import mermaid directly from CDN
 * 2. Initialize it with "neo" look + custom theme variables
 * 3. Re-render all diagrams after Zensical's bundle has run
 * 4. Detect dark mode and apply appropriate theme
 */
// Load mermaid from CDN with cache-first strategy.
// On repeat visits (even offline), the browser serves from HTTP cache
// without hitting the network. Only the first-ever load requires connectivity.
const MERMAID_CDN =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

let mermaid;
try {
  // Prefetch with cache-first — populates the module graph from HTTP cache
  // when available, avoiding the network revalidation that blocks offline imports.
  await fetch(MERMAID_CDN, { cache: "force-cache" }).catch(() => {});
  const module = await import(MERMAID_CDN);
  mermaid = module.default;
} catch {
  // CDN unreachable and not cached — stop silently, Zensical shows raw text
  console.debug("[mermaid] CDN unavailable, diagrams will show as text");
}

// Detect if dark mode is active (Zensical puts scheme on body, not documentElement)
const isDarkMode = () =>
  document.body?.getAttribute("data-md-color-scheme") === "slate" ||
  document.documentElement.getAttribute("data-md-color-scheme") === "slate";

// Light mode theme - violet/purple brand with high contrast
const lightTheme = {
  // Core palette
  primaryColor: "#ddd6fe",
  primaryTextColor: "#1f2937",
  primaryBorderColor: "#8b5cf6",
  lineColor: "#7c3aed",
  secondaryColor: "#ede9fe",
  tertiaryColor: "#f5f3ff",

  // Background and containers
  background: "#faf5ff",
  mainBkg: "#ede9fe",
  clusterBkg: "#f5f3ff",
  clusterBorder: "#c4b5fd",

  // Node styling - strong contrast
  nodeBorder: "#8b5cf6",
  nodeTextColor: "#1f2937",

  // ERD specific - use theme-matching colors instead of white
  entityBorder: "#8b5cf6",
  entityBkg: "#ede9fe",
  attributeBackgroundColorOdd: "#f5f3ff",
  attributeBackgroundColorEven: "#ede9fe",

  // State diagram
  labelColor: "#1f2937",
  altBackground: "#f5f3ff",

  // Sequence diagram
  actorBkg: "#ddd6fe",
  actorBorder: "#8b5cf6",
  actorTextColor: "#1f2937",
  actorLineColor: "#7c3aed",
  signalColor: "#1f2937",
  signalTextColor: "#1f2937",
  noteBkgColor: "#fef3c7",
  noteTextColor: "#78350f",
  noteBorderColor: "#f59e0b",
  activationBkgColor: "#c4b5fd",
  activationBorderColor: "#7c3aed",
  sequenceNumberColor: "#ffffff",

  // Typography
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: "14px",

  // Edges and arrows - use light purple instead of white
  edgeLabelBackground: "#ede9fe",
  relationColor: "#7c3aed",
  relationLabelColor: "#4b5563",
  relationLabelBackground: "#ede9fe",

  // Timeline bands - muted slate tones that work on light backgrounds
  cScale0: "#e2e8f0",
  cScale1: "#cbd5e1",
  cScale2: "#94a3b8",
  cScale3: "#64748b",
  cScaleLabel0: "#1e293b",
  cScaleLabel1: "#1e293b",
  cScaleLabel2: "#1e293b",
  cScaleLabel3: "#ffffff",
};

// Dark mode theme - high contrast with vibrant colors
const darkTheme = {
  // Enable dark mode calculations
  darkMode: true,

  // Core palette - brighter for dark backgrounds
  primaryColor: "#7c3aed",
  primaryTextColor: "#f9fafb",
  primaryBorderColor: "#a78bfa",
  lineColor: "#a78bfa",
  secondaryColor: "#4c1d95",
  tertiaryColor: "#2e1065",

  // Background and containers
  background: "#18181b",
  mainBkg: "#4c1d95",
  clusterBkg: "#1e1b4b",
  clusterBorder: "#6d28d9",

  // Node styling - bright text on dark
  nodeBorder: "#a78bfa",
  nodeTextColor: "#f9fafb",

  // ERD specific - ensure readability
  entityBorder: "#a78bfa",
  entityBkg: "#2e1065",
  attributeBackgroundColorOdd: "#2e1065",
  attributeBackgroundColorEven: "#3b1f7a",

  // State diagram
  labelColor: "#f9fafb",
  altBackground: "#1e1b4b",

  // Sequence diagram
  actorBkg: "#4c1d95",
  actorBorder: "#a78bfa",
  actorTextColor: "#f9fafb",
  actorLineColor: "#a78bfa",
  signalColor: "#f9fafb",
  signalTextColor: "#f9fafb",
  noteBkgColor: "#78350f",
  noteTextColor: "#fef3c7",
  noteBorderColor: "#f59e0b",
  activationBkgColor: "#5b21b6",
  activationBorderColor: "#a78bfa",
  sequenceNumberColor: "#ffffff",

  // Typography
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: "14px",

  // Edges and arrows
  edgeLabelBackground: "#27272a",
  relationColor: "#a78bfa",
  relationLabelColor: "#d4d4d8",
  relationLabelBackground: "#27272a",

  // Timeline bands - dark slate tones with light labels for readability
  cScale0: "#334155",
  cScale1: "#1e293b",
  cScale2: "#0f172a",
  cScale3: "#1e1b4b",
  cScaleLabel0: "#e2e8f0",
  cScaleLabel1: "#e2e8f0",
  cScaleLabel2: "#f9fafb",
  cScaleLabel3: "#e2e8f0",
};

// Get configuration based on current theme
function getConfig() {
  const dark = isDarkMode();
  return {
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    look: "neo",
    flowchart: {
      curve: "basis",
      padding: 20,
      nodeSpacing: 50,
      rankSpacing: 50,
      htmlLabels: true,
      useMaxWidth: true,
      wrappingWidth: 300,
    },
    er: {
      useMaxWidth: true,
      layoutDirection: "TB",
      minEntityWidth: 120,
      minEntityHeight: 80,
      entityPadding: 20,
    },
    sequence: {
      useMaxWidth: true,
      boxMargin: 12,
      boxTextMargin: 8,
      noteMargin: 12,
      messageMargin: 40,
      mirrorActors: false,
      bottomMarginAdj: 12,
      actorFontSize: 14,
      actorFontWeight: 600,
      noteFontSize: 13,
      messageFontSize: 14,
    },
    state: {
      useMaxWidth: true,
      nodeSpacing: 60,
      rankSpacing: 50,
    },
    themeVariables: dark ? darkTheme : lightTheme,
  };
}

// If mermaid failed to load (offline), stop here
if (!mermaid) {
  // No-op — Zensical shows raw diagram text as fallback
} else {

// Initialize with current theme
mermaid.initialize(getConfig());

/**
 * Post-process a rendered mermaid SVG to fix white fills and improve contrast.
 * Works on a div that already contains the rendered SVG.
 */
function postProcessSVG(container) {
  const svgEl = container.querySelector("svg");
  if (!svgEl) return;

  const dark = isDarkMode();
  const lightPurple = "#ede9fe";
  const darkPurple = "#1e1b4b";
  const veryDarkPurple = "#0f0a1e";
  const bgColor = dark ? darkPurple : lightPurple;

  // Fix ALL white fills - circles, rects, paths
  svgEl
    .querySelectorAll(
      '[fill="white"], [fill="#ffffff"], [fill="#fff"], [fill="rgb(255, 255, 255)"]'
    )
    .forEach((el) => {
      el.setAttribute("fill", dark ? veryDarkPurple : lightPurple);
    });

  // Fix edge label backgrounds - both rect and foreignObject divs
  svgEl
    .querySelectorAll(".edgeLabel rect, .labelBkg rect, .edgeLabels rect")
    .forEach((rect) => {
      rect.setAttribute("fill", bgColor);
    });

  // Fix edgeLabel foreignObject backgrounds via inline style
  svgEl
    .querySelectorAll(".edgeLabel .labelBkg, .edgeLabel span, .edgeLabel p")
    .forEach((el) => {
      el.style.backgroundColor = bgColor;
    });

  // Fix any remaining circles (ERD markers)
  svgEl.querySelectorAll("circle").forEach((circle) => {
    const fill = circle.getAttribute("fill");
    if (!fill || fill === "white" || fill === "#ffffff" || fill === "#fff") {
      circle.setAttribute("fill", dark ? veryDarkPurple : lightPurple);
    }
  });

  // Dark mode specific: fix ALL HSL and light fills to use hex dark values
  if (dark) {
    let toggle = false;
    svgEl.querySelectorAll("path[fill], rect[fill]").forEach((el) => {
      const fill = el.getAttribute("fill");
      if (fill) {
        if (fill.includes("hsl")) {
          toggle = !toggle;
          el.setAttribute("fill", toggle ? "#0d0830" : "#150b3d");
        } else if (fill.includes("rgb") && fill.includes("255")) {
          el.setAttribute("fill", veryDarkPurple);
        }
      }
    });
  }

  // Fix any pure white backgrounds that mermaid generates (both modes)
  svgEl.querySelectorAll("rect").forEach((rect) => {
    const fill = rect.getAttribute("fill");
    if (fill === "white" || fill === "#ffffff" || fill === "#fff") {
      rect.setAttribute("fill", bgColor);
    }
  });

  // Hide edge label background rects (they create visual artifacts)
  svgEl
    .querySelectorAll(".edgeLabel rect, .edgeLabels rect")
    .forEach((rect) => {
      rect.style.opacity = "0";
      rect.style.fill = "transparent";
    });

  // Also hide any rect inside label groups that has opacity
  svgEl.querySelectorAll(".label rect").forEach((rect) => {
    const opacity =
      rect.getAttribute("opacity") || getComputedStyle(rect).opacity;
    if (opacity && parseFloat(opacity) < 1) {
      rect.style.opacity = "0";
    }
  });
}

/**
 * Re-renders all mermaid diagrams on the page with our custom theme.
 *
 * Zensical renders mermaid into a closed Shadow DOM which blocks CSS styling.
 * This function extracts the original mermaid source and re-renders them as
 * plain SVG that respects our themeVariables.
 *
 * @param {boolean} forceAll - Re-render all diagrams, not just unrendered ones
 * @returns {Promise<void>}
 */
async function renderAll(forceAll = false) {
  // Re-initialize mermaid with current theme (light/dark)
  mermaid.initialize(getConfig());

  // Select elements to render
  const selector = forceAll
    ? ".mermaid[data-source], pre.mermaid"
    : "pre.mermaid:not([data-rendered])";
  const elements = document.querySelectorAll(selector);

  // If Zensical already consumed the <pre.mermaid> elements, fall back to
  // sources saved by the inline script in overrides/main.html
  const useSavedSources =
    elements.length === 0 &&
    window.__mermaidSources?.length > 0 &&
    document.querySelectorAll("div.mermaid:not([data-rendered])").length > 0;

  if (useSavedSources) {
    const divs = document.querySelectorAll(
      "div.mermaid:not([data-rendered])"
    );
    for (let i = 0; i < divs.length && i < window.__mermaidSources.length; i++) {
      const source = window.__mermaidSources[i];
      if (!source?.trim()) continue;

      try {
        const id = `m-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, source);
        const div = document.createElement("div");
        div.className = "mermaid";
        div.innerHTML = svg;
        div.setAttribute("data-rendered", "true");
        div.setAttribute("data-source", source);
        postProcessSVG(div);
        divs[i].replaceWith(div);
      } catch (err) {
        console.error("Mermaid render error:", err);
        const errorDiv = document.createElement("div");
        errorDiv.className = "mermaid mermaid-error";
        errorDiv.innerHTML = `<pre style="color: #ef4444; font-size: 12px; padding: 1rem;">Diagram Error: ${err.message}</pre>`;
        errorDiv.setAttribute("data-source", source);
        divs[i].replaceWith(errorDiv);
      }
    }
    return;
  }

  for (const el of elements) {
    // Get source - either from data attribute (re-render) or from element content (first render)
    let source = el.getAttribute("data-source");
    if (!source) {
      source = el.querySelector("code")?.textContent || el.textContent;
    }

    if (!source?.trim()) continue;

    try {
      const id = `m-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, source);
      const div = document.createElement("div");
      div.className = "mermaid";
      div.innerHTML = svg;
      div.setAttribute("data-rendered", "true");
      // Store source in data attribute for theme-change re-renders
      div.setAttribute("data-source", source);
      postProcessSVG(div);
      el.replaceWith(div);
    } catch (err) {
      console.error("Mermaid render error:", err);
      const errorDiv = document.createElement("div");
      errorDiv.className = "mermaid mermaid-error";
      errorDiv.innerHTML = `<pre style="color: #ef4444; font-size: 12px; padding: 1rem;">Diagram Error: ${err.message}\n\nSource:\n${source.slice(0, 200)}...</pre>`;
      errorDiv.setAttribute("data-source", source); // Keep source for retry
      el.replaceWith(errorDiv);
    }
  }
}

// Re-render all diagrams when theme changes
function observeThemeChange() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "data-md-color-scheme"
      ) {
        // Theme changed - force re-render all diagrams with new theme
        setTimeout(() => renderAll(true), 50);
      }
    }
  });

  // Observe both body and documentElement for scheme changes
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"],
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-md-color-scheme"],
  });
}

// Watch for new mermaid elements added to the DOM (handles SPA navigation)
function observeNewDiagrams() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        // Check if any new pre.mermaid elements were added
        const hasNewMermaid = Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === 1 &&
            (node.matches?.("pre.mermaid") ||
              node.querySelector?.("pre.mermaid"))
        );
        if (hasNewMermaid) {
          setTimeout(renderAll, 100);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Render on page load.
// Because this module uses top-level await (async module), it runs after
// DOMContentLoaded may have already fired. Zensical's bundle replaces
// <pre class="mermaid"> with empty <div class="mermaid"> asynchronously,
// so requestAnimationFrame may fire before the divs exist. Retry with
// a short delay to catch the divs after Zensical finishes processing.
function renderOnLoad(retryCount = 0) {
  const emptyDivs = document.querySelectorAll("div.mermaid:not([data-rendered])").length;
  const hasSources = window.__mermaidSources?.length > 0;

  if (emptyDivs > 0 || !hasSources) {
    // Divs exist or no sources to render — proceed
    void renderAll();
    observeThemeChange();
    observeNewDiagrams();
  } else if (retryCount < 20) {
    // Divs not yet created by Zensical — retry after a short delay
    setTimeout(() => renderOnLoad(retryCount + 1), 200);
  } else {
    // Give up after ~4 seconds — Zensical may have already rendered
    // diagrams in light mode inside a Shadow DOM
    void renderAll();
    observeThemeChange();
    observeNewDiagrams();
  }
}
requestAnimationFrame(() => renderOnLoad());

// Re-render after Zensical's instant navigation (SPA-style page transitions)
// Try multiple approaches for compatibility
// eslint-disable-next-line no-undef
if (typeof document$ !== "undefined" && document$?.subscribe) {
  // eslint-disable-next-line no-undef
  document$.subscribe(() => setTimeout(renderAll, 100));
}

// Also listen for popstate (browser back/forward)
window.addEventListener("popstate", () => setTimeout(renderAll, 150));

} // end if (mermaid)
