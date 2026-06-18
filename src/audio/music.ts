/**
 * Procedural background music for Men Eat Peanut Butter.
 *
 * A small Web-Audio step sequencer: a walking bass line under a bouncy
 * picnic-y melody in C major. No audio files — every note is synthesised.
 * Uses the standard look-ahead scheduling pattern (a setInterval that queues
 * notes a little ahead of the audio clock) so timing stays tight.
 *
 * Honours the shared mute flag and is a no-op when Web Audio is unavailable
 * (Node / SSR / tests).
 */
import { audioContext, isMuted, resumeAudio } from "./sfx.js";

// Sixteen-step patterns (one bar). 0 = rest. Frequencies in Hz.
const C = 261.63;
const BASS: number[] = [
  C / 2, 0, C / 2, 0, // C
  196 / 2, 0, 196 / 2, 0, // G
  220 / 2, 0, 220 / 2, 0, // A
  174.61 / 2, 0, 196 / 2, 0, // F -> G
];
const MELODY: number[] = [
  C * 2, 0, 329.63 * 2, 0, // C5 E5
  392 * 2, 392 * 2, 0, 329.63 * 2, // G5 G5 . E5
  349.23 * 2, 0, 392 * 2, 0, // F5 G5
  329.63 * 2, 293.66 * 2, C * 2, 0, // E5 D5 C5
];

let timer: ReturnType<typeof setInterval> | undefined;
let step = 0;
let nextNoteTime = 0;
let frenzy = false;
let masterGain: GainNode | undefined;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

function stepDuration(): number {
  // ~112 bpm sixteenths, accelerating into Frenzy.
  const sixteenth = 60 / 112 / 4;
  return frenzy ? sixteenth * 0.7 : sixteenth;
}

function voice(freq: number, dur: number, when: number, type: OscillatorType, gain: number): void {
  const ac = audioContext();
  if (!ac || !masterGain) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function scheduleStep(stepIndex: number, when: number): void {
  const dur = stepDuration();
  const bass = BASS[stepIndex];
  if (bass) voice(bass, dur * 1.8, when, "triangle", frenzy ? 0.1 : 0.08);
  const mel = MELODY[stepIndex];
  if (mel) voice(mel, dur * 1.5, when, "square", frenzy ? 0.06 : 0.045);
}

function scheduler(): void {
  const ac = audioContext();
  if (!ac) return;
  while (nextNoteTime < ac.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step % 16, nextNoteTime);
    nextNoteTime += stepDuration();
    step = (step + 1) % 16;
  }
}

/** Start (or restart) the loop. Call from a user gesture so audio can play. */
export function startMusic(): void {
  if (isMuted()) return;
  const ac = audioContext();
  if (!ac) return;
  resumeAudio();
  if (!masterGain) {
    masterGain = ac.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ac.destination);
  }
  if (timer) return; // already playing
  step = 0;
  nextNoteTime = ac.currentTime + 0.08;
  timer = setInterval(scheduler, LOOKAHEAD_MS);
}

export function stopMusic(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  frenzy = false;
}

export function setMusicFrenzy(on: boolean): void {
  frenzy = on;
}

export function isMusicPlaying(): boolean {
  return timer !== undefined;
}
