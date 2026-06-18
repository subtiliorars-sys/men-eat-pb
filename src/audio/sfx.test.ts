import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMuted,
  playChomp,
  playClick,
  playFrenzy,
  playLose,
  playMiss,
  playWin,
  setMuted,
  toggleMuted,
} from "./sfx.js";
import { isMusicPlaying, setMusicFrenzy, startMusic, stopMusic } from "./music.js";

describe("audio mute preference", () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      clear: () => map.clear(),
    });
  });

  it("defaults to unmuted", () => {
    expect(isMuted()).toBe(false);
  });

  it("persists the mute flag", () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it("toggles and returns the new state", () => {
    setMuted(false);
    expect(toggleMuted()).toBe(true);
    expect(isMuted()).toBe(true);
    expect(toggleMuted()).toBe(false);
    expect(isMuted()).toBe(false);
  });
});

describe("audio playback is safe without Web Audio (Node)", () => {
  it("sfx calls are no-ops and never throw", () => {
    expect(() => {
      playChomp(0);
      playChomp(12, true);
      playMiss();
      playFrenzy();
      playWin();
      playLose();
      playClick();
    }).not.toThrow();
  });

  it("music controls are no-ops and never throw", () => {
    expect(() => {
      startMusic();
      setMusicFrenzy(true);
      setMusicFrenzy(false);
      stopMusic();
    }).not.toThrow();
    expect(isMusicPlaying()).toBe(false);
  });
});
