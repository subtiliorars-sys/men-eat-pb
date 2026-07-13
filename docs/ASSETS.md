# Shared game assets (agents â€” read this first)

**Stop drawing colored boxes / procedural placeholders** when free art already lives
in the house asset libraries.

## Canonical libraries

| Kind | Repo | Use for |
|------|------|---------|
| **2D visuals** | https://github.com/subtiliorars-sys/game-visual-assets | Sprites, tiles, UI chrome, particles |
| **Audio** | https://github.com/subtiliorars-sys/game-audio-assets | UI/SFX, impact, RPG cues |
| **3D** | https://github.com/subtiliorars-sys/game-3d-assets | GLTF/OBJ kits, modular environments |

Also indexed in `neural-network` â†’ `connectome/repos.yaml`
(`game-visual-assets`, `game-audio-assets`, `game-3d-assets`).

## Agent rules

1. **Before** inventing placeholder rectangles or sine-wave beeps, check the
   libraries above (and their `vendor/kenney/` + `catalog/FREE_SOURCES.md`).
2. Copy needed files into this gameâ€™s `public/assets` / `assets` (do **not**
   npm-link entire asset repos into the game bundle).
3. Keep third-party **ATTRIBUTION** / CC0 notices (see each libraryâ€™s
   `ATTRIBUTION.md`). Prefer **CC0** only.
4. Do **not** pull brand vaults (`MeniscusMaximus---Media`, `Ilerioluwa-Media`)
   for gameplay art â€” those are private brand media.
5. Do **not** copy commercial IP (Zelda sprites, Academy â€œGuardian of Goalâ€ art,
   copyrighted whale recordings, etc.).

## Suggested starter packs for this title

See the â€œSuggested mappingâ€ sections in each library README, then pick the
Kenney packs that match genre (platformer / sports / RPG / space / â€¦).

## Fetch more packs

From a library clone:

```powershell
pwsh scripts/fetch-kenney.ps1 -Slug <kenney-slug>
```

Then update that libraryâ€™s `ATTRIBUTION.md` before committing.

