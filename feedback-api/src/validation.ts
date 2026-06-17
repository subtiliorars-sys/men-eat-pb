import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SCHEMA_VERSION,
  FEEDBACK_STATUSES,
  REVIEW_DECISIONS,
  type FeedbackCategory,
  type FeedbackStatus,
  type FeedbackSubmission,
  type PlaytestRunSummary,
  type ReviewDecisionPayload,
  type ValidationResult,
} from "./schema";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTACT_LENGTH = 200;
const MAX_REVIEW_NOTE_LENGTH = 2000;

export function validateFeedbackSubmission(value: unknown): ValidationResult<FeedbackSubmission> {
  if (!isRecord(value)) return invalid("Feedback body must be a JSON object.");

  if (value.schemaVersion !== FEEDBACK_SCHEMA_VERSION) {
    return invalid(`Unsupported feedback schema version. Expected ${FEEDBACK_SCHEMA_VERSION}.`);
  }

  const category = value.category;
  if (!isFeedbackCategory(category)) return invalid("Feedback category is invalid.");

  const message = readTrimmedString(value.message);
  if (message.length < 8) return invalid("Feedback message must be at least 8 characters.");
  if (message.length > MAX_MESSAGE_LENGTH) return invalid(`Feedback message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);

  const contact = readOptionalTrimmedString(value.contact);
  if (contact && contact.length > MAX_CONTACT_LENGTH) {
    return invalid(`Contact must be ${MAX_CONTACT_LENGTH} characters or fewer.`);
  }

  if (typeof value.allowPublicReview !== "boolean") {
    return invalid("Public review consent must be true or false.");
  }

  const runSummary = validateRunSummary(value.runSummary);
  if (!runSummary.ok) return invalid(runSummary.error ?? "Run summary is invalid.");

  return {
    ok: true,
    value: {
      schemaVersion: FEEDBACK_SCHEMA_VERSION,
      submittedAt: readTrimmedString(value.submittedAt) || new Date().toISOString(),
      category,
      message,
      contact,
      allowPublicReview: value.allowPublicReview,
      runSummary: runSummary.value!,
      pageUrl: readTrimmedString(value.pageUrl),
      userAgent: readTrimmedString(value.userAgent),
    },
  };
}

export function validateReviewDecision(value: unknown): ValidationResult<ReviewDecisionPayload> {
  if (!isRecord(value)) return invalid("Review decision must be a JSON object.");
  if (!REVIEW_DECISIONS.includes(value.status as ReviewDecisionPayload["status"])) {
    return invalid("Review status must be approved, denied, or needs_info.");
  }

  const reviewer = readTrimmedString(value.reviewer);
  if (!reviewer) return invalid("Reviewer is required.");

  const reviewNote = readTrimmedString(value.reviewNote);
  if (reviewNote.length > MAX_REVIEW_NOTE_LENGTH) {
    return invalid(`Review note must be ${MAX_REVIEW_NOTE_LENGTH} characters or fewer.`);
  }

  return {
    ok: true,
    value: {
      status: value.status as ReviewDecisionPayload["status"],
      reviewer,
      reviewNote,
    },
  };
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return FEEDBACK_STATUSES.includes(value as FeedbackStatus);
}

function validateRunSummary(value: unknown): ValidationResult<PlaytestRunSummary> {
  if (!isRecord(value)) return invalid("Run summary must be present.");
  if (value.ended !== "jar_empty" && value.ended !== "stuck_shut") return invalid("Run ending is invalid.");

  const summary: PlaytestRunSummary = {
    buildVersion: readTrimmedString(value.buildVersion),
    modifier: readTrimmedString(value.modifier),
    modifierId: readTrimmedString(value.modifierId),
    ended: value.ended,
    spoons: readFiniteNumber(value.spoons),
    crustCredits: readFiniteNumber(value.crustCredits),
    jarPercent: readFiniteNumber(value.jarPercent),
    frenzyActive: Boolean(value.frenzyActive),
    chain: readFiniteNumber(value.chain),
  };

  if (!summary.buildVersion || !summary.modifier || !summary.modifierId) {
    return invalid("Run summary is missing build or modifier details.");
  }

  return { ok: true, value: summary };
}

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return FEEDBACK_CATEGORIES.includes(value as FeedbackCategory);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalTrimmedString(value: unknown): string | undefined {
  const trimmed = readTrimmedString(value);
  return trimmed || undefined;
}

function readFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function invalid<T>(error: string): ValidationResult<T> {
  return { ok: false, error };
}
