import type {
  RiskLevel,
  TemplateRevisionDetail,
  TemplatePillar,
  TemplateQuestion,
} from "~/models";
import { createUuidV7 } from "#shared/id";
import {
  markdownLink,
  parseMarkdownDestination,
  unescapeMarkdownInline,
} from "~/utils/markdown";

export const UNSUPPORTED_TEMPLATE_RULES_MESSAGE =
  'Template Rules are no longer supported. Remove the "## Rules" section and try again.';

export class UnsupportedTemplateRulesMarkdownError extends Error {
  constructor() {
    super(UNSUPPORTED_TEMPLATE_RULES_MESSAGE);
    this.name = "UnsupportedTemplateRulesMarkdownError";
  }
}

type ParseSection =
  | "question"
  | "importance"
  | "checklist"
  | "practices"
  | "links"
  | null;

interface ParseState {
  template: Partial<TemplateRevisionDetail>;
  currentPillar: TemplatePillar | null;
  currentQuestion: TemplateQuestion | null;
  currentSection: ParseSection;
  importanceBuffer: string[];
}

const formatRiskBadge = (riskLevel: string): string =>
  `[${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}]`;

const checklistItemsToLines = (question: TemplateQuestion): string[] => {
  if (question.type !== "checklist") return [];
  const lines = ["**Checklist Items:**", ""];
  for (const item of question.checklistItems ?? []) {
    lines.push(`- ${item.text}`);
  }
  lines.push("");
  return lines;
};

const leadingPracticesToLines = (question: TemplateQuestion): string[] => {
  if (question.leadingPractices.length === 0) return [];
  const lines = ["**Leading Practices:**", ""];
  for (const practice of question.leadingPractices) {
    lines.push(`- ${practice.text}`);
  }
  lines.push("");
  return lines;
};

const helpfulLinksToLines = (question: TemplateQuestion): string[] => {
  if (question.helpfulLinks.length === 0) return [];
  const lines = ["**Helpful Links:**", ""];
  for (const link of question.helpfulLinks) {
    lines.push(`- ${markdownLink(link.title, link.url)}`);
  }
  lines.push("");
  return lines;
};

const questionToLines = (question: TemplateQuestion): string[] => {
  const lines: string[] = [
    `### Question ${question.order} ${formatRiskBadge(question.riskLevel)}`,
    "",
    question.text,
    "",
    `**Type:** ${question.type ?? "yes-no"}`,
    "",
  ];
  if (question.importance) {
    lines.push("**Why it's important:**", "", question.importance, "");
  }
  lines.push(...checklistItemsToLines(question));
  lines.push(...leadingPracticesToLines(question));
  lines.push(...helpfulLinksToLines(question));
  lines.push("---", "");
  return lines;
};

const pillarToLines = (pillar: TemplatePillar): string[] => {
  const lines: string[] = [`## Pillar: ${pillar.name}`, ""];
  for (const question of pillar.questions) {
    lines.push(...questionToLines(question));
  }
  return lines;
};

export const templateToMarkdown = (
  template: TemplateRevisionDetail
): string => {
  const lines: string[] = [`# Template: ${template.name}`, ""];
  if (template.description) {
    lines.push(`> ${template.description}`, "");
  }
  if (template.revisionNumber !== null) {
    lines.push(`**Revision:** v${template.revisionNumber}`);
  }
  if (template.status !== "draft") {
    lines.push(`**Status:** ${template.status}`);
  }
  lines.push("", "---", "");
  for (const pillar of template.pillars) {
    lines.push(...pillarToLines(pillar));
  }
  return lines.join("\n");
};

const flushImportance = (state: ParseState): void => {
  if (state.currentQuestion && state.importanceBuffer.length > 0) {
    state.currentQuestion.importance = state.importanceBuffer.join("\n").trim();
  }
  state.importanceBuffer = [];
};

const createParsedPillar = (name: string, order: number): TemplatePillar => ({
  id: createUuidV7(),
  templateRevisionId: "",
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  order,
  questions: [],
});

const createParsedQuestion = (
  match: RegExpMatchArray,
  order: number
): TemplateQuestion => {
  const riskLevelRaw = match[2]?.toLowerCase() ?? "medium";
  const riskLevel: RiskLevel = ["critical", "high", "medium"].includes(
    riskLevelRaw
  )
    ? (riskLevelRaw as RiskLevel)
    : "medium";
  return {
    id: createUuidV7(),
    order,
    type: "yes-no",
    text: "",
    riskLevel,
    importance: "",
    checklistItems: [],
    leadingPractices: [],
    helpfulLinks: [],
  };
};

const getSectionFromHeader = (trimmed: string): ParseSection | undefined => {
  if (
    trimmed === "**Why it's important:**" ||
    trimmed === "**Why it\\'s important:**"
  ) {
    return "importance";
  }
  if (trimmed === "**Checklist Items:**") return "checklist";
  if (trimmed === "**Leading Practices:**") return "practices";
  if (trimmed === "**Helpful Links:**") return "links";
  return undefined;
};

