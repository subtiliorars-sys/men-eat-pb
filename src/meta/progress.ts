/**
 * Persistent meta progression — Crust Credits and picnic-table upgrades.
 * Stored in localStorage; safe no-op when storage is unavailable.
 */

export type UpgradeId = "deeperJar" | "goldenSpoon";

export interface UpgradeDef {
  id: UpgradeId;
  label: string;
  description: string;
  cost: number;
  maxLevel: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  deeperJar: {
    id: "deeperJar",
    label: "Deeper Jar I",
    description: "+15% jar size — more PB to chomp",
    cost: 8,
    maxLevel: 1,
  },
  goldenSpoon: {
    id: "goldenSpoon",
    label: "Golden Spoon",
    description: "+10% spoon value on every chomp",
    cost: 12,
    maxLevel: 1,
  },
};

export interface MetaState {
  crustCredits: number;
  upgrades: Record<UpgradeId, number>;
}

const STORAGE_KEY = "men-eat-pb-meta";

const DEFAULT_META: MetaState = {
  crustCredits: 0,
  upgrades: { deeperJar: 0, goldenSpoon: 0 },
};

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_META, upgrades: { ...DEFAULT_META.upgrades } };
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return {
      crustCredits: typeof parsed.crustCredits === "number" ? parsed.crustCredits : 0,
      upgrades: {
        deeperJar: parsed.upgrades?.deeperJar ?? 0,
        goldenSpoon: parsed.upgrades?.goldenSpoon ?? 0,
      },
    };
  } catch {
    return { ...DEFAULT_META, upgrades: { ...DEFAULT_META.upgrades } };
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* private mode / quota */
  }
}

export function addCrustCredits(amount: number): MetaState {
  const meta = loadMeta();
  meta.crustCredits += Math.max(0, amount);
  saveMeta(meta);
  return meta;
}

export function upgradeLevel(id: UpgradeId): number {
  return loadMeta().upgrades[id];
}

export function canBuyUpgrade(id: UpgradeId): boolean {
  const def = UPGRADES[id];
  const meta = loadMeta();
  return meta.upgrades[id] < def.maxLevel && meta.crustCredits >= def.cost;
}

export function buyUpgrade(id: UpgradeId): { ok: boolean; meta: MetaState; reason?: string } {
  const def = UPGRADES[id];
  const meta = loadMeta();
  if (meta.upgrades[id] >= def.maxLevel) {
    return { ok: false, meta, reason: "maxed" };
  }
  if (meta.crustCredits < def.cost) {
    return { ok: false, meta, reason: "insufficient" };
  }
  meta.crustCredits -= def.cost;
  meta.upgrades[id]++;
  saveMeta(meta);
  return { ok: true, meta };
}

/** Jar size multiplier from owned upgrades. */
export function jarUpgradeMult(): number {
  const level = upgradeLevel("deeperJar");
  return 1 + level * 0.15;
}

/** Spoon value multiplier from owned upgrades. */
export function spoonUpgradeMult(): number {
  const level = upgradeLevel("goldenSpoon");
  return 1 + level * 0.1;
}

/** Hints shown on the run-end screen for affordable locked upgrades. */
export function unlockHints(): string[] {
  const meta = loadMeta();
  const hints: string[] = [];
  for (const def of Object.values(UPGRADES)) {
    if (meta.upgrades[def.id] < def.maxLevel && meta.crustCredits >= def.cost) {
      hints.push(`${def.label} unlocked — buy it before your next jar!`);
    } else if (meta.upgrades[def.id] < def.maxLevel) {
      const need = def.cost - meta.crustCredits;
      hints.push(`${def.label}: ${need} more Crust Credit${need === 1 ? "" : "s"}`);
    }
  }
  return hints;
}
