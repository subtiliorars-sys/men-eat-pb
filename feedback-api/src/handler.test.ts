import { describe, expect, it } from "vitest";
import { handleFeedbackApiRequest, type FeedbackApiEnv } from "./handler";
import { MemoryFeedbackStore } from "./store";

const env: FeedbackApiEnv = {
  DB: {} as D1Database,
  MODERATOR_TOKEN: "secret-token",
  ALLOWED_ORIGINS: "https://game.example",
  REVIEW_BASE_URL: "https://admin.example/feedback",
};

function validPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    submittedAt: "2026-06-15T14:24:00.000Z",
    category: "feel",
    message: "The frenzy moment felt good, but the end screen was abrupt.",
    contact: "tester@example.com",
    allowPublicReview: true,
    runSummary: {
      buildVersion: "0.1.0",
      modifier: "Double Chunk",
      modifierId: "double",
      ended: "jar_empty",
      spoons: 25,
      crustCredits: 5,
      jarPercent: 0,
      frenzyActive: false,
      chain: 3,
    },
    pageUrl: "https://game.example",
    userAgent: "vitest",
  };
}

describe("handleFeedbackApiRequest", () => {
  it("handles CORS preflight", async () => {
    const response = await handleFeedbackApiRequest(new Request("https://api.example/feedback", { method: "OPTIONS" }), env, {
      store: new MemoryFeedbackStore(),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("creates feedback submissions", async () => {
    const response = await handleFeedbackApiRequest(
      new Request("https://api.example/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://game.example" },
        body: JSON.stringify(validPayload()),
      }),
      env,
      {
        store: new MemoryFeedbackStore(),
        now: () => new Date("2026-06-15T14:24:00.000Z"),
      },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://game.example");
    await expect(response.json()).resolves.toMatchObject({
      id: "fb_1",
      reviewUrl: "https://admin.example/feedback/fb_1",
    });
  });

  it("rejects invalid submissions", async () => {
    const payload = validPayload();
    payload.message = "short";

    const response = await handleFeedbackApiRequest(
      new Request("https://api.example/feedback", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
      env,
      { store: new MemoryFeedbackStore() },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Feedback message must be at least 8 characters.",
    });
  });

  it("requires moderator auth for queue reads", async () => {
    const response = await handleFeedbackApiRequest(new Request("https://api.example/feedback?status=pending"), env, {
      store: new MemoryFeedbackStore(),
    });

    expect(response.status).toBe(401);
  });

  it("lists and reviews feedback with moderator auth", async () => {
    const store = new MemoryFeedbackStore();
    await handleFeedbackApiRequest(
      new Request("https://api.example/feedback", {
        method: "POST",
        body: JSON.stringify(validPayload()),
      }),
      env,
      {
        store,
        now: () => new Date("2026-06-15T14:24:00.000Z"),
      },
    );

    const list = await handleFeedbackApiRequest(
      new Request("https://api.example/feedback?status=pending", {
        headers: { Authorization: "Bearer secret-token" },
      }),
      env,
      { store },
    );

    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({
      items: [{ id: "fb_1", status: "pending" }],
    });

    const review = await handleFeedbackApiRequest(
      new Request("https://api.example/feedback/fb_1", {
        method: "PATCH",
        headers: { Authorization: "Bearer secret-token" },
        body: JSON.stringify({
          status: "approved",
          reviewer: "Mira",
          reviewNote: "Clear and actionable.",
        }),
      }),
      env,
      {
        store,
        now: () => new Date("2026-06-15T14:25:00.000Z"),
      },
    );

    expect(review.status).toBe(200);
    await expect(review.json()).resolves.toMatchObject({
      item: {
        id: "fb_1",
        status: "approved",
        reviewer: "Mira",
        reviewNote: "Clear and actionable.",
      },
    });
  });
});
