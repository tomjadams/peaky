import { computed, nextTick, onBeforeUnmount, ref, toValue, watch } from "vue";
import type { MaybeRef, Ref } from "vue";
import type {
  LocationQuery,
  LocationQueryRaw,
  LocationQueryValue,
} from "vue-router";
import type { Question, Review } from "~/models";

interface PillarProgress {
  readonly slug: string;
  readonly answeredQuestions: number;
  readonly totalQuestions: number;
}

interface AssessmentHashTarget {
  readonly questionId?: string;
  readonly pillarSlug?: string;
}

type RequestedRevision =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "valid"; readonly id: string };

interface NavigationTarget {
  readonly revisionId: string;
  readonly question?: Question;
  readonly pillarSlug?: string;
  readonly requestedRevision: RequestedRevision;
  readonly hashTarget: AssessmentHashTarget;
}

interface AssessmentRouteReplacement {
  readonly query: LocationQueryRaw;
  readonly hash: string;
}

interface UseAssessmentRouteTargetOptions {
  readonly route: {
    readonly hash: string;
    readonly query: LocationQuery;
  };
  readonly reviewId: MaybeRef<string>;
  readonly review: Readonly<Ref<Review | null | undefined>>;
  readonly questions: Readonly<Ref<readonly Question[]>>;
  readonly pillarProgress: Readonly<Ref<readonly PillarProgress[]>>;
  readonly currentPillar: Readonly<Ref<{ slug: string } | null | undefined>>;
  readonly activeTemplateRevisionId: Readonly<Ref<string | null>>;
  readonly setActiveTemplateRevision: (revisionId: string | null) => void;
  readonly setActivePillar: (pillarSlug: string | null) => void;
  readonly goToPillarBySlug: (pillarSlug: string) => void;
  readonly replaceRoute: (
    replacement: AssessmentRouteReplacement
  ) => Promise<unknown> | unknown;
}

function parseAssessmentHash(hash: string): AssessmentHashTarget {
  let decoded: string;
  try {
    decoded = decodeURIComponent(hash);
  } catch {
    return {};
  }
  if (decoded.startsWith("#question-")) {
    return { questionId: decoded.slice("#question-".length) };
  }
  if (decoded.startsWith("#pillar-")) {
    return { pillarSlug: decoded.slice("#pillar-".length) };
  }
  return {};
}

function requestedRevision(
  queryValue: LocationQueryValue | LocationQueryValue[] | undefined,
  review: Review | null | undefined
): RequestedRevision {
  if (queryValue === undefined) return { kind: "absent" };
  if (typeof queryValue !== "string" || queryValue.length === 0) {
    return { kind: "invalid" };
  }
  const selected = review?.templates.some(
    (template) => template.templateRevisionId === queryValue
  );
  return selected ? { kind: "valid", id: queryValue } : { kind: "invalid" };
}

interface RevisionQuestionTarget {
  readonly question: Question;
  readonly revisionId: string;
}

function uniqueQuestionTarget(
  review: Review,
  questions: readonly Question[],
  questionId: string
): RevisionQuestionTarget | undefined {
  const pinnedRevisionIds = new Set(
    review.templates.map((template) => template.templateRevisionId)
  );
  const matches = questions.flatMap((question) => {
    const revisionId = question.templateRevisionId;
    return question.id === questionId &&
      revisionId !== undefined &&
      pinnedRevisionIds.has(revisionId)
      ? [{ question, revisionId }]
      : [];
  });
  return matches.length === 1 ? matches[0] : undefined;
}

function firstPillarForRevision(
  review: Review,
  revisionId: string
): string | undefined {
  const template = review.templates.find(
    (candidate) => candidate.templateRevisionId === revisionId
  );
  return (
    template?.pillars.find((pillar) => pillar.progress < 100)?.slug ??
    template?.pillars[0]?.slug
  );
}

function revisionHasPillar(
  review: Review,
  revisionId: string,
  pillarSlug: string
): boolean {
  return Boolean(
    review.templates
      .find((candidate) => candidate.templateRevisionId === revisionId)
      ?.pillars.some((pillar) => pillar.slug === pillarSlug)
  );
}

function resolveNavigationTarget(input: {
  readonly review: Review;
  readonly questions: readonly Question[];
  readonly activeTemplateRevisionId: string | null;
  readonly requestedRevision: RequestedRevision;
  readonly hashTarget: AssessmentHashTarget;
}): NavigationTarget | null {
  if (input.requestedRevision.kind === "invalid") return null;

  const activeRevisionIsPinned = input.review.templates.some(
    (template) => template.templateRevisionId === input.activeTemplateRevisionId
  );
  let revisionId =
    input.requestedRevision.kind === "valid"
      ? input.requestedRevision.id
      : activeRevisionIsPinned
        ? input.activeTemplateRevisionId
        : input.review.templates[0]?.templateRevisionId;
  if (!revisionId) return null;

  let question: Question | undefined;
  let acceptedHashTarget = input.hashTarget;

  if (input.hashTarget.questionId) {
    const questionTarget = uniqueQuestionTarget(
      input.review,
      input.questions,
      input.hashTarget.questionId
    );
    const questionBelongsToKnownPillar =
      questionTarget &&
      revisionHasPillar(
        input.review,
        questionTarget.revisionId,
        questionTarget.question.pillar
      );

    if (questionTarget && questionBelongsToKnownPillar) {
      question = questionTarget.question;
      revisionId = questionTarget.revisionId;
    } else if (input.requestedRevision.kind === "valid") {
      // The explicit Revision remains valid, but an unresolved Question hash
      // must not move focus or infer another Revision. Keeping the hash intact
      // lets a later Question load retry the exact target.
      acceptedHashTarget = {};
    } else {
      return null;
    }
  } else if (
    input.hashTarget.pillarSlug &&
    !revisionHasPillar(input.review, revisionId, input.hashTarget.pillarSlug)
  ) {
    if (input.requestedRevision.kind !== "valid") return null;
    acceptedHashTarget = {};
  }

  return {
    revisionId,
    question,
    pillarSlug:
      question?.pillar ??
      acceptedHashTarget.pillarSlug ??
      firstPillarForRevision(input.review, revisionId),
    requestedRevision: input.requestedRevision,
    hashTarget: acceptedHashTarget,
  };
}

