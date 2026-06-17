export const FEEDBACK_SCHEMA_VERSION = 1;

export const FEEDBACK_CATEGORIES = ["bug", "balance", "feel", "accessibility", "other"] as const;
export const FEEDBACK_STATUSES = ["pending", "approved", "denied", "needs_info"] as const;
export const REVIEW_DECISIONS = ["approved", "denied", "needs_info"] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface PlaytestRunSummary {
  buildVersion: string;
  modifier: string;
  modifierId: string;
  ended: "jar_empty" | "stuck_shut";
  spoons: number;
  crustCredits: number;
  jarPercent: number;
  frenzyActive: boolean;
  chain: number;
}

export interface FeedbackSubmission {
  schemaVersion: number;
  submittedAt: string;
  category: FeedbackCategory;
  message: string;
  contact?: string;
  allowPublicReview: boolean;
  runSummary: PlaytestRunSummary;
  pageUrl: string;
  userAgent: string;
}

export interface FeedbackRecord extends FeedbackSubmission {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: FeedbackStatus;
  reviewer?: string;
  reviewNote?: string;
}

export interface ReviewDecisionPayload {
  status: ReviewDecision;
  reviewer: string;
  reviewNote: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}
