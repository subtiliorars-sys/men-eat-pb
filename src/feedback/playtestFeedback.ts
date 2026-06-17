import { crustCredits, jarPercent } from "../sim/engine.js";
import { modifierDef } from "../sim/modifiers.js";
import type { RunEndReason, RunState } from "../sim/types.js";

export const DEFAULT_FEEDBACK_LABELS = ["playtest", "pending-review"];
export const GAME_VERSION = "0.1.0";
export const FEEDBACK_SCHEMA_VERSION = 1;

export type FeedbackCategory = "bug" | "balance" | "feel" | "accessibility" | "other";
export type FeedbackStatus = "pending" | "approved" | "denied" | "needs_info";

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = ["bug", "balance", "feel", "accessibility", "other"];

export interface PlaytestRunSummary {
  buildVersion: string;
  modifier: string;
  modifierId: string;
  ended: Exclude<RunEndReason, null>;
  spoons: number;
  crustCredits: number;
  jarPercent: number;
  frenzyActive: boolean;
  chain: number;
}

export interface FeedbackUrlOptions {
  baseUrl?: string;
  labels?: string[];
  draft?: PlaytestFeedbackDraft;
}

export interface PlaytestFeedbackDraft {
  category: FeedbackCategory;
  message: string;
  contact?: string;
  allowPublicReview: boolean;
}

export interface PlaytestFeedbackPayload extends PlaytestFeedbackDraft {
  schemaVersion: number;
  submittedAt: string;
  runSummary: PlaytestRunSummary;
  pageUrl: string;
  userAgent: string;
}

export interface FeedbackSubmissionResult {
  ok: boolean;
  id?: string;
  reviewUrl?: string;
  error?: string;
}

export interface SubmitFeedbackOptions {
  apiUrl?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  pageUrl?: string;
  userAgent?: string;
}

interface ImportMetaEnv {
  VITE_PLAYTEST_FEEDBACK_API_URL?: string;
  VITE_PLAYTEST_FEEDBACK_URL?: string;
}

const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;

export const PLAYTEST_FEEDBACK_API_URL = env?.VITE_PLAYTEST_FEEDBACK_API_URL ?? "";
export const PLAYTEST_FEEDBACK_URL = env?.VITE_PLAYTEST_FEEDBACK_URL ?? "";

export function createPlaytestRunSummary(state: RunState, buildVersion = GAME_VERSION): PlaytestRunSummary {
  if (!state.ended) {
    throw new Error("Cannot create playtest feedback for a run that has not ended.");
  }

  return {
    buildVersion,
    modifier: modifierDef(state.modifier).label,
    modifierId: state.modifier,
    ended: state.ended,
    spoons: Math.floor(state.spoons),
    crustCredits: crustCredits(state),
    jarPercent: Math.ceil(jarPercent(state)),
    frenzyActive: state.frenzy,
    chain: state.chain,
  };
}

export function createPlaytestIssueTitle(summary: PlaytestRunSummary): string {
  const result = summary.ended === "jar_empty" ? "Jar empty" : "Stuck shut";
  return `[Playtest] ${result} with ${summary.modifier}`;
}

export function formatPlaytestIssueBody(summary: PlaytestRunSummary, draft?: PlaytestFeedbackDraft): string {
  const playerLines = draft
    ? [
        `Category: ${draft.category}`,
        "",
        draft.message.trim(),
        "",
        `Contact: ${draft.contact?.trim() || "not provided"}`,
        `Public review OK: ${draft.allowPublicReview ? "yes" : "no"}`,
      ]
    : ["<!-- Tell us what felt fun, confusing, unfair, too easy, too hard, broken, or worth keeping. -->"];

  return [
    "## What happened?",
    "",
    ...playerLines,
    "",
    "## Run summary",
    "",
    `- Build: ${summary.buildVersion}`,
    `- Modifier: ${summary.modifier} (${summary.modifierId})`,
    `- Ending: ${summary.ended}`,
    `- Spoons: ${summary.spoons}`,
    `- Crust Credits: ${summary.crustCredits}`,
    `- Jar Remaining: ${summary.jarPercent}%`,
    `- Frenzy Active: ${summary.frenzyActive ? "yes" : "no"}`,
    `- Chain: ${summary.chain}`,
    "",
    "## Volunteer review",
    "",
    "- [ ] Pending community review",
    "- [ ] Approved for the backlog",
    "- [ ] Denied / closed with reason",
  ].join("\n");
}

export function createPlaytestFeedbackUrl(summary: PlaytestRunSummary, options: FeedbackUrlOptions = {}): string {
  const baseUrl = options.baseUrl?.trim() || PLAYTEST_FEEDBACK_URL.trim();
  const labels = options.labels ?? DEFAULT_FEEDBACK_LABELS;
  const title = createPlaytestIssueTitle(summary);
  const body = formatPlaytestIssueBody(summary, options.draft);

  if (!baseUrl) {
    return createMailtoFeedbackUrl(title, body);
  }

  const url = new URL(baseUrl);
  const isGitLabIssueUrl = url.pathname.includes("/-/issues/new");
  if (isGitLabIssueUrl) {
    url.searchParams.set("issue[title]", title);
    url.searchParams.set("issue[description]", body);
    url.searchParams.set("issue[labels]", labels.join(","));
    return url.toString();
  }

  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  url.searchParams.set("labels", labels.join(","));
  return url.toString();
}

export function createPlaytestFeedbackPayload(
  summary: PlaytestRunSummary,
  draft: PlaytestFeedbackDraft,
  options: SubmitFeedbackOptions = {},
): PlaytestFeedbackPayload {
  return {
    schemaVersion: FEEDBACK_SCHEMA_VERSION,
    submittedAt: (options.now ?? (() => new Date()))().toISOString(),
    category: draft.category,
    message: draft.message.trim(),
    contact: draft.contact?.trim() || undefined,
    allowPublicReview: draft.allowPublicReview,
    runSummary: summary,
    pageUrl: options.pageUrl ?? globalThis.location?.href ?? "",
    userAgent: options.userAgent ?? globalThis.navigator?.userAgent ?? "",
  };
}

export async function submitPlaytestFeedback(
  summary: PlaytestRunSummary,
  draft: PlaytestFeedbackDraft,
  options: SubmitFeedbackOptions = {},
): Promise<FeedbackSubmissionResult> {
  const apiUrl = options.apiUrl?.trim() || PLAYTEST_FEEDBACK_API_URL.trim();
  if (!apiUrl) {
    return { ok: false, error: "Feedback API is not configured." };
  }

  const fetcher = options.fetcher ?? fetch;
  const payload = createPlaytestFeedbackPayload(summary, draft, options);

  try {
    const response = await fetcher(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readOptionalJson(response);

    if (!response.ok) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : `Feedback API returned ${response.status}.`,
      };
    }

    return {
      ok: true,
      id: typeof data?.id === "string" ? data.id : undefined,
      reviewUrl: typeof data?.reviewUrl === "string" ? data.reviewUrl : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Feedback submission failed.",
    };
  }
}

async function readOptionalJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createMailtoFeedbackUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    subject: title,
    body,
  });
  return `mailto:?${params.toString()}`;
}
