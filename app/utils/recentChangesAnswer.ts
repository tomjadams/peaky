const ANSWER_STYLE: Record<string, { label: string; textClass: string }> = {
  yes: { label: "Yes", textClass: "text-success" },
  no: { label: "No", textClass: "text-error" },
  na: { label: "N/A", textClass: "text-muted" },
};

export function answerStyle(answer: string | null) {
  return (
    (answer ? ANSWER_STYLE[answer] : null) ?? {
      label: answer ?? "–",
      textClass: "text-muted",
    }
  );
}

export function answerLabel(answer: string | null, nullLabel = "–"): string {
  return answer === null ? nullLabel : answerStyle(answer).label;
}
