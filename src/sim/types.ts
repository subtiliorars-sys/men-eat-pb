export type ModifierId = "double" | "napkins" | "crust";
export type LocationId = "park" | "beach" | "food_truck" | "backyard";
export type ManId = "Carl" | "Dave" | "Ben" | "Ed";
export type TableEventId = "ants" | "mom_share";

export type RunEndReason = "jar_empty" | "stuck_shut" | null;

export interface Blob {
  id: number;
  x: number;
  y: number;
  size: number;
  crunchy: boolean;
  vx: number;
  vy: number;
}

export interface ManPosition {
  id: ManId;
  x: number;
  y: number;
}

export interface Ant {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number; // Time until theft
}

export interface RunState {
  spoons: number;
  jarMax: number;
  jarLeft: number;
  chain: number;
  missStreak: number;
  frenzy: boolean;
  frenzyTimer: number;
  modifier: ModifierId;
  location: LocationId;
  running: boolean;
  ended: RunEndReason;
  blobs: Blob[];
  ants: Ant[];
  stickyUntil: number;
  spawnTimer: number;
  nextBlobId: number;
  nextAntId: number;
  /** Mid-run table event has been offered (at ~50% jar). */
  eventOffered: boolean;
  /** Player must pick an event before the run continues. */
  eventPending: boolean;
  activeEvent: TableEventId | null;
  eventTimer: number;
  lastChompedMan: ManId | null;
  /** Tutorial practice run — slower spawns, no lose condition */
  tutorialMode: boolean;
}

export interface UpgradeState {
  deeperJar: number; // Level
  goldenSpoon: boolean;
}

export interface Progression {
  crustCredits: number;
  upgrades: UpgradeState;
}

export interface ChompResult {
  hit: boolean;
  value: number;
  ended: RunEndReason;
}

export const MAN_IDS: ManId[] = ["Carl", "Dave", "Ben", "Ed"];

export const CHOMP_REACH = 140;
export const STUCK_SHUT_MISSES = 5;

export const WORLD = {
  width: 800,
  height: 600,
  spawnXMin: 0.28,
  spawnXMax: 0.72,
  spawnYMin: 0.36,
  spawnYMax: 0.58,
  blobBounceXMin: 180,
  blobBounceXMax: 620,
  blobBounceYMin: 210,
  blobBounceYMax: 350,
} as const;

export const MAN_POSITIONS: ManPosition[] = [
  { id: "Carl", x: 280, y: 250 },
  { id: "Dave", x: 520, y: 250 },
  { id: "Ben", x: 280, y: 310 },
  { id: "Ed", x: 520, y: 310 },
];
