# Men Eat Peanut Butter

Roguelike idle arcade toy — four men, one jar, sticky peanut butter blobs.
Tap to chomp. Short runs, modifier picks, Crust Credits meta (stub).

**Design docs (MeniscusMaximus):** [GAME_IDEAS.md #7](https://github.com/subtiliorars-sys/MeniscusMaximus/blob/master/GAME_IDEAS.md) · [MEN_EAT_PB_SLICE.md](https://github.com/subtiliorars-sys/MeniscusMaximus/blob/master/MEN_EAT_PB_SLICE.md)

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run verify   # tsc + tests + build
```

## Controls

1. Pick a **Lunch modifier** on the start overlay.
2. Tap **Carl, Dave, Ben, or Ed** to chomp the nearest blob.
3. Chain chomps → **Frenzy**. Five misses → **Stuck Shut**. Empty jar → win.

## Stack

Phaser 3 + TypeScript + Vite. Game logic lives in `src/sim/` (unit-tested).

## Status

Vertical slice v0.1 — chomp loop, three modifiers, Frenzy, run end screens.
Next waves: juice/SFX, meta upgrades, Table Events (`WAVES.md`).
