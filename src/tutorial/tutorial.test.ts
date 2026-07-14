import { afterEach, describe, expect, it, vi } from "vitest";
import { markFirstRunTipShown, shouldShowFirstRunTip } from "./tutorial.js";

describe("first-run tip", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows on first real run only", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    } as Storage);

    expect(shouldShowFirstRunTip()).toBe(true);
    markFirstRunTipShown();
    expect(shouldShowFirstRunTip()).toBe(false);
  });
});
