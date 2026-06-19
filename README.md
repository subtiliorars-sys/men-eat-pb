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

1. **First visit:** follow the step-by-step tutorial (or tap *Replay tutorial* on the start screen).
2. Pick a **location** (Park, Beach, Food Truck Row, Backyard BBQ) and a **lunch modifier**.
3. Tap **Carl, Dave, Ben, or Ed** to chomp the nearest blob.
4. Chain chomps → **Frenzy**. Five misses → **Stuck Shut**. Empty jar → win.
5. After a run, click **Send feedback** to open the community playtest intake with the run summary attached.

## Community playtesting

Configure the playtest intake before a public build:

```bash
cp .env.example .env.local
# Optional direct API:
# VITE_PLAYTEST_FEEDBACK_API_URL=https://example.com/api/feedback
# Optional issue/form fallback:
# VITE_PLAYTEST_FEEDBACK_URL=https://github.com/OWNER/men-eat-pb/issues/new?template=playtest-feedback.md
npm run build
```

Volunteer review UI:

```bash
npm run dev:admin      # local admin.html
npm run build:admin    # dist-admin/
```

Optional feedback API:

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev:api
```

Volunteer moderation uses `playtest`, `pending-review`, `approved`, `denied`, and `needs-info` labels. See `docs/PLAYTEST_FEEDBACK.md` for the full review workflow.

Recruiting/playtest operations:

- `docs/COMMUNITY_PLAYTEST_LAUNCH.md` - staged launch runbook.
- `docs/OUTREACH_COPY.md` - copy/paste posts for social, Discord, itch, Reddit, and recaps.
- `docs/VOLUNTEER_REVIEWER_GUIDE.md` - reviewer onboarding and triage SOP.

## Stack

Phaser 3 + TypeScript + Vite. Game logic lives in `src/sim/` (unit-tested).

## Status

Vertical slice v0.1 — chomp loop, three modifiers, Frenzy, run end screens.
Next waves: juice/SFX, meta upgrades, Table Events (`WAVES.md`).
