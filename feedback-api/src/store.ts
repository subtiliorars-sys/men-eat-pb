import type {
  FeedbackRecord,
  FeedbackStatus,
  FeedbackSubmission,
  ReviewDecisionPayload,
} from "./schema";

export interface FeedbackStore {
  create(submission: FeedbackSubmission, now: Date): Promise<FeedbackRecord>;
  list(status: FeedbackStatus, limit: number): Promise<FeedbackRecord[]>;
  review(id: string, decision: ReviewDecisionPayload, now: Date): Promise<FeedbackRecord | null>;
}

export class D1FeedbackStore implements FeedbackStore {
  constructor(private readonly db: D1Database) {}

  async create(submission: FeedbackSubmission, now: Date): Promise<FeedbackRecord> {
    const record: FeedbackRecord = {
      ...submission,
      id: `fb_${crypto.randomUUID()}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: "pending",
    };

    await this.db
      .prepare(
        `INSERT INTO feedback_submissions (
          id,
          created_at,
          updated_at,
          status,
          category,
          message,
          contact,
          allow_public_review,
          run_summary_json,
          page_url,
          user_agent,
          schema_version,
          submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.createdAt,
        record.updatedAt,
        record.status,
        record.category,
        record.message,
        record.contact ?? null,
        record.allowPublicReview ? 1 : 0,
        JSON.stringify(record.runSummary),
        record.pageUrl,
        record.userAgent,
        record.schemaVersion,
        record.submittedAt,
      )
      .run();

    return record;
  }

  async list(status: FeedbackStatus, limit: number): Promise<FeedbackRecord[]> {
    const result = await this.db
      .prepare(
        `SELECT
          id,
          created_at,
          updated_at,
          status,
          category,
          message,
          contact,
          allow_public_review,
          run_summary_json,
          page_url,
          user_agent,
          schema_version,
          submitted_at,
          reviewer,
          review_note
        FROM feedback_submissions
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      )
      .bind(status, limit)
      .all<D1FeedbackRow>();

    return result.results.map(rowToRecord);
  }

  async review(id: string, decision: ReviewDecisionPayload, now: Date): Promise<FeedbackRecord | null> {
    const updatedAt = now.toISOString();
    await this.db
      .prepare(
        `UPDATE feedback_submissions
        SET status = ?, reviewer = ?, review_note = ?, updated_at = ?
        WHERE id = ?`,
      )
      .bind(decision.status, decision.reviewer, decision.reviewNote, updatedAt, id)
      .run();

    const result = await this.db
      .prepare(
        `SELECT
          id,
          created_at,
          updated_at,
          status,
          category,
          message,
          contact,
          allow_public_review,
          run_summary_json,
          page_url,
          user_agent,
          schema_version,
          submitted_at,
          reviewer,
          review_note
        FROM feedback_submissions
        WHERE id = ?`,
      )
      .bind(id)
      .first<D1FeedbackRow>();

    return result ? rowToRecord(result) : null;
  }
}

export class MemoryFeedbackStore implements FeedbackStore {
  private readonly records = new Map<string, FeedbackRecord>();

  async create(submission: FeedbackSubmission, now: Date): Promise<FeedbackRecord> {
    const record: FeedbackRecord = {
      ...submission,
      id: `fb_${this.records.size + 1}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: "pending",
    };
    this.records.set(record.id, record);
    return record;
  }

  async list(status: FeedbackStatus, limit: number): Promise<FeedbackRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async review(id: string, decision: ReviewDecisionPayload, now: Date): Promise<FeedbackRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;

    const updated: FeedbackRecord = {
      ...record,
      status: decision.status,
      reviewer: decision.reviewer,
      reviewNote: decision.reviewNote,
      updatedAt: now.toISOString(),
    };
    this.records.set(id, updated);
    return updated;
  }
}

interface D1FeedbackRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: FeedbackStatus;
  category: FeedbackRecord["category"];
  message: string;
  contact: string | null;
  allow_public_review: number;
  run_summary_json: string;
  page_url: string;
  user_agent: string;
  schema_version: number;
  submitted_at: string;
  reviewer: string | null;
  review_note: string | null;
}

function rowToRecord(row: D1FeedbackRow): FeedbackRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    category: row.category,
    message: row.message,
    contact: row.contact ?? undefined,
    allowPublicReview: Boolean(row.allow_public_review),
    runSummary: JSON.parse(row.run_summary_json) as FeedbackRecord["runSummary"],
    pageUrl: row.page_url,
    userAgent: row.user_agent,
    schemaVersion: row.schema_version,
    submittedAt: row.submitted_at,
    reviewer: row.reviewer ?? undefined,
    reviewNote: row.review_note ?? undefined,
  };
}
