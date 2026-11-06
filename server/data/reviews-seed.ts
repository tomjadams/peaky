import type { Pillar, ReviewParticipant } from "../../app/models";

export const participants: Record<string, ReviewParticipant> = {
  heitorl: {
    id: "heitorl",
    name: "Heitor Lessa",
    email: "heitor.lessa@adyen.com",
  },
  vlads: {
    id: "vlads",
    name: "Vlad Skuba",
    email: "vlad.skuba@adyen.com",
  },
  vladk: {
    id: "vladk",
    name: "Vlad Kostiuk",
    email: "vlad.kostiuk@adyen.com",
  },
  heitor: {
    id: "heitor",
    name: "Heitor Bernardino",
    email: "heitor.bernardino@adyen.com",
  },
  helen: {
    id: "helen",
    name: "Helen Huyton",
    email: "helen.huyton@adyen.com",
  },
  "advisor-001": {
    id: "advisor-001",
    name: "Elena Kowalski",
    email: "elena.k@example.com",
  },
  "advisor-002": {
    id: "advisor-002",
    name: "David Okonkwo",
    email: "david.o@example.com",
  },
  "advisor-003": {
    id: "advisor-003",
    name: "Lisa Thompson",
    email: "lisa.t@example.com",
  },
  "advisor-004": {
    id: "advisor-004",
    name: "Raj Sharma",
    email: "raj.sharma@example.com",
  },
};

export const orrProgressPillars: Pillar[] = [
  {
    slug: "reliability-resilience",
    name: "Reliability & Resilience",
    progress: 100,
    totalQuestions: 3,
    answeredQuestions: 3,
  },
  {
    slug: "observability-response",
    name: "Observability & Response",
    progress: 67,
    totalQuestions: 3,
    answeredQuestions: 2,
  },
  {
    slug: "change-release-safety",
    name: "Change & Release Safety",
    progress: 50,
    totalQuestions: 2,
    answeredQuestions: 1,
  },
  {
    slug: "operational-ownership",
    name: "Operational Ownership",
    progress: 0,
    totalQuestions: 2,
    answeredQuestions: 0,
  },
];

export const pciProgressPillars: Pillar[] = [
  {
    slug: "security",
    name: "Security",
    progress: 50,
    totalQuestions: 2,
    answeredQuestions: 1,
  },
  {
    slug: "infrastructure",
    name: "Infrastructure",
    progress: 100,
    totalQuestions: 1,
    answeredQuestions: 1,
  },
  {
    slug: "operations",
    name: "Operations",
    progress: 0,
    totalQuestions: 1,
    answeredQuestions: 0,
  },
];

export const pciDraftPillars: Pillar[] = [
  {
    slug: "security",
    name: "Security",
    progress: 0,
    totalQuestions: 2,
    answeredQuestions: 0,
  },
  {
    slug: "infrastructure",
    name: "Infrastructure",
    progress: 0,
    totalQuestions: 1,
    answeredQuestions: 0,
  },
  {
    slug: "operations",
    name: "Operations",
    progress: 0,
    totalQuestions: 1,
    answeredQuestions: 0,
  },
];

export const reliabilityDrillPillars: Pillar[] = [
  {
    slug: "reliability-resilience",
    name: "Reliability & Resilience",
    progress: 67,
    totalQuestions: 3,
    answeredQuestions: 2,
  },
  {
    slug: "observability-response",
    name: "Observability & Response",
    progress: 33,
    totalQuestions: 3,
    answeredQuestions: 1,
  },
  {
    slug: "change-release-safety",
    name: "Change & Release Safety",
    progress: 0,
    totalQuestions: 2,
    answeredQuestions: 0,
  },
  {
    slug: "operational-ownership",
    name: "Operational Ownership",
    progress: 0,
    totalQuestions: 2,
    answeredQuestions: 0,
  },
];

export const reportingBaselinePillars: Pillar[] = [
  {
    slug: "security",
    name: "Security",
    progress: 20,
    totalQuestions: 5,
    answeredQuestions: 1,
  },
  {
    slug: "operations",
    name: "Operations",
    progress: 0,
    totalQuestions: 5,
    answeredQuestions: 0,
  },
];
