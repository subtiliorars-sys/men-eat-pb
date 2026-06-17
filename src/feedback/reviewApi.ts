import type { FeedbackCategory, FeedbackStatus, PlaytestRunSummary } from "./playtestFeedback.js";

export type ReviewDecision = "approved" | "denied" | "needs_info";

export interface VolunteerFeedbackItem {
  id: string;
  createdAt: string;
  status: FeedbackStatus;
  category: FeedbackCategory;
  message: string;
  contact?: string;
  allowPublicReview: boolean;
  runSummary: PlaytestRunSummary;
  reviewer?: string;
  reviewNote?: string;
}

export interface ReviewQueueResponse {
  items: VolunteerFeedbackItem[];
}

export interface ReviewDecisionPayload {
  status: ReviewDecision;
  reviewer: string;
  reviewNote: string;
}

export interface ReviewApiConfig {
  apiUrl: string;
  token?: string;
  fetcher?: typeof fetch;
}

interface ImportMetaEnv {
  VITE_PLAYTEST_ADMIN_API_URL?: string;
  VITE_PLAYTEST_FEEDBACK_API_URL?: string;
}

const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;

export const PLAYTEST_ADMIN_API_URL =
  env?.VITE_PLAYTEST_ADMIN_API_URL ?? inferApiRoot(env?.VITE_PLAYTEST_FEEDBACK_API_URL ?? "");

export async function fetchReviewQueue(
  status: FeedbackStatus,
  config: ReviewApiConfig,
): Promise<VolunteerFeedbackItem[]> {
  const url = createReviewQueueUrl(status, config.apiUrl);
  const response = await (config.fetcher ?? fetch)(url, {
    headers: createAuthHeaders(config.token),
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readApiError(data, `Review API returned ${response.status}.`));
  }

  return Array.isArray(data.items) ? (data.items as VolunteerFeedbackItem[]) : [];
}

export async function submitReviewDecision(
  id: string,
  payload: ReviewDecisionPayload,
  config: ReviewApiConfig,
): Promise<void> {
  const response = await (config.fetcher ?? fetch)(`${trimTrailingSlash(config.apiUrl)}/feedback/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      ...createAuthHeaders(config.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(readApiError(data, `Review API returned ${response.status}.`));
  }
}

export function createReviewQueueUrl(status: FeedbackStatus, apiUrl: string): string {
  const url = new URL(`${trimTrailingSlash(apiUrl)}/feedback`);
  url.searchParams.set("status", status);
  return url.toString();
}

function createAuthHeaders(token: string | undefined): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readApiError(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === "string" ? data.error : fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function inferApiRoot(value: string): string {
  return trimTrailingSlash(value).replace(/\/feedback$/, "");
}
