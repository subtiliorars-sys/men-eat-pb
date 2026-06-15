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
  stickyUntil: number;
  spawnTimer: number;
  nextBlobId: number;
}

export interface ChompResult {
  hit: boolean;
  value: number;
  ended: RunEndReason;
}

export const MAN_IDS: ManId[] = ["Carl", "Dave", "Ben", "Ed"];

export const CHOMP_REACH = 120;

export const WORLD = {
  width: 800,
  height: 600,
  spawnXMin: 0.25,
  spawnXMax: 0.75,
  spawnYMin: 0.32,
  spawnYMax: 0.6,
  blobBounceXMin: 40,
  blobBounceXMax: 760,
  blobBounceYMin: 192,
  blobBounceYMax: 360,
} as const;

export const MAN_POSITIONS: ManPosition[] = [
  { id: "Carl", x: 72, y: 72 },
  { id: "Dave", x: 728, y: 72 },
  { id: "Ben", x: 72, y: 528 },
  { id: "Ed", x: 728, y: 528 },
];
