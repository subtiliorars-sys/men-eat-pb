# Browser QA — Men Eat Peanut Butter

Men Eat Peanut Butter renders to **`<canvas>`**.

## game-provost procedure (canvas)

1. `npm run dev` — note URL (usually **http://localhost:5173**).
2. `corps-browser open <url>`
3. Screenshot boot state: `corps-browser screenshot %USERPROFILE%\screenshots\mep-boot.png`
4. Click using **game-native coordinates** (800×600) scaled to canvas CSS pixels.
5. `corps-browser close`

## Dev QA bridge

When `npm run dev` is running:

- `window.__MEP_GAME__` — Phaser game instance
- `window.__MEP_QA__.flags()` — run status, frenzy, jar percent
- `window.__MEP_QA__.click(target)` — invokes UI handlers:
  - `start-run` — starts the run from overlay
  - `chomp-man-0` — chomps man 0
  - `chomp-man-1` — chomps man 1
  - `chomp-man-2` — chomps man 2
  - `chomp-man-3` — chomps man 3
  - `retry` — restarts after run ends

`npm run qa:browser` runs `tutorial-smoke` via this bridge.
