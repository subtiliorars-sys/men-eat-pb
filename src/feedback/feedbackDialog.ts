import {
  createPlaytestFeedbackUrl,
  FEEDBACK_CATEGORIES,
  submitPlaytestFeedback,
  type FeedbackCategory,
  type PlaytestFeedbackDraft,
  type PlaytestRunSummary,
} from "./playtestFeedback.js";

const PANEL_WIDTH = "min(520px, calc(100vw - 32px))";

export function openPlaytestFeedbackDialog(summary: PlaytestRunSummary): void {
  const existing = document.querySelector("[data-playtest-feedback-dialog]");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.dataset.playtestFeedbackDialog = "true";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "1000",
    display: "grid",
    placeItems: "center",
    background: "rgba(0, 0, 0, 0.58)",
    fontFamily: "system-ui, sans-serif",
  });

  const panel = document.createElement("form");
  Object.assign(panel.style, {
    width: PANEL_WIDTH,
    boxSizing: "border-box",
    border: "4px solid #3d2914",
    borderRadius: "14px",
    padding: "18px",
    background: "#fff8dc",
    color: "#5c3d1e",
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
  });

  panel.innerHTML = `
    <h2 style="margin: 0 0 8px; font-size: 22px;">Send playtest feedback</h2>
    <p style="margin: 0 0 12px; color: #6b5344; font-size: 14px;">
      Your run summary is attached so volunteers can review and approve or deny the note.
    </p>
    <label style="display: grid; gap: 4px; margin-bottom: 10px; font-weight: 700;">
      Category
      <select name="category" style="font: inherit; padding: 8px; border: 2px solid #8b6914; border-radius: 8px;">
        ${FEEDBACK_CATEGORIES.map((category) => `<option value="${category}">${categoryLabel(category)}</option>`).join("")}
      </select>
    </label>
    <label style="display: grid; gap: 4px; margin-bottom: 10px; font-weight: 700;">
      What should volunteers know?
      <textarea
        name="message"
        required
        minlength="8"
        rows="6"
        placeholder="What felt fun, confusing, unfair, broken, too easy, too hard, or worth keeping?"
        style="font: inherit; resize: vertical; padding: 8px; border: 2px solid #8b6914; border-radius: 8px;"
      ></textarea>
    </label>
    <label style="display: grid; gap: 4px; margin-bottom: 10px; font-weight: 700;">
      Contact (optional)
      <input
        name="contact"
        placeholder="Discord, email, itch username..."
        style="font: inherit; padding: 8px; border: 2px solid #8b6914; border-radius: 8px;"
      />
    </label>
    <label style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 12px; color: #6b5344; font-size: 13px;">
      <input name="allowPublicReview" type="checkbox" checked style="margin-top: 2px;" />
      OK to keep this note in a public volunteer review queue.
    </label>
    <details style="margin-bottom: 12px; color: #6b5344; font-size: 13px;">
      <summary>Attached run summary</summary>
      <pre style="white-space: pre-wrap; margin: 8px 0 0;">${escapeHtml(formatRunSummary(summary))}</pre>
    </details>
    <p data-feedback-status role="status" style="min-height: 20px; margin: 0 0 12px; color: #6b5344; font-size: 13px;"></p>
    <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end;">
      <button type="button" data-feedback-cancel style="${secondaryButtonStyle()}">Cancel</button>
      <button type="button" data-feedback-issue style="${secondaryButtonStyle()}">Open issue instead</button>
      <button type="submit" style="${primaryButtonStyle()}">Submit</button>
    </div>
  `;

  overlay.append(panel);
  document.body.append(overlay);

  const status = panel.querySelector("[data-feedback-status]") as HTMLParagraphElement;
  const cancel = panel.querySelector("[data-feedback-cancel]") as HTMLButtonElement;
  const issue = panel.querySelector("[data-feedback-issue]") as HTMLButtonElement;

  cancel.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  issue.addEventListener("click", () => openIssueFallback(summary, readDraft(panel)));

  panel.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!panel.reportValidity()) return;

    const submit = panel.querySelector("button[type='submit']") as HTMLButtonElement;
    const draft = readDraft(panel);
    submit.disabled = true;
    status.textContent = "Submitting feedback...";

    const result = await submitPlaytestFeedback(summary, draft);
    submit.disabled = false;

    if (result.ok) {
      status.textContent = result.reviewUrl
        ? "Feedback submitted. Opening the volunteer review item..."
        : "Feedback submitted for volunteer review. Thank you!";
      if (result.reviewUrl) window.open(result.reviewUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => overlay.remove(), 1000);
      return;
    }

    status.textContent = `${result.error} You can still open a prefilled issue.`;
  });
}

function readDraft(form: HTMLFormElement): PlaytestFeedbackDraft {
  const data = new FormData(form);
  return {
    category: data.get("category") as FeedbackCategory,
    message: String(data.get("message") ?? ""),
    contact: String(data.get("contact") ?? ""),
    allowPublicReview: data.get("allowPublicReview") === "on",
  };
}

function openIssueFallback(summary: PlaytestRunSummary, draft: PlaytestFeedbackDraft): void {
  const fallbackUrl = createPlaytestFeedbackUrl(summary, { draft });
  if (fallbackUrl.startsWith("mailto:")) {
    window.location.href = fallbackUrl;
    return;
  }

  window.open(fallbackUrl, "_blank", "noopener,noreferrer");
}

function formatRunSummary(summary: PlaytestRunSummary): string {
  return [
    `Build: ${summary.buildVersion}`,
    `Modifier: ${summary.modifier}`,
    `Ending: ${summary.ended}`,
    `Spoons: ${summary.spoons}`,
    `Crust Credits: ${summary.crustCredits}`,
    `Jar Remaining: ${summary.jarPercent}%`,
    `Frenzy Active: ${summary.frenzyActive ? "yes" : "no"}`,
    `Chain: ${summary.chain}`,
  ].join("\n");
}

function categoryLabel(category: FeedbackCategory): string {
  switch (category) {
    case "bug":
      return "Bug";
    case "balance":
      return "Balance";
    case "feel":
      return "Game feel";
    case "accessibility":
      return "Accessibility";
    case "other":
      return "Other";
  }
}

function primaryButtonStyle(): string {
  return [
    "font: inherit",
    "font-weight: 700",
    "padding: 10px 14px",
    "border: 0",
    "border-radius: 8px",
    "background: #5c3d1e",
    "color: #ffffff",
    "cursor: pointer",
  ].join(";");
}

function secondaryButtonStyle(): string {
  return [
    "font: inherit",
    "font-weight: 700",
    "padding: 10px 14px",
    "border: 2px solid #8b6914",
    "border-radius: 8px",
    "background: #f5e6cc",
    "color: #5c3d1e",
    "cursor: pointer",
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
