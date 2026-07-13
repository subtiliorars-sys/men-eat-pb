import type { ModifierId } from "./types.js";

export interface ModifierDef {
  id: ModifierId;
  label: string;
  /** One-line player-facing summary on the start overlay. */
  blurb: string;
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
    blurb: "More crunchy blobs. Frenzy at a 6-chomp chain.",
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
    blurb: "+25% spoons, stickier blobs. Frenzy at an 8-chomp chain.",
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
    blurb: "+50% spoon value, smaller jar. Frenzy at an 8-chomp chain.",
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
