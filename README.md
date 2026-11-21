# Velvet Hour

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/naylafeb/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/naylafeb/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

Dusk over the canal city of Veylport. The Vesper Archive keeps one book that must never be read — the Cinder Ledger — and five wardens who walk its halls with lanterns. Slip past their cones of light, pocket the Ledger and three treasures, and leave through the south door unseen.

A complete top-down stealth game: 5 guards with patrol routes, vision cones and alert states (patrol → stare → chase → search), cover that blocks sight, potted palms to hide in, a detection meter, coin-toss lures, smoke puffs, a live minimap, WebAudio synth sound (footsteps, alert sting, pickup chimes, dusk drone), title / pause / caught / win screens, and a saved best score and best time.

## Play

Serve `game/` with any static server, then open `game/index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request — every file the game loads sits under `game/`.

## Controls

- **WASD / arrows** — move
- **Shift** — sneak (slow, quiet, hard to spot)
- **Click** — walk there
- **E** — toss a coin to lure a nearby warden (3 coins)
- **Q** — smoke puff, breaks every gaze for a few seconds (2 puffs)
- **P / Esc** — pause
- **Space / Enter** — start / restart

## Scoring

- Cinder Ledger: **500**
- Each treasure (Brass Astrolabe, Jade Moth, Ivory Compass): **150**
- Time bonus: up to **600** for a fast escape
- Ghost bonus: **+300** if no warden ever fully spots you

## Files

- `game/src/config.js` — tuning, palette, level layout
- `game/src/level.js` — walls, cover, line of sight, hiding spots
- `game/src/guards.js` — warden AI: patrol, stare, chase, search, investigate
- `game/src/player.js` — movement, coin toss, smoke
- `game/src/audio.js` — WebAudio synth sounds
- `game/src/render.js` — canvas drawing, HUD, minimap, screens
- `game/src/world.js` — the night itself: state and the fixed-step update
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — the autopilot that stages the screenshots
- `game/src/main.js` — boot and the game loop

## Referral

Built for the make.fun bounty — if you enter bounties too, my referral link is https://make.fun/r/nxwnbx2d (code `nxwnbx2d`).
