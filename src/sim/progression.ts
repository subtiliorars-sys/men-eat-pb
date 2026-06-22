import { Progression } from "./types.js";

const STORAGE_KEY = "men-eat-pb-progression";

const DEFAULT_PROGRESSION: Progression = {
  crustCredits: 0,
  upgrades: {
    deeperJar: 0,
    goldenSpoon: false,
  },
};

export function loadProgression(): Progression {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PROGRESSION };
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return { ...DEFAULT_PROGRESSION };
  try {
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_PROGRESSION };
  }
}

export function saveProgression(prog: Progression): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
}

export function addCredits(amount: number): number {
  const prog = loadProgression();
  prog.crustCredits += amount;
  saveProgression(prog);
  return prog.crustCredits;
}

export function buyUpgrade(id: "deeperJar" | "goldenSpoon"): boolean {
  const prog = loadProgression();
  const costs = {
    deeperJar: 20,
    goldenSpoon: 50,
  };

  if (id === "deeperJar") {
    if (prog.crustCredits >= costs.deeperJar) {
      prog.crustCredits -= costs.deeperJar;
      prog.upgrades.deeperJar++;
      saveProgression(prog);
      return true;
    }
  } else if (id === "goldenSpoon") {
    if (prog.crustCredits >= costs.goldenSpoon && !prog.upgrades.goldenSpoon) {
      prog.crustCredits -= costs.goldenSpoon;
      prog.upgrades.goldenSpoon = true;
      saveProgression(prog);
      return true;
    }
  }
  return false;
}
