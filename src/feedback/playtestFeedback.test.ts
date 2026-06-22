import { describe, expect, it, vi } from "vitest";

// Mock localStorage for node environment
global.localStorage = {
  state: {} as Record<string, string>,
  setItem(key: string, item: string) {
    this.state[key] = item;
  },
  getItem(key: string) {
    return this.state[key] || null;
  },
  removeItem(key: string) {
    delete this.state[key];
  },
  clear() {
    this.state = {};
  },
  length: 0,
  key: vi.fn(),
} as any;

import { createRun } from "../sim/engine.js";
import {
  createPlaytestFeedbackPayload,
  createPlaytestFeedbackUrl,
  createPlaytestIssueTitle,
  createPlaytestRunSummary,
  formatPlaytestIssueBody,
  submitPlaytestFeedback,
  type PlaytestFeedbackDraft,
} from "./playtestFeedback.js";

const draft: PlaytestFeedbackDraft = {
  category: "feel",
  message: "The frenzy moment felt great, but the ending was abrupt.",
  contact: "tester@example.com",
  allowPublicReview: true,
};

describe("createPlaytestRunSummary", () => {
  it("captures the completed run context volunteers need", () => {
    const run = createRun("crust");
    run.ended = "jar_empty";
    run.running = false;
    run.spoons = 27.8;
    run.jarLeft = 0;
    run.chain = 4;
    run.frenzy = true;

    expect(createPlaytestRunSummary(run, "test-build")).toEqual({
      buildVersion: "test-build",
      modifier: "Crust Only",
      modifierId: "crust",
      ended: "jar_empty",
      spoons: 27,
      crustCredits: 5,
      jarPercent: 0,
      frenzyActive: true,
      chain: 4,
    });
  });

  it("requires an ended run", () => {
    expect(() => createPlaytestRunSummary(createRun("double"))).toThrow(/has not ended/);
  });
});

describe("playtest feedback copy", () => {
  it("creates a concise issue title", () => {
    const run = createRun("napkins");
    run.ended = "stuck_shut";

    expect(createPlaytestIssueTitle(createPlaytestRunSummary(run))).toBe("[Playtest] Stuck shut with No Napkins");
  });

  it("includes volunteer review checks in the issue body", () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    expect(formatPlaytestIssueBody(createPlaytestRunSummary(run))).toContain("- [ ] Approved for the backlog");
  });

  it("can include player draft details in the issue body", () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    const body = formatPlaytestIssueBody(createPlaytestRunSummary(run), draft);

    expect(body).toContain("Category: feel");
    expect(body).toContain("The frenzy moment felt great");
    expect(body).toContain("Public review OK: yes");
  });
});

describe("createPlaytestFeedbackUrl", () => {
  it("prefills a GitHub issue URL", () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    const url = new URL(
      createPlaytestFeedbackUrl(createPlaytestRunSummary(run), {
        baseUrl: "https://github.com/example/men-eat-pb/issues/new?template=playtest-feedback.md",
        draft,
      }),
    );

    expect(url.searchParams.get("template")).toBe("playtest-feedback.md");
    expect(url.searchParams.get("title")).toBe("[Playtest] Jar empty with Double Chunk");
    expect(url.searchParams.get("labels")).toBe("playtest,pending-review");
    expect(url.searchParams.get("body")).toContain("The frenzy moment felt great");
  });

  it("prefills a GitLab issue URL with GitLab parameter names", () => {
    const run = createRun("crust");
    run.ended = "stuck_shut";

    const url = new URL(
      createPlaytestFeedbackUrl(createPlaytestRunSummary(run), {
        baseUrl: "https://gitlab.com/example/men-eat-pb/-/issues/new",
      }),
    );

    expect(url.searchParams.get("issue[title]")).toBe("[Playtest] Stuck shut with Crust Only");
    expect(url.searchParams.get("issue[labels]")).toBe("playtest,pending-review");
    expect(url.searchParams.get("issue[description]")).toContain("Volunteer review");
  });

  it("falls back to mailto when no community intake URL is configured", () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    expect(createPlaytestFeedbackUrl(createPlaytestRunSummary(run), { baseUrl: "" })).toMatch(/^mailto:\?/);
  });
});

describe("createPlaytestFeedbackPayload", () => {
  it("builds the API payload from a draft and run summary", () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    const payload = createPlaytestFeedbackPayload(createPlaytestRunSummary(run), draft, {
      now: () => new Date("2026-06-15T14:12:00.000Z"),
      pageUrl: "https://example.com/game",
      userAgent: "vitest",
    });

    expect(payload).toMatchObject({
      schemaVersion: 1,
      submittedAt: "2026-06-15T14:12:00.000Z",
      category: "feel",
      message: "The frenzy moment felt great, but the ending was abrupt.",
      contact: "tester@example.com",
      allowPublicReview: true,
      pageUrl: "https://example.com/game",
      userAgent: "vitest",
    });
  });
});

describe("submitPlaytestFeedback", () => {
  it("posts feedback to the configured API", async () => {
    const run = createRun("double");
    run.ended = "jar_empty";
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toContain("The frenzy moment felt great");
      return new Response(JSON.stringify({ id: "fb_123", reviewUrl: "https://example.com/review/fb_123" }));
    };

    await expect(
      submitPlaytestFeedback(createPlaytestRunSummary(run), draft, {
        apiUrl: "https://example.com/feedback",
        fetcher,
        now: () => new Date("2026-06-15T14:12:00.000Z"),
        pageUrl: "https://example.com/game",
        userAgent: "vitest",
      }),
    ).resolves.toEqual({
      ok: true,
      id: "fb_123",
      reviewUrl: "https://example.com/review/fb_123",
    });
  });

  it("returns a typed error when no API is configured", async () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    await expect(submitPlaytestFeedback(createPlaytestRunSummary(run), draft, { apiUrl: "" })).resolves.toEqual({
      ok: false,
      error: "Feedback API is not configured.",
    });
  });
});
