/**
 * Type augmentation for test-only window globals exposed by the test-seed
 * plugin and sync client. These exist only when `testHelpersEnabled` is true
 * (local dev + Vercel preview, never in production).
 */

export interface PeakyDBDebug {
  isOpen: () => boolean;
  getDB: () => Promise<unknown>;
  getSQLocal: () => Promise<unknown>;
  dumpTable: (
    name: string,
    limit?: number
  ) => Promise<{ rows: unknown[][] } | unknown[]>;
  getTables: () => Promise<{ name: string }[]>;
  stats: () => Promise<Record<string, number>>;
  migrationLog: () => Promise<unknown[]>;
  clearLocalData: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestBridgeFn = (...args: any[]) => unknown;

export interface PeakySeed {
  ensureDirectoryGroups: TestBridgeFn;
  grantTemplateEdit: TestBridgeFn;
  createTemplateDraft: TestBridgeFn;
  addPillar: TestBridgeFn;
  addQuestion: TestBridgeFn;
  updateQuestion: TestBridgeFn;
  freezeTemplateFixture: TestBridgeFn;
  createProduct: TestBridgeFn;
  createReview: TestBridgeFn;
  saveAnswer: TestBridgeFn;
  createTeam: TestBridgeFn;
  syncNow: () => Promise<unknown>;
}

declare global {
  interface Window {
    __peakySeed?: PeakySeed;
    peakyDB?: PeakyDBDebug;
    /** Set by the test-seed plugin via onNuxtReady after app hydration. */
    peakySyncReady?: boolean;
  }
}
