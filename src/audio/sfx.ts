/**
 * Procedural sound effects for Men Eat Peanut Butter.
 *
 * Everything is synthesised live with the Web Audio API — no asset files are
 * shipped. Safe to import in Node / SSR / tests: all audio work is guarded
 * behind `window` + `AudioContext` checks and becomes a no-op when unavailable
 * or when the player has muted.
 */

const MUTE_KEY = "men-eat-pb-muted";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore — private mode / no storage */
  }
}

export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

let audioCtx: AudioContext | undefined;

/** Shared AudioContext. Returns undefined where Web Audio is unavailable. */
export function audioContext(): AudioContext | undefined {
  if (typeof window === "undefined") return undefined;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return undefined;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** Resume a suspended context (browsers gate audio on a user gesture). */
export function resumeAudio(): void {
  const ac = audioContext();
  if (ac && ac.state === "suspended") void ac.resume();
}

interface Tone {
  type?: OscillatorType;
  /** Start frequency (Hz). */
  freq: number;
  /** Optional end frequency for a glide. */
  toFreq?: number;
  /** Seconds from now to start. */
  at?: number;
  /** Duration in seconds. */
  dur: number;
  /** Peak gain (0..1). */
  gain?: number;
}

function blip({ type = "sine", freq, toFreq, at = 0, dur, gain = 0.16 }: Tone): void {
  const ac = audioContext();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (toFreq && toFreq > 0) {
    osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short filtered noise burst — the "stick" of peanut butter. */
function noiseBurst(dur: number, gain: number, cutoff: number): void {
  const ac = audioContext();
  if (!ac) return;
  const t0 = ac.currentTime;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/**
 * Wet, satisfying chomp. Pitch climbs with the current chain so a long combo
 * feels like a rising musical run; crunchy bites get a brighter crunch.
 */
export function playChomp(chain = 0, crunchy = false): void {
  if (isMuted()) return;
  resumeAudio();
  const step = Math.min(chain, 14);
  const base = 240 + step * 22;
  blip({ type: "triangle", freq: base * 1.5, toFreq: base * 0.6, dur: 0.1, gain: 0.18 });
  blip({ type: "sine", freq: base, toFreq: base * 0.5, dur: 0.13, gain: 0.12 });
  noiseBurst(crunchy ? 0.07 : 0.045, crunchy ? 0.12 : 0.07, crunchy ? 5200 : 2600);
}

/** Dull, sticky squelch for a wasted tap. */
export function playMiss(): void {
  if (isMuted()) return;
  resumeAudio();
  blip({ type: "sawtooth", freq: 150, toFreq: 70, dur: 0.18, gain: 0.1 });
  noiseBurst(0.12, 0.05, 900);
}

/** Bright ascending fanfare when Frenzy kicks in. */
export function playFrenzy(): void {
  if (isMuted()) return;
  resumeAudio();
  const notes = [392, 523.25, 659.25, 783.99]; // G4 C5 E5 G5
  notes.forEach((f, i) => {
    blip({ type: "square", freq: f, at: i * 0.07, dur: 0.16, gain: 0.12 });
  });
}

/** Happy major arpeggio for emptying the jar (the win). */
export function playWin(): void {
  if (isMuted()) return;
  resumeAudio();
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    blip({ type: "triangle", freq: f, at: i * 0.12, dur: 0.28, gain: 0.14 });
  });
}

/** Sad descending two-note sting for Stuck Shut. */
export function playLose(): void {
  if (isMuted()) return;
  resumeAudio();
  blip({ type: "sawtooth", freq: 330, toFreq: 196, dur: 0.32, gain: 0.12 });
  blip({ type: "sine", freq: 220, toFreq: 130, at: 0.16, dur: 0.4, gain: 0.1 });
}

/** Soft warm UI click. */
export function playClick(): void {
  if (isMuted()) return;
  resumeAudio();
  blip({ type: "sine", freq: 520, toFreq: 300, dur: 0.08, gain: 0.12 });
}
