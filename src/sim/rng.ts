export interface Rng {
  next(): number;
}

export function createSeededRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x1_0000_0000;
    },
  };
}

export const defaultRng: Rng = { next: () => Math.random() };
