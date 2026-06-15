import { describe, expect, it } from "vitest";
import {
  chomp,
  createRun,
  crustCredits,
  frenzyThreshold,
  nearestBlob,
  spawnBlob,
  tick,
} from "./engine.js";
import { createSeededRng } from "./rng.js";

describe("createRun", () => {
  it("applies crust jar shrink", () => {
    const run = createRun("crust");
    expect(run.jarMax).toBe(70);
    expect(run.jarLeft).toBe(70);
  });
});

describe("chomp", () => {
  it("awards spoons on hit", () => {
    const run = createRun("double");
    run.blobs.push({
      id: 1,
      x: 72,
      y: 72,
      size: 30,
      crunchy: false,
      vx: 0,
      vy: 0,
    });
    const result = chomp(run, "Carl", 0);
    expect(result.hit).toBe(true);
    expect(result.value).toBe(1);
    expect(run.spoons).toBe(1);
    expect(run.blobs).toHaveLength(0);
  });

  it("ends run on stuck shut", () => {
    const run = createRun("double");
    for (let i = 0; i < 5; i++) {
      chomp(run, "Carl", i * 100);
    }
    expect(run.ended).toBe("stuck_shut");
    expect(run.running).toBe(false);
  });

  it("triggers frenzy at threshold", () => {
    const run = createRun("double");
    expect(frenzyThreshold(run)).toBe(6);
    for (let i = 0; i < 6; i++) {
      run.blobs.push({
        id: i + 1,
        x: 72,
        y: 72,
        size: 20,
        crunchy: false,
        vx: 0,
        vy: 0,
      });
      chomp(run, "Carl", i);
    }
    expect(run.frenzy).toBe(true);
  });
});

describe("tick", () => {
  it("spawns blobs over time", () => {
    const run = createRun("double");
    const rng = createSeededRng(42);
    tick(run, 2, 0, rng);
    expect(run.blobs.length).toBeGreaterThan(0);
  });

  it("ends when jar depletes via digestion", () => {
    const run = createRun("double");
    run.jarLeft = 0.01;
    tick(run, 1, 0, createSeededRng(1));
    expect(run.ended).toBe("jar_empty");
  });
});

describe("nearestBlob", () => {
  it("returns null when out of reach", () => {
    const run = createRun("double");
    run.blobs.push({
      id: 1,
      x: 400,
      y: 300,
      size: 30,
      crunchy: false,
      vx: 0,
      vy: 0,
    });
    expect(nearestBlob(run, 72, 72)).toBeNull();
  });
});

describe("crustCredits", () => {
  it("floors spoons divided by five", () => {
    const run = createRun("double");
    run.spoons = 23;
    expect(crustCredits(run)).toBe(4);
  });
});

describe("spawnBlob", () => {
  it("is deterministic with seeded rng", () => {
    const a = createRun("double");
    const b = createRun("double");
    const rngA = createSeededRng(99);
    const rngB = createSeededRng(99);
    const blobA = spawnBlob(a, rngA);
    const blobB = spawnBlob(b, rngB);
    expect(blobA.crunchy).toBe(blobB.crunchy);
    expect(blobA.x).toBeCloseTo(blobB.x, 5);
  });
});
