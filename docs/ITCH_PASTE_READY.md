# itch.io — Men Eat Peanut Butter (copy-paste ready)

*Owner action required: create itch project and upload zip. Agents cannot charge your card or log into itch without your session.*

---

## Project settings

| Field | Value |
|-------|-------|
| **Title** | Men Eat Peanut Butter |
| **URL slug** | `jimmythehat-men-eat-pb` (adjust to taste) |
| **Full URL** | https://subtiliorars.itch.io/jimmythehat-men-eat-pb |
| **Developer name** | JimmyTheHat |
| **Kind** | HTML |
| **Main file** | `index.html` |
| **Viewport** | **800 × 600** (matches Phaser canvas) |
| **Price** | **$5.00 minimum** (or PWYW with $5 default) |
| **Tags** | arcade, casual, comedy, browser, clicker, idle, roguelike, singleplayer |

---

## Short description

> Four men. One jar. Tap to chomp sticky peanut butter blobs before your jaws seal shut. Hungry Hippos energy meets roguelike runs.

---

## Full description

```
MEN EAT PEANUT BUTTER · EARLY ACCESS · JIMMYTHEHAT

A game about men eating peanut butter.

Four dudes at a picnic table. Sticky blobs keep spawning. Tap Carl, Dave, Ben, or Ed
to chomp. Chain hits for FRENZY. Pick a Lunch Modifier each run. Earn Crust Credits.

WHAT YOU GET NOW (v0.1)
• Tap-to-chomp arcade loop on one picnic screen
• Three Lunch Modifiers (Double Chunk, No Napkins, Crust Only)
• Frenzy chains, Stuck Shut fails, jar-empty wins
• End-run playtest feedback button for community notes
• Browser play — no install

EARLY ACCESS NOTE
This is a vertical slice. Juice, meta upgrades, and Table Events are on the roadmap
(WAVES.md). Reviews welcome; volunteer reviewers triage playtest notes.

Also in the JimmyTheHat fleet: Driving Me Nuts, Yes Man, No Is a Complete Sentence.
```

---

## Package & upload

Before packaging, set the direct feedback API and/or the community issue fallback:

```powershell
$env:VITE_PLAYTEST_FEEDBACK_API_URL="https://example.com/feedback"
$env:VITE_PLAYTEST_FEEDBACK_URL="https://github.com/OWNER/men-eat-pb/issues/new?template=playtest-feedback.md"
```

If using the included Worker API, deploy it first (`docs/PLAYTEST_FEEDBACK.md`) and use its `/feedback` endpoint here.

```powershell
cd C:\Users\hrmread\men-eat-pb
.\scripts\package-itchio.ps1
```

Upload `release/men-eat-pb-browser-v0.1.0.zip` → **Uploads** → check **This file will be played in the browser**.

### Set $5 price

1. Edit game → **Pricing** → **Paid** → **$5.00** (or PWYW minimum $5).
2. Save & publish.

### Butler (optional CLI push)

If [butler](https://itch.io/docs/butler/) is installed and `BUTLER_API_KEY` is set:

```powershell
butler push release/men-eat-pb-browser-v0.1.0.zip subtiliorars/jimmythehat-men-eat-pb:browser
```

Create the empty itch project with slug `jimmythehat-men-eat-pb` first in the dashboard.

---

## Cover art (placeholder)

Until commissioned art: use a screenshot from `npm run dev` (Frenzy moment) at 630×500, or regenerate via fleet store-asset scripts when added.
