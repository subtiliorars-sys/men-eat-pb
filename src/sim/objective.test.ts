import { describe, expect, it } from "vitest";
import { createRun } from "./engine.js";
import { objectiveLine } from "./objective.js";

describe("objectiveLine", () => {
  it("shows jar fill by default", () => {
    const run = createRun("double");
    run.jarLeft = 50;
    run.jarMax = 100;
    expect(objectiveLine(run, 0)).toBe("Empty the jar — 50% peanut butter left");
  });

  it("warns when miss streak is high", () => {
    const run = createRun("double");
    run.missStreak = 4;
    expect(objectiveLine(run, 0)).toBe("Careful — 1 miss until Stuck Shut");
  });

  it("celebrates frenzy", () => {
    const run = createRun("double");
    run.frenzy = true;
    run.frenzyTimer = 7.2;
    expect(objectiveLine(run, 0)).toBe("FRENZY! 8s left — chomp fast!");
  });

  it("notes sticky jar cooldown", () => {
    const run = createRun("double");
    run.stickyUntil = 5000;
    expect(objectiveLine(run, 2000)).toBe("Sticky jar — 3s until blobs ease up");
  });
});
