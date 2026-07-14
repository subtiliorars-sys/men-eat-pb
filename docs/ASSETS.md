# Shared game assets (agents — read this first)

**Stop drawing colored boxes / procedural placeholders** when free art already lives
in the house asset libraries.

## Canonical libraries

| Kind | Repo | Use for |
|------|------|---------|
| **2D visuals** | https://github.com/subtiliorars-sys/game-visual-assets | Sprites, tiles, UI chrome, particles |
| **Audio** | https://github.com/subtiliorars-sys/game-audio-assets | UI/SFX, impact, RPG cues |
| **3D** | https://github.com/subtiliorars-sys/game-3d-assets | GLTF/OBJ kits, modular environments |
| **Textures / PBR** | https://github.com/subtiliorars-sys/game-texture-assets | ambientCG + Poly Haven 1K |

Also indexed in `neural-network` → `connectome/repos.yaml`
(`game-visual-assets`, `game-audio-assets`, `game-3d-assets`, `game-texture-assets`).

## Agent rules

1. **Before** inventing placeholder rectangles or sine-wave beeps, check the
   libraries above (and their `vendor/kenney/` + `catalog/FREE_SOURCES.md`).
2. Copy needed files into this game’s `public/assets` / `assets` (do **not**
   npm-link entire asset repos into the game bundle).
3. Keep third-party **ATTRIBUTION** / CC0 notices (see each library’s
   `ATTRIBUTION.md`). Prefer **CC0** only.
4. Do **not** pull brand vaults (`MeniscusMaximus---Media`, `Ilerioluwa-Media`)
   for gameplay art — those are private brand media.
5. Do **not** copy commercial IP (Zelda sprites, Academy “Guardian of Goal” art,
   copyrighted whale recordings, etc.).

## Suggested starter packs for this title

See the “Suggested mapping” sections in each library README, then pick the
Kenney packs that match genre (platformer / sports / RPG / space / …).

## Fetch more packs

From a library clone:

```powershell
pwsh scripts/fetch-kenney.ps1 -Slug <kenney-slug>
```

Then update that library’s `ATTRIBUTION.md` before committing.

