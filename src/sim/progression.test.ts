import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UPGRADE_COSTS,
  addCredits,
  buyUpgrade,
  deeperJarLabel,
  loadProgression,
  saveProgression,
  upgradeUnlockHint,
} from "./progression.js";

const STORAGE_KEY = "men-eat-pb-progression";

const mockStorage = {
  state: {} as Record<string, string>,
  setItem(key: string, item: string) {
    mockStorage.state[key] = item;
  },
  getItem(key: string) {
    return mockStorage.state[key] ?? null;
  },
  removeItem(key: string) {
    delete mockStorage.state[key];
  },
  clear() {
    mockStorage.state = {};
  },
  length: 0,
  key: vi.fn(),
};

beforeEach(() => {
  mockStorage.clear();
  vi.stubGlobal("localStorage", mockStorage as unknown as Storage);
});

describe("loadProgression", () => {
  it("returns defaults when storage is empty", () => {
    expect(loadProgression()).toEqual({
      crustCredits: 0,
      upgrades: { deeperJar: 0, goldenSpoon: false },
    });
  });

  it("normalizes partial or invalid saves", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ crustCredits: -3, upgrades: { goldenSpoon: "yes" } }));
    expect(loadProgression()).toEqual({
      crustCredits: 0,
      upgrades: { deeperJar: 0, goldenSpoon: false },
    });
  });

  it("round-trips through saveProgression", () => {
    saveProgression({ crustCredits: 12, upgrades: { deeperJar: 1, goldenSpoon: true } });
    expect(loadProgression()).toEqual({
      crustCredits: 12,
      upgrades: { deeperJar: 1, goldenSpoon: true },
    });
  });
});

describe("addCredits", () => {
  it("persists earned credits in localStorage", () => {
    expect(addCredits(7)).toBe(7);
    expect(addCredits(3)).toBe(10);
    expect(loadProgression().crustCredits).toBe(10);
  });

  it("ignores non-positive amounts", () => {
    addCredits(5);
    expect(addCredits(0)).toBe(5);
    expect(addCredits(-2)).toBe(5);
  });
});

describe("buyUpgrade", () => {
  it("buys Deeper Jar I when affordable", () => {
    addCredits(UPGRADE_COSTS.deeperJar);
    expect(buyUpgrade("deeperJar")).toBe(true);
    const prog = loadProgression();
    expect(prog.crustCredits).toBe(0);
    expect(prog.upgrades.deeperJar).toBe(1);
  });

  it("buys Golden Spoon once", () => {
    addCredits(UPGRADE_COSTS.goldenSpoon);
    expect(buyUpgrade("goldenSpoon")).toBe(true);
    expect(loadProgression().upgrades.goldenSpoon).toBe(true);
    addCredits(UPGRADE_COSTS.goldenSpoon);
    expect(buyUpgrade("goldenSpoon")).toBe(false);
  });

  it("rejects purchases when short on credits", () => {
    addCredits(UPGRADE_COSTS.deeperJar - 1);
    expect(buyUpgrade("deeperJar")).toBe(false);
    expect(buyUpgrade("goldenSpoon")).toBe(false);
  });
});

describe("deeperJarLabel", () => {
  it("uses roman numerals for early tiers", () => {
    expect(deeperJarLabel(0)).toBe("Deeper Jar I");
    expect(deeperJarLabel(1)).toBe("Deeper Jar II");
  });
});

describe("upgradeUnlockHint", () => {
  it("nudges toward the next affordable upgrade", () => {
    expect(upgradeUnlockHint(loadProgression())).toContain("Deeper Jar I");
    addCredits(UPGRADE_COSTS.deeperJar);
    buyUpgrade("deeperJar");
    expect(upgradeUnlockHint(loadProgression())).toContain("Golden Spoon");
    addCredits(UPGRADE_COSTS.goldenSpoon);
    buyUpgrade("goldenSpoon");
    expect(upgradeUnlockHint(loadProgression())).toBe("");
  });
});
