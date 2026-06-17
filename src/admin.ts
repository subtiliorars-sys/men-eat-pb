import {
  fetchReviewQueue,
  PLAYTEST_ADMIN_API_URL,
  submitReviewDecision,
  type ReviewDecision,
  type VolunteerFeedbackItem,
} from "./feedback/reviewApi.js";
import type { FeedbackStatus, PlaytestRunSummary } from "./feedback/playtestFeedback.js";

const TOKEN_KEY = "men-eat-pb-review-token";
const REVIEWER_KEY = "men-eat-pb-reviewer";
const REVIEWABLE_STATUSES: FeedbackStatus[] = ["pending", "needs_info", "approved", "denied"];

const rootElement = document.querySelector("#feedback-admin") as HTMLElement | null;
if (!rootElement) throw new Error("Missing #feedback-admin root.");
const root: HTMLElement = rootElement;

interface AdminState {
  apiUrl: string;
  token: string;
  reviewer: string;
  status: FeedbackStatus;
  items: VolunteerFeedbackItem[];
  loading: boolean;
  message: string;
}

const state: AdminState = {
  apiUrl: PLAYTEST_ADMIN_API_URL,
  token: sessionStorage.getItem(TOKEN_KEY) ?? "",
  reviewer: sessionStorage.getItem(REVIEWER_KEY) ?? "",
  status: "pending",
  items: [],
  loading: false,
  message: "",
};

render();

function render(): void {
  root.innerHTML = `
    <section style="max-width: 1120px; margin: 0 auto; padding: 24px;">
      <header style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-bottom: 18px;">
        <div>
          <h1 style="margin: 0 0 6px;">Playtest feedback review</h1>
          <p style="margin: 0; color: #6b5344;">Approve, deny, or request info from community submissions.</p>
        </div>
        <button data-refresh style="${primaryButtonStyle()}">${state.loading ? "Loading..." : "Refresh queue"}</button>
      </header>

      <form data-settings style="${cardStyle()}; display: grid; gap: 12px; margin-bottom: 16px;">
        <label style="${fieldStyle()}">
          Feedback API URL
          <input name="apiUrl" value="${escapeHtml(state.apiUrl)}" placeholder="https://example.com/api" style="${inputStyle()}" />
        </label>
        <label style="${fieldStyle()}">
          Moderator token
          <input name="token" value="${escapeHtml(state.token)}" type="password" autocomplete="off" style="${inputStyle()}" />
        </label>
        <label style="${fieldStyle()}">
          Reviewer name
          <input name="reviewer" value="${escapeHtml(state.reviewer)}" placeholder="Your display name" style="${inputStyle()}" />
        </label>
        <label style="${fieldStyle()}">
          Queue
          <select name="status" style="${inputStyle()}">
            ${REVIEWABLE_STATUSES.map(
              (status) => `<option value="${status}" ${state.status === status ? "selected" : ""}>${statusLabel(status)}</option>`,
            ).join("")}
          </select>
        </label>
      </form>

      <p role="status" style="min-height: 22px; margin: 0 0 16px; color: #6b5344;">${escapeHtml(state.message)}</p>
      <section data-queue style="display: grid; gap: 12px;">
        ${renderQueue()}
      </section>
    </section>
  `;

  bindEvents();
}

function renderQueue(): string {
  if (!state.apiUrl.trim()) {
    return `<div style="${cardStyle()}">Configure an API URL to load the volunteer queue.</div>`;
  }

  if (state.loading) {
    return `<div style="${cardStyle()}">Loading ${statusLabel(state.status).toLowerCase()} feedback...</div>`;
  }

  if (state.items.length === 0) {
    return `<div style="${cardStyle()}">No ${statusLabel(state.status).toLowerCase()} feedback found.</div>`;
  }

  return state.items.map(renderItem).join("");
}

function renderItem(item: VolunteerFeedbackItem): string {
  return `
    <article style="${cardStyle()}" data-item-id="${escapeHtml(item.id)}">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; margin-bottom: 10px;">
        <div>
          <strong>${escapeHtml(item.category)}</strong>
          <span style="color: #6b5344;">#${escapeHtml(item.id)} · ${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>
        </div>
        <span style="border: 2px solid #8b6914; border-radius: 999px; padding: 2px 8px;">${statusLabel(item.status)}</span>
      </div>
      <p style="white-space: pre-wrap; margin: 0 0 12px;">${escapeHtml(item.message)}</p>
      ${item.contact ? `<p style="margin: 0 0 12px; color: #6b5344;">Contact: ${escapeHtml(item.contact)}</p>` : ""}
      <details style="margin-bottom: 12px;">
        <summary>Run summary</summary>
        <pre style="white-space: pre-wrap; color: #6b5344;">${escapeHtml(formatSummary(item.runSummary))}</pre>
      </details>
      <label style="${fieldStyle()}">
        Reviewer note
        <textarea name="reviewNote" rows="3" placeholder="Short reason for the decision" style="${inputStyle()}">${escapeHtml(item.reviewNote ?? "")}</textarea>
      </label>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 10px;">
        <button data-decision="needs_info" style="${secondaryButtonStyle()}">Needs info</button>
        <button data-decision="denied" style="${dangerButtonStyle()}">Deny</button>
        <button data-decision="approved" style="${primaryButtonStyle()}">Approve</button>
      </div>
    </article>
  `;
}

