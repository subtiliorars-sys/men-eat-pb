import { describe, expect, it } from "vitest";
import {
  createReviewQueueUrl,
  fetchReviewQueue,
  submitReviewDecision,
  type VolunteerFeedbackItem,
} from "./reviewApi.js";

const item: VolunteerFeedbackItem = {
  id: "fb_123",
  createdAt: "2026-06-15T14:12:00.000Z",
  status: "pending",
  category: "balance",
  message: "No Napkins feels too sticky.",
  allowPublicReview: true,
  runSummary: {
    buildVersion: "0.1.0",
    modifier: "No Napkins",
    modifierId: "napkins",
    ended: "stuck_shut",
    spoons: 12,
    crustCredits: 2,
    jarPercent: 43,
    frenzyActive: false,
    chain: 0,
  },
};

describe("createReviewQueueUrl", () => {
  it("creates a status-filtered queue URL", () => {
    expect(createReviewQueueUrl("pending", "https://example.com/api/")).toBe(
      "https://example.com/api/feedback?status=pending",
    );
  });
});

describe("fetchReviewQueue", () => {
  it("loads volunteer feedback items with bearer auth", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.com/api/feedback?status=pending");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret");
      return new Response(JSON.stringify({ items: [item] }));
    };

    await expect(
      fetchReviewQueue("pending", {
        apiUrl: "https://example.com/api",
        token: "secret",
        fetcher,
      }),
    ).resolves.toEqual([item]);
  });
});

describe("submitReviewDecision", () => {
  it("patches approve, deny, and needs-info decisions", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://example.com/api/feedback/fb_123");
      expect(init?.method).toBe("PATCH");
      expect(init?.body).toBe(
        JSON.stringify({
          status: "approved",
          reviewer: "Mira",
          reviewNote: "Clear balance report.",
        }),
      );
      return new Response("{}");
    };

    await expect(
      submitReviewDecision(
        "fb_123",
        {
          status: "approved",
          reviewer: "Mira",
          reviewNote: "Clear balance report.",
        },
        {
          apiUrl: "https://example.com/api",
          fetcher,
        },
      ),
    ).resolves.toBeUndefined();
  });
});
