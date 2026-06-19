import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  addCrustCredits,
  buyUpgrade,
  canBuyUpgrade,
  loadMeta,
  saveMeta,
  unlockHints,
  UPGRADES,
} from "./progress.js";

describe("meta progress", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
    });
    saveMeta({ crustCredits: 0, upgrades: { deeperJar: 0, goldenSpoon: 0 } });
  });

  it("persists crust credits", () => {
    addCrustCredits(7);
    expect(loadMeta().crustCredits).toBe(7);
    addCrustCredits(3);
    expect(loadMeta().crustCredits).toBe(10);
  });

  it("buys upgrades when affordable", () => {
    addCrustCredits(20);
    const result = buyUpgrade("deeperJar");
    expect(result.ok).toBe(true);
    expect(loadMeta().upgrades.deeperJar).toBe(1);
    expect(loadMeta().crustCredits).toBe(12);
  });

  it("rejects purchase when insufficient credits", () => {
    const result = buyUpgrade("goldenSpoon");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient");
  });

  it("reports canBuy when affordable and not maxed", () => {
    addCrustCredits(UPGRADES.deeperJar.cost);
    expect(canBuyUpgrade("deeperJar")).toBe(true);
    buyUpgrade("deeperJar");
    expect(canBuyUpgrade("deeperJar")).toBe(false);
  });

  it("shows unlock hints for affordable upgrades", () => {
    addCrustCredits(8);
    const hints = unlockHints();
    expect(hints.some((h) => h.includes("Deeper Jar"))).toBe(true);
  });
});
