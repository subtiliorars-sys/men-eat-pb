import { tableEventDef } from "./events.js";
import { modifierDef } from "./modifiers.js";
import { loadProgression } from "./progression.js";
import type { Rng } from "./rng.js";
import {
  CHOMP_REACH,
  MAN_POSITIONS,
  STUCK_SHUT_MISSES,
  WORLD,
  type Blob,
  type ChompResult,
  type ManId,
  type ModifierId,
  type RunEndReason,
  type RunState,
  type TableEventId,
} from "./types.js";

const BASE_SPAWN_DELAY = 1.2;
const DIGESTION_RATE = 0.3;
const FRENZY_DURATION = 10;
const STICKY_MS = 3000;
const MAX_BLOBS = 30;
const EVENT_JAR_THRESHOLD = 50;

export function createRun(modifier: ModifierId): RunState {
  const mod = modifierDef(modifier);
  const prog = loadProgression();
  const jarMax = Math.floor(100 * mod.jarMult * (1 + prog.upgrades.deeperJar * 0.25));
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
    ants: [],
    stickyUntil: 0,
    spawnTimer: 0,
    nextBlobId: 1,
    nextAntId: 1,
    eventOffered: false,
    eventPending: false,
    activeEvent: null,
    eventTimer: 0,
    lastChompedMan: null,
  };
}

export function crustCredits(state: RunState): number {
  return Math.floor(state.spoons / 5);
}

function endRun(state: RunState, reason: RunEndReason): void {
  state.running = false;
  state.ended = reason;
}

function eventValueMult(state: RunState, manId: ManId): number {
  if (state.activeEvent !== "mom_share") return 1;
  if (state.lastChompedMan === null || state.lastChompedMan !== manId) return 1.5;
  return 0.5;
}

function eventSpawnMult(state: RunState): number {
  if (state.activeEvent === "ants") return 0.5;
  return 1;
}

function blobValue(blob: Blob, state: RunState, manId: ManId): number {
  const mod = modifierDef(state.modifier);
  const prog = loadProgression();
  let val = (blob.crunchy ? 3 : 1) * mod.valueMult * mod.spoonMult;
  if (prog.upgrades.goldenSpoon) val *= 1.2;
  val *= eventValueMult(state, manId);
  if (state.frenzy) val *= 1.5;
  if (state.activeEvent === "ants") val *= 1.5;
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
  if (state.blobs.length >= MAX_BLOBS) {
    state.blobs.shift();
  }
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
  if (!state.running || state.eventPending) {
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
  const val = blobValue(blob, state, manId);
  state.spoons += val;
  state.jarLeft = Math.max(0, state.jarLeft - val * 0.8);
  state.blobs = state.blobs.filter((b) => b.id !== blob.id);
  state.lastChompedMan = manId;

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

export function spawnAnt(state: RunState, rng: Rng): void {
  const x = rng.next() < 0.5 ? 0 : WORLD.width;
  const y = rng.next() * WORLD.height;
  state.ants.push({
    id: state.nextAntId++,
    x,
    y,
    vx: (x === 0 ? 1 : -1) * (40 + rng.next() * 40),
    vy: (rng.next() - 0.5) * 40,
    timer: 5 + rng.next() * 5,
  });
}

export function clickAnt(state: RunState, antId: number): boolean {
  const initialCount = state.ants.length;
  state.ants = state.ants.filter((a) => a.id !== antId);
  return state.ants.length < initialCount;
}

function maybeOfferEvent(state: RunState, jarLeftBefore: number): void {
  if (state.eventOffered || state.eventPending) return;
  const prevPct = (jarLeftBefore / state.jarMax) * 100;
  const pct = jarPercent(state);
  if (prevPct > EVENT_JAR_THRESHOLD && pct <= EVENT_JAR_THRESHOLD) {
    state.eventOffered = true;
    state.eventPending = true;
    state.running = false;
  }
}

export function startTableEvent(state: RunState, eventId: TableEventId): void {
  if (!state.eventPending) return;
  const def = tableEventDef(eventId);
  state.eventPending = false;
  state.activeEvent = eventId;
  state.eventTimer = def.duration;
  state.running = true;
  state.lastChompedMan = null;
}

export function tick(state: RunState, dt: number, nowMs: number, rng: Rng): void {
  if (!state.running) return;

  const jarLeftBefore = state.jarLeft;
  state.spoons += DIGESTION_RATE * dt;
  state.jarLeft = Math.max(0, state.jarLeft - DIGESTION_RATE * dt * 0.3);

  if (state.activeEvent) {
    state.eventTimer -= dt;
    if (state.eventTimer <= 0) {
      state.activeEvent = null;
      state.eventTimer = 0;
      state.lastChompedMan = null;
    }
  }

  if (state.frenzy) {
    state.frenzyTimer -= dt;
    if (state.frenzyTimer <= 0) {
      state.frenzy = false;
      state.chain = 0;
    }
  }

  const sticky = isSticky(state, nowMs);
  const delay =
    (state.frenzy ? BASE_SPAWN_DELAY * 0.5 : BASE_SPAWN_DELAY) *
    (sticky ? 1.4 : 1) *
    eventSpawnMult(state);
  state.spawnTimer += dt;
  if (state.spawnTimer >= delay) {
    state.spawnTimer = 0;
    spawnBlob(state, rng);

    if (rng.next() < 0.1) {
      spawnAnt(state, rng);
    }
  }

  for (const b of state.blobs) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < WORLD.blobBounceXMin || b.x > WORLD.blobBounceXMax) b.vx *= -1;
    if (b.y < WORLD.blobBounceYMin || b.y > WORLD.blobBounceYMax) b.vy *= -1;
  }

  for (const a of state.ants) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.timer -= dt;
    if (a.timer <= 0) {
      const stealAmount = 5;
      state.spoons = Math.max(0, state.spoons - stealAmount);
      a.timer = 9999;
    }
  }
  state.ants = state.ants.filter((a) => a.timer < 9000);

  maybeOfferEvent(state, jarLeftBefore);

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

export function isSticky(state: RunState, nowMs: number): boolean {
  return nowMs < state.stickyUntil;
}

export function stickyRemaining(state: RunState, nowMs: number): number {
  return isSticky(state, nowMs) ? Math.ceil((state.stickyUntil - nowMs) / 1000) : 0;
}

export function missesUntilStuck(state: RunState): number {
  return Math.max(0, STUCK_SHUT_MISSES - state.missStreak);
}

export function eventRemaining(state: RunState): number {
  return state.activeEvent ? Math.ceil(state.eventTimer) : 0;
}
