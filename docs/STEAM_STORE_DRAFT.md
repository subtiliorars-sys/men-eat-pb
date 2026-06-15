# Steam store draft — Men Eat Peanut Butter

**Status:** NOT LIVE — requires owner Steamworks partner account + $100 Steam Direct fee per app.

Agents cannot create paid Steam listings, wire banking/tax, or pay Steam Direct on your behalf.

---

## Recommended path (from MeniscusMaximus INDIE_GAME_MARKETING_PLAYBOOK)

| Step | Owner action | Timing |
|------|--------------|--------|
| 1 | Fix + polish chomp loop (MEP-W2 juice) | Before any paid store |
| 2 | **Coming Soon** page + capsule + 4 screenshots | 6+ months before launch ideal |
| 3 | Build wishlists (content creator keys, demo GIF) | Before Next Fest |
| 4 | Set price **$4.99–$5.99** | 3 weeks before launch |
| 5 | Pay **$100 Steam Direct** + tax interview | Once page ready |
| 6 | Ship build via Steamworks depots | After review |

**Note:** Playbook warns idle/arcade above **$5.99** gets genre pushback; **$4.99** is the proven idle band. You asked **≥ $5** — **$4.99** or **$5.99** both work; avoid $6.99+ for this scope.

---

## Store page copy (paste into Steamworks)

### Game name
Men Eat Peanut Butter

### Short description
Four men. One jar. Chomp sticky peanut butter blobs in frantic picnic runs — Hungry Hippos meets roguelike idle.

### About this game

```
Men Eat Peanut Butter is a game about men eating peanut butter.

Pick a Lunch Modifier. Tap Carl, Dave, Ben, or Ed to chomp blobs from the shared
picnic pool. Chain chomps to trigger FRENZY. Don't miss too many times or you'll
get Stuck Shut.

FEATURES (v0.1)
• One-screen arcade chomp loop
• Three run modifiers per picnic
• Short roguelike runs with Crust Credits meta (expanding)
• Absurdist comedy, no spreadsheet

EARLY ACCESS
Vertical slice live; juice, meta shop, and Table Events on the roadmap.
```

### Tags (primary)
Casual, Arcade, Idler, Comedy, 2D, Singleplayer, Indie, Early Access

### Price suggestion
**$4.99 USD** launch (or **$5.99** if you want a round $5+ after Steam regional rounding)

---

## Build checklist (when ready)

- [ ] Steamworks SDK / depot for Windows (browser build wrapped in Electron **or** native Phaser export — TBD)
- [ ] Steam Cloud save for Crust Credits (MEP-W3)
- [ ] Achievement stub (optional)
- [ ] Content survey + age rating (likely Everyone / comic mischief)
- [ ] **`steam_appid.txt` only in dev** — never commit live app id secrets

---

## What we prepared in-repo

- `npm run build` → `dist/` web build (itch-ready today)
- Steam **desktop wrapper** not yet built — browser HTML is not a Steam build by itself. Next engineering wave: Electron shell or Phaser desktop export before Steam upload.

---

## Owner checklist to go live on Steam

1. Log in to https://partner.steamgames.com/
2. **App Admin → Create new app** → pay $100 Steam Direct
3. Paste copy from this doc; upload capsule (630×800) + screenshots
4. Set release state **Coming Soon** first; switch to **Early Access** at launch
5. Upload build via SteamPipe when desktop wrapper exists
6. Set price to **$4.99** or **$5.99** in **Edit Store Page → Pricing**
