[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Rank](https://make.fun/badge/gta6-01/embongtuyul/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Reward](https://make.fun/badge/gta6-01/embongtuyul/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![Entries](https://make.fun/badge/gta6-01/embongtuyul/makefun-gta6-01/entries.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMARA — Heat on the Shore

An open-world crime game for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty on make.fun. A sun-soaked coastal city, yours to walk or steal a car through: traffic and pedestrians, a five-star wanted system with police who chase, ram and roadblock, a helicopter with a searchlight, six staged story jobs, combat, a crew with abilities, and a save that remembers it all.

## Play it

Serve `game/` with any static file server and open `game/index.html` in desktop Chrome. No build step, no network requests — three.js is vendored under `game/vendor/`.

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080
```

## What's in the city

- **Solmara** — a procedural golden-hour coastal city: downtown towers, a beach boulevard with palms, a pier, a marina, an airstrip. Six districts, each with its own standing.
- **Drive or walk** — arcade driving with handbrake drifts, nitro boost (Shift), and stunt cash for drifts and near misses. Any car can be stolen (the law notices).
- **Wanted 1–5 stars** — named PD units (KITE-1, CORAL-48, …) with roles — RAMMING, FLANKING, ROADBLOCK, SPOTLIGHT — shown live with distances. Cops shoot back, so heat is dangerous on foot too. The IN SIGHT pill tells you when anyone can see you: break line of sight to cool off, or get busted standing still.
- **Six jobs** — staged missions from Selma the fixer: fares, a stolen coupe, a 3-star heat run, wrecking Silas Kade's Onyx, a boulevard race, and a 5-star run to the airstrip.
- **Combat** — fists, pistol, SMG, shotgun, rifle, with ammo, reloads and raycast hits.
- **Crew** — Dana swaps plates (Z), Bram quick-fixes your car (X), Juno marks every cop on the map (C).
- **HUD** — mission box with stages and a big countdown for timed jobs, police response panel with the IN SIGHT pill, minimap, wanted stars, cash, rank, weapons, speedometer with a nitro gauge, radio, dialogue.
- **Sound** — fully synthesized in WebAudio: engine, sirens, gunshots and three procedural radio stations.
- **Save** — progress auto-saves after every job; continue from the start screen.

## Controls

WASD drive / walk · Shift run / nitro · E enter / exit car · Mouse aim, Click shoot · 1–5 weapons · R reload · Z / X / C crew · Space handbrake · N radio · M mute · P pause · J retry job

## Entry

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` and writes `dossier.json` via `vendor/makefun-game.ts`.

Referral code: `2d73gfpt`
