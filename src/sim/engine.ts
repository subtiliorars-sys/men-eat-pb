import { modifierDef } from "./modifiers.js";
import type { Rng } from "./rng.js";
import {
  CHOMP_REACH,
  MAN_POSITIONS,
  WORLD,
  type Blob,
  type ChompResult,
  type ManId,
  type ModifierId,
  type RunEndReason,
  type RunState,
} from "./types.js";

const BASE_SPAWN_DELAY = 1.2;
const DIGESTION_RATE = 0.3;
const FRENZY_DURATION = 10;
const STUCK_SHUT_MISSES = 5;
const STICKY_MS = 3000;

export function createRun(modifier: ModifierId): RunState {
  const mod = modifierDef(modifier);
  const jarMax = Math.floor(100 * mod.jarMult);
  return {
    spoons: 0,
    jarMax,
    jarLeft: jarMax,
    chain: 0,
    missStreak: 0,
    frenzy: false,
    frenzyTimer: 0,
    modifier,
    running: true,
    ended: null,
    blobs: [],
    stickyUntil: 0,
    spawnTimer: 0,
    nextBlobId: 1,
  };
}

export function crustCredits(state: RunState): number {
  return Math.floor(state.spoons / 5);
}

function endRun(state: RunState, reason: RunEndReason): void {
  state.running = false;
  state.ended = reason;
}

function blobValue(blob: Blob, modifier: ModifierId, frenzy: boolean): number {
  const mod = modifierDef(modifier);
  let val = (blob.crunchy ? 3 : 1) * mod.valueMult * mod.spoonMult;
  if (frenzy) val *= 1.5;
  return val;
}

export function nearestBlob(
  state: RunState,
  x: number,
  y: number,
  reach = CHOMP_REACH,
): Blob | null {
  let best: Blob | null = null;
  let bestD = Infinity;
  for (const b of state.blobs) {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best && bestD < reach ? best : null;
}

export function spawnBlob(state: RunState, rng: Rng): Blob {
  const mod = modifierDef(state.modifier);
  const crunchy = rng.next() < mod.crunchyChance;
  const size = crunchy ? 22 + rng.next() * 12 : 28 + rng.next() * 16;
  const x =
    WORLD.width * (WORLD.spawnXMin + rng.next() * (WORLD.spawnXMax - WORLD.spawnXMin));
  const y =
    WORLD.height * (WORLD.spawnYMin + rng.next() * (WORLD.spawnYMax - WORLD.spawnYMin));
  const blob: Blob = {
    id: state.nextBlobId++,
    x,
    y,
    size,
    crunchy,
    vx: (rng.next() - 0.5) * 80,
    vy: (rng.next() - 0.5) * 60,
  };
  state.blobs.push(blob);
  return blob;
}

export function chomp(
  state: RunState,
  manId: ManId,
  nowMs: number,
): ChompResult {
  if (!state.running) {
    return { hit: false, value: 0, ended: state.ended };
  }

  const pos = MAN_POSITIONS.find((m) => m.id === manId);
  if (!pos) {
    return { hit: false, value: 0, ended: null };
  }

  const blob = nearestBlob(state, pos.x, pos.y);
  if (!blob) {
    state.chain = 0;
    state.missStreak++;
    state.stickyUntil = nowMs + STICKY_MS * modifierDef(state.modifier).stickyMult;
    if (state.missStreak >= STUCK_SHUT_MISSES) {
      endRun(state, "stuck_shut");
      return { hit: false, value: 0, ended: "stuck_shut" };
    }
    return { hit: false, value: 0, ended: null };
  }

  state.missStreak = 0;
  state.chain++;
  const val = blobValue(blob, state.modifier, state.frenzy);
  state.spoons += val;
  state.jarLeft = Math.max(0, state.jarLeft - val * 0.8);
  state.blobs = state.blobs.filter((b) => b.id !== blob.id);

  const mod = modifierDef(state.modifier);
  if (state.chain >= mod.frenzyThreshold && !state.frenzy) {
    state.frenzy = true;
    state.frenzyTimer = FRENZY_DURATION;
  }

  if (state.jarLeft <= 0) {
    endRun(state, "jar_empty");
    return { hit: true, value: val, ended: "jar_empty" };
  }

  return { hit: true, value: val, ended: null };
}

export function tick(state: RunState, dt: number, nowMs: number, rng: Rng): void {
  if (!state.running) return;

  state.spoons += DIGESTION_RATE * dt;
  state.jarLeft = Math.max(0, state.jarLeft - DIGESTION_RATE * dt * 0.3);

  if (state.frenzy) {
    state.frenzyTimer -= dt;
    if (state.frenzyTimer <= 0) {
      state.frenzy = false;
      state.chain = 0;
    }
  }

  const sticky = nowMs < state.stickyUntil;
  const delay = (state.frenzy ? BASE_SPAWN_DELAY * 0.5 : BASE_SPAWN_DELAY) * (sticky ? 1.4 : 1);
  state.spawnTimer += dt;
  if (state.spawnTimer >= delay) {
    state.spawnTimer = 0;
    spawnBlob(state, rng);
  }

  for (const b of state.blobs) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < WORLD.blobBounceXMin || b.x > WORLD.blobBounceXMax) b.vx *= -1;
    if (b.y < WORLD.blobBounceYMin || b.y > WORLD.blobBounceYMax) b.vy *= -1;
  }

  if (state.jarLeft <= 0 && state.running) {
    endRun(state, "jar_empty");
  }
}

export function frenzyRemaining(state: RunState): number {
  return state.frenzy ? Math.ceil(state.frenzyTimer) : 0;
}

export function frenzyThreshold(state: RunState): number {
  return modifierDef(state.modifier).frenzyThreshold;
}

export function jarPercent(state: RunState): number {
  return Math.max(0, (state.jarLeft / state.jarMax) * 100);
}
