import {
  frenzyRemaining,
  isSticky,
  jarPercent,
  missesUntilStuck,
  stickyRemaining,
} from "./engine.js";
import type { RunState } from "./types.js";

/** One-line goal reminder shown above the jar during a run. */
export function objectiveLine(state: RunState, nowMs: number): string {
  if (state.frenzy) {
    return `FRENZY! ${frenzyRemaining(state)}s left — chomp fast!`;
  }
  if (state.missStreak >= 3) {
    const left = missesUntilStuck(state);
    const noun = left === 1 ? "miss" : "misses";
    return `Careful — ${left} ${noun} until Stuck Shut`;
  }
  if (isSticky(state, nowMs)) {
    return `Sticky jar — ${stickyRemaining(state, nowMs)}s until blobs ease up`;
  }
  const pct = Math.ceil(jarPercent(state));
  return `Empty the jar — ${pct}% peanut butter left`;
}
