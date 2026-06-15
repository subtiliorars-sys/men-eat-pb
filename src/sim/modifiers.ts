import type { ModifierId } from "./types.js";

export interface ModifierDef {
  id: ModifierId;
  label: string;
  crunchyChance: number;
  frenzyThreshold: number;
  spoonMult: number;
  valueMult: number;
  jarMult: number;
  stickyMult: number;
}

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  double: {
    id: "double",
    label: "Double Chunk",
    crunchyChance: 0.35,
    frenzyThreshold: 6,
    spoonMult: 1,
    valueMult: 1,
    jarMult: 1,
    stickyMult: 1,
  },
  napkins: {
    id: "napkins",
    label: "No Napkins",
    crunchyChance: 0.15,
    frenzyThreshold: 8,
    spoonMult: 1.25,
    valueMult: 1,
    jarMult: 1,
    stickyMult: 2,
  },
  crust: {
    id: "crust",
    label: "Crust Only",
    crunchyChance: 0.15,
    frenzyThreshold: 8,
    spoonMult: 1,
    valueMult: 1.5,
    jarMult: 0.7,
    stickyMult: 1,
  },
};

export function modifierDef(id: ModifierId): ModifierDef {
  return MODIFIERS[id];
}
