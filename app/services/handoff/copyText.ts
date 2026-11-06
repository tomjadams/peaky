/**
 * Provider-neutral Markdown for the active handoff (improvement-plans/REQ-009,
 * REQ-012; AC-034, AC-044, AC-045). Pure module: no I/O or environment access.
 */
import {
  escapeMarkdownInline,
  markdownLink,
  markdownTableCell,
} from "~/utils/markdown";
import type { HandoffDraft, OrderedDraftPractice } from "./draft";

/**
 * Everything the renderer needs from its caller. Paths are route-style
 * absolute paths (`/teams/...`); the renderer prefixes them with `origin`.
 */
export interface HandoffRenderContext {
  /** Absolute origin, resolved by the caller (window.location.origin). */
  readonly origin: string;
  /** Path to the owning Review; omitted from the output when absent. */
  readonly reviewPath?: string;
  /** Assessment deep-link path for one ordered draft practice (AC-018). */
  readonly practicePath: (practice: OrderedDraftPractice) => string;
}

/** Thrown when a draft cannot be rendered for copy (e.g. empty selection). */
export class HandoffRenderError extends Error {
  readonly code = "handoff_render_failed" as const;

  constructor(message: string) {
    super(message);
    this.name = "HandoffRenderError";
  }
}

function practiceSource(practice: OrderedDraftPractice): string {
  const snapshot = practice.record.snapshot;
  return snapshot.revisionNumber === null
    ? snapshot.templateName
    : `${snapshot.templateName} · revision ${snapshot.revisionNumber}`;
}

function renderSummaryRow(practice: OrderedDraftPractice): string {
  const snapshot = practice.record.snapshot;
  return `| ${practice.position} | ${markdownTableCell(snapshot.title)} | ${markdownTableCell(snapshot.pillarName)} | ${markdownTableCell(practiceSource(practice))} |`;
}

/**
 * Renders one practice as an indented block under its 1-based draft
 * position. Absent optional context (rationale, helpful links, a numbered
 * Revision) leaves no placeholder line behind.
 */
function renderPractice(
  practice: OrderedDraftPractice,
  context: HandoffRenderContext
): string[] {
  const { record, position } = practice;
  const snapshot = record.snapshot;
  const source = escapeMarkdownInline(practiceSource(practice));

  const lines = [
    `### ${position}. ${escapeMarkdownInline(snapshot.title)}`,
    "",
    `- **Source:** ${source}`,
    `- **Pillar:** ${escapeMarkdownInline(snapshot.pillarName)}`,
    `- **Question:** ${escapeMarkdownInline(snapshot.questionText)}`,
    "- **Evidence:** Area needing attention",
  ];
  if (record.rationale !== null && record.rationale !== "") {
    lines.push(`- **Note:** ${escapeMarkdownInline(record.rationale)}`);
  }
  if (snapshot.helpfulLinks.length > 0) {
    lines.push("- **Resources:**");
    for (const link of snapshot.helpfulLinks) {
      lines.push(`  - ${markdownLink(link.title, link.url)}`);
    }
  }
  const assessmentUrl = new URL(
    context.practicePath(practice),
    context.origin
  ).toString();
  lines.push(
    `- **Assessment:** ${markdownLink("Open question", assessmentUrl)}`
  );
  return lines;
}

/**
 * Renders ordered Markdown for a handoff draft without mutating it (AC-045).
 *
 * @throws HandoffRenderError when the draft is empty; the message names
 * the action that adds practices (AC-027).
 */
export function renderHandoffMarkdown(
  draft: HandoffDraft,
  context: HandoffRenderContext
): string {
  if (draft.kind === "empty") {
    throw new HandoffRenderError(`Nothing to copy yet: ${draft.action}.`);
  }

  const lines = [`# ${escapeMarkdownInline(draft.label)}`];
  if (context.reviewPath !== undefined && context.reviewPath !== "") {
    const reviewUrl = new URL(context.reviewPath, context.origin).toString();
    lines.push("", markdownLink("Open review", reviewUrl));
  }
  lines.push(
    "",
    "## Summary",
    "",
    "| # | Area needing attention | Pillar | Source |",
    "| ---: | --- | --- | --- |"
  );
  for (const practice of draft.practices) {
    lines.push(renderSummaryRow(practice));
  }
  lines.push("", "## Details");
  for (const practice of draft.practices) {
    lines.push("", ...renderPractice(practice, context));
  }
  return lines.join("\n");
}