function bindEvents(): void {
  const settings = root.querySelector("[data-settings]") as HTMLFormElement | null;
  settings?.addEventListener("change", () => {
    const data = new FormData(settings);
    state.apiUrl = String(data.get("apiUrl") ?? "");
    state.token = String(data.get("token") ?? "");
    state.reviewer = String(data.get("reviewer") ?? "");
    state.status = data.get("status") as FeedbackStatus;
    sessionStorage.setItem(TOKEN_KEY, state.token);
    sessionStorage.setItem(REVIEWER_KEY, state.reviewer);
    void loadQueue();
  });

  root.querySelector("[data-refresh]")?.addEventListener("click", () => void loadQueue());

  const decisionButtons = Array.from(root.querySelectorAll("[data-decision]")) as HTMLButtonElement[];
  decisionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const article = button.closest("[data-item-id]") as HTMLElement | null;
      if (!article) return;
      const note = (article.querySelector("textarea[name='reviewNote']") as HTMLTextAreaElement | null)?.value ?? "";
      void reviewItem(article.dataset.itemId ?? "", button.dataset.decision as ReviewDecision, note);
    });
  });
}

async function loadQueue(): Promise<void> {
  if (!state.apiUrl.trim()) {
    state.items = [];
    state.message = "Configure an API URL to load feedback.";
    render();
    return;
  }

  state.loading = true;
  state.message = "";
  render();

  try {
    state.items = await fetchReviewQueue(state.status, {
      apiUrl: state.apiUrl,
      token: state.token,
    });
    state.message = `Loaded ${state.items.length} ${statusLabel(state.status).toLowerCase()} item(s).`;
  } catch (error) {
    state.items = [];
    state.message = error instanceof Error ? error.message : "Could not load feedback.";
  } finally {
    state.loading = false;
    render();
  }
}

async function reviewItem(id: string, status: ReviewDecision, reviewNote: string): Promise<void> {
  if (!id) return;
  if (!state.reviewer.trim()) {
    state.message = "Add a reviewer name before submitting a decision.";
    render();
    return;
  }

  try {
    await submitReviewDecision(
      id,
      {
        status,
        reviewer: state.reviewer.trim(),
        reviewNote: reviewNote.trim(),
      },
      {
        apiUrl: state.apiUrl,
        token: state.token,
      },
    );
    state.message = `Marked ${id} as ${statusLabel(status)}.`;
    state.items = state.items.filter((item) => item.id !== id);
    render();
  } catch (error) {
    state.message = error instanceof Error ? error.message : "Could not submit review decision.";
    render();
  }
}

function formatSummary(summary: PlaytestRunSummary): string {
  return [
    `Build: ${summary.buildVersion}`,
    `Modifier: ${summary.modifier} (${summary.modifierId})`,
    `Ending: ${summary.ended}`,
    `Spoons: ${summary.spoons}`,
    `Crust Credits: ${summary.crustCredits}`,
    `Jar Remaining: ${summary.jarPercent}%`,
    `Frenzy Active: ${summary.frenzyActive ? "yes" : "no"}`,
    `Chain: ${summary.chain}`,
  ].join("\n");
}

function statusLabel(status: FeedbackStatus | ReviewDecision): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "needs_info":
      return "Needs info";
  }
}

function cardStyle(): string {
  return [
    "border: 3px solid #8b6914",
    "border-radius: 12px",
    "background: #ffffff",
    "padding: 14px",
    "box-shadow: 0 8px 20px rgba(61, 41, 20, 0.08)",
  ].join(";");
}

function fieldStyle(): string {
  return ["display: grid", "gap: 4px", "font-weight: 700"].join(";");
}

function inputStyle(): string {
  return [
    "box-sizing: border-box",
    "width: 100%",
    "border: 2px solid #8b6914",
    "border-radius: 8px",
    "padding: 9px",
    "background: #fffaf0",
    "color: #5c3d1e",
  ].join(";");
}

function primaryButtonStyle(): string {
  return buttonStyle("#5c3d1e", "#ffffff", "#5c3d1e");
}

function secondaryButtonStyle(): string {
  return buttonStyle("#f5e6cc", "#5c3d1e", "#8b6914");
}

function dangerButtonStyle(): string {
  return buttonStyle("#8b1a1a", "#ffffff", "#8b1a1a");
}

function buttonStyle(background: string, color: string, border: string): string {
  return [
    "border-radius: 8px",
    `border: 2px solid ${border}`,
    `background: ${background}`,
    `color: ${color}`,
    "font-weight: 700",
    "padding: 9px 12px",
  ].join(";");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
