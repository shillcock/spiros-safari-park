# Enhanced edition (`v2/`)

Serve this directory over HTTP (`npm start`, then http://localhost:8000), or
open the parent project's root URL, which redirects here. The top-right button
opens Original; Original has a matching button to return. No files from the
Original edition or CD-ROM are needed.

## What changed

- Refreshed welcome screen, retaining Spiro's actual hand-drawn lettering and
  animal art, arranged on textured paper with leaves, a sun, and grassy hills.
  Both enhanced cards are dated October 2026; Original retains April 2004.
- Cached, procedurally drawn park background: pencil-like grass, flowers,
  corner trees, and a sandy strip leading to the enclosures.
- Two-leaf cage doors open on escape and close when each animal returns.
  A large, outlined gold star in the middle marks each successfully filled cage.
- Spiro uses the gentler B walking cycle; all six animals keep the livelier
  cycles. Each has 12 frames reusing the original photographic/crayon pixels.
  Spiro walks while moving;
  animals animate while wandering, including inside cages. Idle, carried, and
  reduced-motion sprites use the original still artwork. Pausing freezes frames.
  The illustrated side/back experiments and other prototypes are not included.
- Carried animals always render immediately behind the player, on the back
  side of their facing direction, with a small bob while moving. This affects
  only rendering, not collision geometry or pickup rules.
- No destination arrows or hints: players must read the cage names.
  A successful delivery gives a brief gold border and star burst.
- Pickup plays `gotcha.wav` first, then the species recording, never both at once.
  A cage attempt or restart cancels any remaining pickup sequence. Pickups during
  a protected return recording/praise are skipped, not queued for later.
- On return, the species recording plays again, followed by `good_job.wav`.
  Existing effects stop first; pickup effects do not interrupt this sequence.
  Background music continues. A new return or wrong-cage attempt can interrupt it.
- On the last return, the animal is placed inside immediately. The park stays
  visible for 0.8 seconds to show the door closing, then Spiro jumps and does a
  full flip over 1.2 seconds, followed by a 0.5-second landing pause. Only then
  does the refreshed victory artwork appear, with crayon-colored confetti.
  It matches the title's paper, leaves, and grassy hills, preserving the original
  “Way to Go!” and ranger lettering and surrounding it with the animal drawings.
  Victory narration waits for the final animal recording and praise to finish.
- As `youre_a_ranger.wav` starts, a gold “Spiro’s Safari Park Ranger” star badge
  grows into view and holds. From 6.5 to 8 seconds it shrinks and moves into the
  open space on the right beneath the headline, remaining there as an earned
  reward until replay. The background dimming clears as it docks. This is synced
  to the recording's start, not a
  transcription-derived word timestamp. Replay remains available throughout.
- Reduced-motion preferences remove bobbing, gate animation, the flip, star
  particles, and confetti. The award appears at full size for eight seconds, then
  switches directly to its small docked position without animation. The final
  pause and static completion feedback remain.
  Pause and restart work during the finishing sequence too.

## Deliberate cage entry

Enhanced requires a fresh downward approach from the field to attempt delivery.
The player's feet must cross the cage line; their horizontal center selects one
cage. Sliding along the row, standing still, or holding Down against the boundary
cannot try additional cages. Step back up into the field before another attempt.
This preserves the need to read the labels, without introducing an action button.

Wrong entry plays `wrong_cage.wav` even if pickup audio is still playing: existing
sound effects stop, but music continues. Wrong attempts at occupied cages also
provide feedback.

## Smoother, forgiving animal movement

Animals wander diagonally and ease into new headings rather than snapping between
cardinal directions. Every 45–95 ticks they select a gentle random turn. Within
220 pixels of Spiro's center, their target direction is biased away from him.
That bias strengthens up to 85% within 100 pixels, retaining some wandering
rather than perfect evasion. Steering eases velocity by 10% per tick when far
away, rising to 16% nearby for a more noticeable turn. Boundaries turn them
back into the field.

Each species has a fixed speed across games (pixels per 30 Hz tick):

| Species | Speed | Approx. pixels/second |
| --- | ---: | ---: |
| Elephant | 2.0 | 60 |
| Penguin | 2.2 | 66 |
| Beaver | 2.5 | 75 |
| Monkey | 2.8 | 84 |
| Zebra | 3.1 | 93 |
| Snake | 3.4 | 102 |

All remain below Spiro's 5 (150 px/s); fleeing never boosts speed. Steering
acceleration and direction changes can reduce actual travel speed. Caged animals
wander at 30% of their species speed and do not flee. Walk animations remain at
12 fps; their timing is not coupled to travel speed.
Carried animals continue to follow the player instead of steering.

Opening/escape timing, player movement, pickup collisions, original recordings,
and the six-animal goal are unchanged. Original retains all its old rules.

`presentation.js` owns scenery, rendering, and visual state; `game.js` connects
it to the existing game loop. `walk-animation.js` defines the approved sheets'
frame layout and timing; `assets/animations/` contains only their final PNGs.
Animation padding is purely visual and does not change pickup/delivery geometry.
Species speeds are defined in `game-model.js`. Restart clears all visual state. The background
uses its own seeded generator and is drawn once, not rebuilt every frame.

## Title artwork

- `assets/welcome-handdrawn.png`: preserved source image in this edition.
- `assets/welcome.svg`: self-contained editable composition with embedded PNG
  lettering and animal cutouts (no external file references).
- `assets/welcome.png`: 800 × 600 raster export used at runtime.
- `tools/create-title.py`: generates the SVG from this edition's assets.

To rebuild the SVG: `uv run --with pillow python tools/create-title.py` from
this directory. Export the SVG at 800 × 600 to replace `assets/welcome.png`.
The runtime does not need Python, Pillow, SVG tooling, or any build step.

## Closing artwork

- `assets/way-to-go-handdrawn.png`: preserved original closing card.
- `assets/way_to_go.svg`: self-contained enhanced composition, with embedded art.
- `assets/way_to_go.png`: 800 × 600 runtime export.
- `tools/create-ending.py`: builds the SVG from this edition's original closing
  card, animal assets, and the scenery in `welcome.svg`.

Run `uv run --with pillow python tools/create-ending.py` from this directory,
then export its SVG at 800 × 600. The animated ranger badge is drawn by
`presentation.js`; it is not baked into the closing image.

## Verification

`npm test` runs gameplay and visual-state tests. The root suite also checks the
frozen Original file hashes. Browser checks for this pass covered title loading,
escape, each of the six pickup/delivery pairs, victory, replay, pause/resume,
and mobile layout. Original gameplay and assets remain unchanged; only its
surrounding HTML/CSS navigation was updated with explicit user approval.

`tools/check-finish.mjs` is an optional Playwright browser regression check for
the final gate/flip delay, pause, return audio ordering, victory narration,
badge timing and persistent docking, replay, and reduced motion. With Playwright installed and the root server running:

```sh
node v2/tools/check-finish.mjs
```

Set `BROWSER_EXECUTABLE` to use an installed Chrome, `PLAYWRIGHT_MODULE` to a
Playwright module path/URL outside this repo, or `GAME_URL` for another server.
`tools/check-pickup-audio.mjs` uses the same overrides and checks pickup ordering,
cancellation on return/wrong cage/restart, and protection of return narration.
The game itself still has no runtime package dependencies.
