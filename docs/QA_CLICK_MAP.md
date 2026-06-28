# QA click map — native game coordinates (800×600)

Used by `scripts/browser-qa.ps1` and game-provost canvas clicks. Origin top-left.

| Key | x | y | Expected feedback |
|-----|---|---|-------------------|
| `start-run` | 400 | 425 | Start overlay hides; HUD shows spoons/jar |
| `chomp-man-0` | 280 | 250 | Carl chomps; float text or miss splat |
| `chomp-man-1` | 520 | 250 | Dave chomps |
| `chomp-man-2` | 280 | 310 | Ben chomps |
| `chomp-man-3` | 520 | 310 | Ed chomps |
| `retry` | 490 | 380 | End overlay hides; new run ready |

Coordinates are centers of interactive targets in `PicnicScene` (men heads, overlay buttons).

## Dev QA bridge (automation)

When `npm run dev` is running:

| Target | Handler | Expected flags |
|--------|---------|----------------|
| `start-run` | `qaClickStart()` | `running: true`, `overlayVisible: false` |
| `chomp-man-0` … `chomp-man-3` | `qaClickMan(n)` | jar/spoons change; optional `frenzy: true` |
| `retry` | `qaClickRetry()` | `endOverlayVisible: false`, `overlayVisible: false` |

`npm run qa:browser` runs `tutorial-smoke` using this bridge. Canvas coords above remain for
manual provost checks.

## Adding targets

When adding a new onboarding imperative, add a row here **in the same PR** or game-provost
will FAIL the slice.
