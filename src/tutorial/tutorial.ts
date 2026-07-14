import type { ManId } from "../sim/types.js";

export type TutorialStepId =
  | "welcome"
  | "tap_carl"
  | "tap_any"
  | "chain_frenzy"
  | "avoid_misses"
  | "pick_location"
  | "done";

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  body: string;
  /** If set, wait for this man to chomp successfully */
  waitForChompBy?: ManId;
  /** If set, wait for any successful chomp */
  waitForAnyChomp?: boolean;
  /** Highlight all men */
  highlightAllMen?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to the picnic!",
    body: "Your goal: empty the peanut butter jar before it gets Stuck Shut. Blobs land on the table — tap a man to chomp the nearest one.",
  },
  {
    id: "tap_carl",
    title: "Try your first chomp",
    body: "Tap Carl (glowing below). He'll chomp the closest blob within reach.",
    waitForChompBy: "Carl",
  },
  {
    id: "tap_any",
    title: "Any man works",
    body: "Carl, Dave, Ben, and Ed all chomp the nearest blob. Try tapping a different man now.",
    waitForAnyChomp: true,
    highlightAllMen: true,
  },
  {
    id: "chain_frenzy",
    title: "Build a chain → Frenzy",
    body: "Chain chomps without missing to trigger FRENZY — 10 seconds of faster spawns and 1.5× spoon value. Watch the Chain counter in the HUD.",
  },
  {
    id: "avoid_misses",
    title: "Don't miss five times",
    body: "Tapping when no blob is in reach counts as a miss. Five misses = Stuck Shut (you lose). Crunchy blobs (darker) are worth more spoons!",
  },
  {
    id: "pick_location",
    title: "Pick your spot",
    body: "Each run happens at a different location — Park, Beach, Food Truck Row, or Backyard BBQ. Pick one on the start screen before opening the jar.",
  },
  {
    id: "done",
    title: "You're ready!",
    body: "Choose a lunch modifier, pick a location, and tap Open the jar. Have fun — and send feedback after your run!",
  },
];

const STORAGE_KEY = "mep_tutorial_done";
const FIRST_RUN_TIP_KEY = "mep_first_run_tip";

export function shouldShowFirstRunTip(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_TIP_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markFirstRunTipShown(): void {
  try {
    localStorage.setItem(FIRST_RUN_TIP_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function isTutorialCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTutorialCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function resetTutorialFlag(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export class TutorialState {
  stepIndex = 0;
  /** Chomps counted during wait-for-chomp steps */
  chompsThisStep = 0;
  active = false;
  completed = false;

  get step(): TutorialStep {
    return TUTORIAL_STEPS[Math.min(this.stepIndex, TUTORIAL_STEPS.length - 1)];
  }

  start(): void {
    this.active = true;
    this.completed = false;
    this.stepIndex = 0;
    this.chompsThisStep = 0;
  }

  /** Returns true if step advanced */
  tryAdvance(): boolean {
    const s = this.step;
    if (s.waitForChompBy || s.waitForAnyChomp) return false;
    return this.advance();
  }

  onChomp(manId: ManId, hit: boolean): boolean {
    if (!this.active || !hit) return false;
    const s = this.step;
    if (s.waitForChompBy && manId !== s.waitForChompBy) return false;
    if (s.waitForChompBy || s.waitForAnyChomp) {
      this.chompsThisStep++;
      return this.advance();
    }
    return false;
  }

  advance(): boolean {
    if (this.stepIndex >= TUTORIAL_STEPS.length - 1) {
      this.completed = true;
      this.active = false;
      markTutorialCompleted();
      return true;
    }
    this.stepIndex++;
    this.chompsThisStep = 0;
    if (this.stepIndex >= TUTORIAL_STEPS.length - 1) {
      this.completed = true;
      this.active = false;
      markTutorialCompleted();
    }
    return true;
  }

  skip(): void {
    this.active = false;
    this.completed = true;
    markTutorialCompleted();
  }
}
