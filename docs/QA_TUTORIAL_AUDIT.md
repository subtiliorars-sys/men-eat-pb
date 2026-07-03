# Tutorial audit — Men Eat Peanut Butter (STAGED)

Static game-provost checklist for onboarding copy and QA bridge targets. **No formal
step-by-step tutorial** exists yet; this audit covers the start overlay imperatives and
smoke-test path. Document pass/fail without blocking ship.

Audit date: 2026-06-28  
Source: `src/scenes/PicnicScene.ts`, `scripts/browser-qa.ps1`, `src/main.ts`

## Imperative grep (`PicnicScene.ts`)

| Copy / imperative | Location | QA target | Bridge | Pass |
|-------------------|----------|-----------|--------|------|
| "Pick a lunch modifier, then tap a man to chomp." | Start overlay subtitle | (manual: mod buttons ~y 290) | — | **PARTIAL** — copy present; no bridge target for modifier pick |
| Modifier labels (`Double`, `Napkins`, `Crust`) | Start overlay | canvas click mod row | — | **STAGED** — not in smoke; default `double` selected |
| "Open the jar" | Start button | `start-run` | `qaClickStart()` | **PASS** — smoke asserts `running: true` |
| Tap man head to chomp | In-run men (Carl–Ed) | `chomp-man-0` … `3` | `qaClickMan(n)` | **PASS** — smoke chomps man 0 |
| "Another jar" | End overlay retry | `retry` | `qaClickRetry()` | **STAGED** — bridge exists; not in tutorial-smoke |
| "Send feedback" | End overlay | — | — | **STAGED** — opens DOM dialog; out of canvas smoke scope |
| Click ants during invasion | Mid-run event | — | — | **STAGED** — `clickAnt` in sim; no QA bridge target |

## Smoke sequence (`npm run qa:browser`)

| Step | Action | Expected | Result |
|------|--------|----------|--------|
| 0 | Dev server up (`npm run dev`) | canvas + `__MEP_GAME__` | **PASS** (documented) |
| 1 | `start-run` via bridge | `running: true` | **PASS** |
| 2 | `chomp-man-0` via bridge | flags show jar/spoons delta | **PASS** (observable in flags JSON) |

## Gaps (non-blocking)

1. **No staged tutorial UI** — single subtitle vs multi-step coach marks (Driving Me Nuts pattern).
2. **Modifier selection** — not covered by `tutorial-smoke`; default modifier is acceptable for gate.
3. **Run-to-end + retry** — extend smoke when run duration is bounded for CI.
4. **Ant invasion** — add `click-ant-0` bridge when event QA is prioritized.

## Ethics check

- No forced wait timers in onboarding copy.
- No dark-pattern CTAs on start/end overlays.
- Feedback prompt is optional ("Community playtesters can send notes…"); not required to continue.

## Verdict

**STAGED PASS** — onboarding imperatives map to QA bridge for core loop (start → chomp).
Modifier pick, run end, retry, and table events remain documented gaps for a future tutorial wave.
