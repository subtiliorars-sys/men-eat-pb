import type { LocationId } from "./types.js";

export interface LocationTheme {
  id: LocationId;
  label: string;
  blurb: string;
  sky: number;
  ground: number;
  table: number;
  tableBorder: number;
  /** Slightly tweak spawn zone per venue for variety */
  spawnXMin: number;
  spawnXMax: number;
  spawnYMin: number;
  spawnYMax: number;
}

export const LOCATIONS: Record<LocationId, LocationTheme> = {
  park: {
    id: "park",
    label: "Park Picnic",
    blurb: "Classic grassy knoll. Steady blob flow.",
    sky: 0x87ceeb,
    ground: 0x7cb87c,
    table: 0xdeb887,
    tableBorder: 0x8b6914,
    spawnXMin: 0.28,
    spawnXMax: 0.72,
    spawnYMin: 0.36,
    spawnYMax: 0.58,
  },
  beach: {
    id: "beach",
    label: "Beach Boardwalk",
    blurb: "Sandy shore. Blobs drift a little wider.",
    sky: 0x5eb3d6,
    ground: 0xe8d4a8,
    table: 0xc9a66b,
    tableBorder: 0x8b6914,
    spawnXMin: 0.24,
    spawnXMax: 0.76,
    spawnYMin: 0.34,
    spawnYMax: 0.6,
  },
  food_truck: {
    id: "food_truck",
    label: "Food Truck Row",
    blurb: "Urban lunch rush. Crunchy blobs show up more often.",
    sky: 0x6b7b8c,
    ground: 0x4a4a4a,
    table: 0x9e9e9e,
    tableBorder: 0x333333,
    spawnXMin: 0.3,
    spawnXMax: 0.7,
    spawnYMin: 0.38,
    spawnYMax: 0.56,
  },
  backyard: {
    id: "backyard",
    label: "Backyard BBQ",
    blurb: "Cozy evening cookout. Slower, gentler blobs.",
    sky: 0xffb347,
    ground: 0x5a8f4a,
    table: 0x8b4513,
    tableBorder: 0x5c3317,
    spawnXMin: 0.32,
    spawnXMax: 0.68,
    spawnYMin: 0.37,
    spawnYMax: 0.57,
  },
};

export const LOCATION_IDS: LocationId[] = ["park", "beach", "food_truck", "backyard"];

export function locationDef(id: LocationId): LocationTheme {
  return LOCATIONS[id];
}

/** Crunchy spawn boost for food truck row */
export function locationCrunchyBonus(id: LocationId): number {
  return id === "food_truck" ? 0.08 : 0;
}

/** Blob speed multiplier — backyard is calmer for new players */
export function locationBlobSpeedMult(id: LocationId): number {
  if (id === "backyard") return 0.65;
  if (id === "beach") return 0.9;
  return 1;
}
