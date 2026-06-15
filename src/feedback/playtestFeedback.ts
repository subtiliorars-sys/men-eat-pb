import { crustCredits, jarPercent } from "../sim/engine.js";
import { modifierDef } from "../sim/modifiers.js";
import type { RunEndReason, RunState } from "../sim/types.js";

export const DEFAULT_FEEDBACK_LABELS = ["playtest", "pending-review"];
export const GAME_VERSION = "0.1.0";

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
}

interface ImportMetaEnv {
  VITE_PLAYTEST_FEEDBACK_URL?: string;
}

const env = (import.meta as ImportMeta & { env?: ImportMetaEnv }).env;

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

export function formatPlaytestIssueBody(summary: PlaytestRunSummary): string {
  return [
    "## What happened?",
    "",
    "<!-- Tell us what felt fun, confusing, unfair, too easy, too hard, broken, or worth keeping. -->",
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
  const body = formatPlaytestIssueBody(summary);

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

function createMailtoFeedbackUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    subject: title,
    body,
  });
  return `mailto:?${params.toString()}`;
}
