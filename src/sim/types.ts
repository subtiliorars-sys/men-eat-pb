export type ModifierId = "double" | "napkins" | "crust";
export type ManId = "Carl" | "Dave" | "Ben" | "Ed";

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
  running: boolean;
  ended: RunEndReason;
  blobs: Blob[];
  ants: Ant[];
  stickyUntil: number;
  spawnTimer: number;
  nextBlobId: number;
  nextAntId: number;
}

export interface UpgradeState {
  deeperJar: number; // Level
  goldenSpoon: boolean;
}

export interface Progression {
  totalCredits: number;
  upgrades: UpgradeState;
}

export interface ChompResult {
  hit: boolean;
  value: number;
  ended: RunEndReason;
}

export const MAN_IDS: ManId[] = ["Carl", "Dave", "Ben", "Ed"];

export const CHOMP_REACH = 140;

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