const appendChecklistItem = (
  trimmed: string,
  question: TemplateQuestion
): void => {
  if (!trimmed.startsWith("- ")) return;
  const order = (question.checklistItems?.length ?? 0) + 1;
  question.checklistItems?.push({
    id: createUuidV7(),
    order,
    text: trimmed.replace(/^- /, ""),
  });
};

const appendLeadingPractice = (
  trimmed: string,
  question: TemplateQuestion
): void => {
  if (!trimmed.startsWith("- ")) return;
  question.leadingPractices.push({
    id: createUuidV7(),
    order: question.leadingPractices.length + 1,
    text: trimmed.replace(/^- /, ""),
  });
};

const appendHelpfulLink = (
  trimmed: string,
  question: TemplateQuestion
): void => {
  const linkMatch = trimmed.match(/^- \[(.+?)\]\((<[^>]+>|.+?)\)$/);
  if (!linkMatch?.[1] || !linkMatch[2]) return;
  const order = question.helpfulLinks.length + 1;
  question.helpfulLinks.push({
    id: createUuidV7(),
    order,
    title: unescapeMarkdownInline(linkMatch[1]),
    url: parseMarkdownDestination(linkMatch[2]),
  });
};

const appendQuestionContent = (trimmed: string, state: ParseState): void => {
  const { currentSection: section, currentQuestion: question } = state;
  if (!question) return;
  if (section === "question" && trimmed) {
    question.text = question.text ? `${question.text} ${trimmed}` : trimmed;
  } else if (section === "importance" && trimmed) {
    state.importanceBuffer.push(trimmed);
  } else if (section === "checklist") {
    appendChecklistItem(trimmed, question);
  } else if (section === "practices") {
    appendLeadingPractice(trimmed, question);
  } else if (section === "links") {
    appendHelpfulLink(trimmed, question);
  }
};

const handleTemplateMeta = (trimmed: string, state: ParseState): boolean => {
  if (trimmed.startsWith("# Template:")) {
    state.template.name = trimmed.replace("# Template:", "").trim();
    return true;
  }
  if (trimmed.startsWith("> ")) {
    state.template.description = trimmed.replace("> ", "").trim();
    return true;
  }
  if (
    trimmed.startsWith("**Version:**") ||
    trimmed.startsWith("**Revision:**") ||
    trimmed.startsWith("**Status:**")
  ) {
    return true;
  }
  return false;
};

const handlePillarLine = (trimmed: string, state: ParseState): boolean => {
  if (!trimmed.startsWith("## Pillar:")) return false;
  flushImportance(state);
  const pillarName = trimmed.replace("## Pillar:", "").trim();
  state.currentPillar = createParsedPillar(
    pillarName,
    (state.template.pillars?.length ?? 0) + 1
  );
  state.template.pillars?.push(state.currentPillar);
  state.currentQuestion = null;
  state.currentSection = null;
  return true;
};

const handleQuestionLine = (trimmed: string, state: ParseState): boolean => {
  const match = trimmed.match(/^### Question (\d+) \[(\w+)\]$/);
  if (!match || !state.currentPillar) return false;
  flushImportance(state);
  const question = createParsedQuestion(match, Number(match[1]));
  state.currentPillar.questions.push(question);
  state.currentQuestion = question;
  state.currentSection = "question";
  return true;
};

const handleQuestionType = (trimmed: string, state: ParseState): boolean => {
  const match = trimmed.match(/^\*\*Type:\*\* (yes-no|checklist)$/);
  if (!match || !state.currentQuestion) return false;
  state.currentQuestion.type = match[1] as "yes-no" | "checklist";
  return true;
};

const handleSectionHeader = (trimmed: string, state: ParseState): boolean => {
  const newSection = getSectionFromHeader(trimmed);
  if (newSection === undefined) return false;
  flushImportance(state);
  state.currentSection = newSection;
  return true;
};

const handleSeparator = (trimmed: string, state: ParseState): boolean => {
  if (trimmed !== "---") return false;
  flushImportance(state);
  state.currentSection = null;
  return true;
};

export const parseTemplateMarkdown = (
  markdown: string
): Partial<TemplateRevisionDetail> | null => {
  const lines = markdown.split("\n");
  if (lines.some((line) => line.trim() === "## Rules")) {
    throw new UnsupportedTemplateRulesMarkdownError();
  }

  try {
    const state: ParseState = {
      template: {
        name: "Imported Template",
        status: "draft",
        description: "",
        pillars: [],
      },
      currentPillar: null,
      currentQuestion: null,
      currentSection: null,
      importanceBuffer: [],
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (handleTemplateMeta(trimmed, state)) continue;
      if (handleSeparator(trimmed, state)) continue;
      if (handlePillarLine(trimmed, state)) continue;
      if (handleQuestionLine(trimmed, state)) continue;
      if (handleQuestionType(trimmed, state)) continue;
      if (handleSectionHeader(trimmed, state)) continue;
      appendQuestionContent(trimmed, state);
    }

    flushImportance(state);
    return state.template;
  } catch (error) {
    console.error("Parse error:", error);
    return null;
  }
};
