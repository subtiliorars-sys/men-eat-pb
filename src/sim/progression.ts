import type { Progression } from "./types.js";

const STORAGE_KEY = "men-eat-pb-progression";

export const UPGRADE_COSTS = {
  deeperJar: 20,
  goldenSpoon: 50,
} as const;

const DEFAULT_PROGRESSION: Progression = {
  crustCredits: 0,
  upgrades: {
    deeperJar: 0,
    goldenSpoon: false,
  },
};

function normalizeProgression(raw: unknown): Progression {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PROGRESSION, upgrades: { ...DEFAULT_PROGRESSION.upgrades } };
  const data = raw as Partial<Progression> & { upgrades?: Partial<Progression["upgrades"]> };
  const upgrades: Partial<Progression["upgrades"]> =
    data.upgrades && typeof data.upgrades === "object" ? data.upgrades : {};
  return {
    crustCredits: typeof data.crustCredits === "number" && data.crustCredits >= 0 ? data.crustCredits : 0,
    upgrades: {
      deeperJar:
        typeof upgrades.deeperJar === "number" && upgrades.deeperJar >= 0 ? Math.floor(upgrades.deeperJar) : 0,
      goldenSpoon: upgrades.goldenSpoon === true,
    },
  };
}

export function deeperJarLabel(level: number): string {
  const tier = Math.max(0, Math.floor(level));
  const roman = ["I", "II", "III", "IV", "V"][tier] ?? String(tier + 1);
  return `Deeper Jar ${roman}`;
}

export function upgradeUnlockHint(prog: Progression): string {
  if (prog.upgrades.deeperJar === 0 && prog.crustCredits < UPGRADE_COSTS.deeperJar) {
    return `(Hint: ${UPGRADE_COSTS.deeperJar} credits for ${deeperJarLabel(0)})`;
  }
  if (!prog.upgrades.goldenSpoon && prog.crustCredits < UPGRADE_COSTS.goldenSpoon) {
    return `(Hint: ${UPGRADE_COSTS.goldenSpoon} credits for Golden Spoon)`;
  }
  return "";
}

export function loadProgression(): Progression {
  if (typeof localStorage === "undefined") {
    return { ...DEFAULT_PROGRESSION, upgrades: { ...DEFAULT_PROGRESSION.upgrades } };
  }
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return { ...DEFAULT_PROGRESSION, upgrades: { ...DEFAULT_PROGRESSION.upgrades } };
  try {
    return normalizeProgression(JSON.parse(data));
  } catch {
    return { ...DEFAULT_PROGRESSION, upgrades: { ...DEFAULT_PROGRESSION.upgrades } };
  }
}

export function saveProgression(prog: Progression): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
}

export function addCredits(amount: number): number {
  const earned = Math.max(0, Math.floor(amount));
  if (earned === 0) return loadProgression().crustCredits;
  const prog = loadProgression();
  prog.crustCredits += earned;
  saveProgression(prog);
  return prog.crustCredits;
}

export function buyUpgrade(id: "deeperJar" | "goldenSpoon"): boolean {
  const prog = loadProgression();

  if (id === "deeperJar") {
    if (prog.crustCredits >= UPGRADE_COSTS.deeperJar) {
      prog.crustCredits -= UPGRADE_COSTS.deeperJar;
      prog.upgrades.deeperJar++;
      saveProgression(prog);
      return true;
    }
  } else if (id === "goldenSpoon") {
    if (prog.crustCredits >= UPGRADE_COSTS.goldenSpoon && !prog.upgrades.goldenSpoon) {
      prog.crustCredits -= UPGRADE_COSTS.goldenSpoon;
      prog.upgrades.goldenSpoon = true;
      saveProgression(prog);
      return true;
    }
  }
  return false;
}
