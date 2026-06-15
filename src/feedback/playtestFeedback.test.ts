import { describe, expect, it } from "vitest";
import { createRun } from "../sim/engine.js";
import {
  createPlaytestFeedbackUrl,
  createPlaytestIssueTitle,
  createPlaytestRunSummary,
  formatPlaytestIssueBody,
} from "./playtestFeedback.js";

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
});

describe("createPlaytestFeedbackUrl", () => {
  it("prefills a GitHub issue URL", () => {
    const run = createRun("double");
    run.ended = "jar_empty";

    const url = new URL(
      createPlaytestFeedbackUrl(createPlaytestRunSummary(run), {
        baseUrl: "https://github.com/example/men-eat-pb/issues/new?template=playtest-feedback.md",
      }),
    );

    expect(url.searchParams.get("template")).toBe("playtest-feedback.md");
    expect(url.searchParams.get("title")).toBe("[Playtest] Jar empty with Double Chunk");
    expect(url.searchParams.get("labels")).toBe("playtest,pending-review");
    expect(url.searchParams.get("body")).toContain("## Run summary");
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
