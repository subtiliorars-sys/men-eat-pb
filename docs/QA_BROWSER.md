# Browser QA — Phaser / canvas games

Men Eat Peanut Butter renders to **`<canvas>`**, not DOM buttons.
`corps-browser snapshot -i` returns `(no interactive elements)` — that is expected, not a
pass.

## game-provost procedure (canvas)

1. `npm run dev` — note URL (this repo: **http://localhost:5173**, Vite default).
2. `corps-browser open <url>` — wait 3–5s for PicnicScene boot.
3. Screenshot boot state: `corps-browser screenshot %USERPROFILE%\screenshots\mep-boot.png`
4. Click using **game-native coordinates** (800×600) scaled to canvas CSS pixels (see
   `QA_CLICK_MAP.md`).
5. Re-screenshot after each action; assert visible change (overlay dismiss, float text, HUD).
6. `corps-browser close`

### Click helper (PowerShell)

From repo root:

```powershell
.\scripts\browser-qa.ps1 -Action boot-screenshot
.\scripts\browser-qa.ps1 -Action click -Target start-run
.\scripts\browser-qa.ps1 -Action click -Target chomp-man-0
.\scripts\browser-qa.ps1 -Action tutorial-smoke
```

Uses `corps-browser eval` to map game coords → canvas client coords and dispatch pointer
events. Prefer the dev QA bridge for reliable Phaser input (see below).

## Onboarding audit (canvas)

Grep `PicnicScene.ts` for imperatives: **tap, pick, open, chomp**.

| Onboarding step | Copy | Target key (`QA_CLICK_MAP`) |
|-----------------|------|-----------------------------|
| 0 | Pick a lunch modifier (optional) | mod row (manual) |
| 1 | Open the jar | `start-run` |
| 2 | Tap a man to chomp | `chomp-man-0` … `chomp-man-3` |
| 3 | Another jar (after run ends) | `retry` |

Full static checklist: `docs/QA_TUTORIAL_AUDIT.md`.

## When DOM QA applies

Playtest feedback dialog and volunteer admin (`admin.html`): use normal `snapshot -i` +
element refs. Game loop stays on canvas.

## Automated fallback (no browser)

`npm run test` — Vitest unit tests for sim engine, progression, audio stubs, feedback API.
Does **not** replace browser QA for canvas input paths.

## Dev QA bridge (recommended for automation)

When `npm run dev` is running:

- `window.__MEP_GAME__` — Phaser game instance
- `window.__MEP_QA__.flags()` — `running`, `frenzy`, `jarPercent`, overlay visibility, etc.
- `window.__MEP_QA__.click(target)` — invokes the same handlers as UI pointerdown:
  - `start-run` — dismisses start overlay and begins run
  - `chomp-man-0` … `chomp-man-3` — chomps Carl, Dave, Ben, or Ed
  - `retry` — restarts from end overlay ("Another jar")

`npm run qa:browser` runs `tutorial-smoke` via this bridge. Synthetic canvas pointer
events from corps-browser do not reliably reach Phaser interactives; use the bridge for
CI-style gates and keep canvas coords in `QA_CLICK_MAP.md` for manual checks.