/**
 * Consumes revision-scoped assessment links before resolving their Pillar or
 * Question target. The target receives DOM focus after the selected Revision
 * has rendered; invalid or ambiguous identities do nothing.
 */
export function useAssessmentRouteTarget(
  options: UseAssessmentRouteTargetOptions
) {
  const { route } = options;
  const highlightedQuestionId = ref<string | null>(null);
  let highlightTimer: number | undefined;
  let navigationSequence = 0;
  let hasResumedAssessment = false;

  const requested = computed(() =>
    requestedRevision(route.query.templateRevisionId, options.review.value)
  );

  const highlightQuestion = (questionId: string) => {
    const target = document.getElementById(`question-${questionId}`);
    if (!target) return;

    target.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
    highlightedQuestionId.value = questionId;
    if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
      highlightedQuestionId.value = null;
    }, 3000);
  };

  const replaceRevisionQuery = async (revisionId: string, hash: string) => {
    if (route.query.templateRevisionId === revisionId && route.hash === hash) {
      return;
    }
    await options.replaceRoute({
      query: { ...route.query, templateRevisionId: revisionId },
      hash,
    });
  };

  const resumeAssessment = () => {
    if (
      hasResumedAssessment ||
      route.hash ||
      options.questions.value.length === 0
    ) {
      return;
    }
    hasResumedAssessment = true;
    const pillar = options.pillarProgress.value.find(
      (entry) => entry.answeredQuestions < entry.totalQuestions
    );
    if (!pillar) return;
    options.goToPillarBySlug(pillar.slug);
    options.setActivePillar(pillar.slug);
  };

  const selectTemplateRevision = async (revisionId: string) => {
    const sequence = ++navigationSequence;
    const review = options.review.value;
    const template = review?.templates.find(
      (candidate) => candidate.templateRevisionId === revisionId
    );
    if (!template) return;

    const pillarSlug =
      template.pillars.find((pillar) => pillar.progress < 100)?.slug ??
      template.pillars[0]?.slug;
    highlightedQuestionId.value = null;
    options.setActiveTemplateRevision(revisionId);
    options.setActivePillar(pillarSlug ?? null);
    await nextTick();
    if (sequence !== navigationSequence) return;

    if (pillarSlug) options.goToPillarBySlug(pillarSlug);
    await replaceRevisionQuery(revisionId, "");
  };

  const navigateToRouteTarget = async () => {
    const sequence = ++navigationSequence;
    const review = options.review.value;
    if (!review) return;

    const target = resolveNavigationTarget({
      review,
      questions: options.questions.value,
      activeTemplateRevisionId: options.activeTemplateRevisionId.value,
      requestedRevision: requested.value,
      hashTarget: parseAssessmentHash(route.hash),
    });
    if (!target) return;

    if (target.revisionId !== options.activeTemplateRevisionId.value) {
      options.setActiveTemplateRevision(target.revisionId);
    }
    await nextTick();
    if (sequence !== navigationSequence) return;

    if (
      target.question &&
      route.query.templateRevisionId !== target.revisionId
    ) {
      await replaceRevisionQuery(target.revisionId, route.hash);
      if (sequence !== navigationSequence) return;
    }

    if (
      target.pillarSlug &&
      options.currentPillar.value?.slug !== target.pillarSlug
    ) {
      options.setActivePillar(target.pillarSlug);
      options.goToPillarBySlug(target.pillarSlug);
    }
    await nextTick();
    await nextTick();
    if (sequence !== navigationSequence) return;

    if (target.question) {
      highlightQuestion(target.question.id);
      return;
    }
    if (target.hashTarget.pillarSlug) {
      document
        .getElementById(`pillar-${target.hashTarget.pillarSlug}`)
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      return;
    }
    if (target.requestedRevision.kind === "absent") resumeAssessment();
  };

  watch(
    () => toValue(options.reviewId),
    () => {
      navigationSequence += 1;
      hasResumedAssessment = false;
    }
  );

  watch(
    [
      () => route.query.templateRevisionId,
      () => route.hash,
      () =>
        options.review.value?.templates
          .map(
            (template) =>
              `${template.templateRevisionId}:${template.pillars
                .map((pillar) => pillar.slug)
                .join(",")}`
          )
          .join("|") ?? "",
      () =>
        options.questions.value
          .map(
            (question) =>
              `${question.templateRevisionId ?? ""}:${question.id}:${question.pillar}`
          )
          .join("|"),
    ],
    () => void navigateToRouteTarget(),
    { immediate: true, flush: "post" }
  );

  onBeforeUnmount(() => {
    if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
  });

  return { highlightedQuestionId, selectTemplateRevision };
}
