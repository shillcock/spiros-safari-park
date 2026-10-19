# Spiro’s Safari Park

Two independent browser editions of the April 2004 game, using Spiro’s original
drawings, player cut-out, and recordings.

## Play

```sh
npm start
```

Open **http://localhost:8000** to go straight to Enhanced at `/v2/`. Original
lives at `/v1/`. The UI keeps the names Original and Enhanced. Enhanced's top-right
**Play Original** button opens Original, which has a **Play Enhanced** button
for switching back. There is no chooser or wrapper page.

Original preserves the first working browser version. Enhanced adds a refreshed
title and closing screens, textured park scenery, animated cage doors, consistent carrying,
large completion stars, and smoother animal wandering with gentle fleeing.
Return recordings play clearly before praise. The last gate closes and Spiro does
a victory flip before the end screen, confetti, and animated ranger award. Reduced-motion preferences
disable decorative animations. Original recordings and opening timings remain.

Arrow keys / WASD or touch controls move the player. Animals escape at 16 seconds;
catching begins at 23 seconds. Touch an animal to carry it to the matching cage.
In Enhanced, walk downward from the field into a cage to attempt delivery;
sideways sliding does not count. Step back up before trying again.
Return all six to win. P / Escape pauses; toolbar buttons mute and restart.

Python 3 serves static files only. The game runs entirely in JavaScript, with no
build step or npm dependencies. Any static HTTP server works; `file://` does not.

## Independent editions

```text
index.html                    Redirect to Enhanced (no shared game code or assets)
v1/                           Original: preserved first working browser game
  index.html, style.css
  game.js, game-model.js
  assets/                     Complete independent image/audio/font copies
  test/, package.json
v2/                           Enhanced: independent copy; make improvements here
  index.html, style.css
  game.js, game-model.js, presentation.js
  assets/, tools/
  test/, package.json
 test/                        Original snapshot checksum guard
 recovery/                    Historical decompilation and behavior notes
 archive/                     Verified ZIP of the original CD-ROM directory
```

**Do not change `v1/` when improving Enhanced.** The editions share no
runtime files, assets, imports, or settings. Either directory can be copied and
served by itself. Each also supports `npm start` and `npm test` from its own
directory. A future 3D edition can live in another self-contained directory and
get its own navigation link. Version links require both sibling directories;
the games themselves still run independently.

The original includes all existing browser conveniences (pause, replay, WASD,
touch controls, status line) and quirks at the point it was frozen. Its gameplay,
assets, and tests are unchanged. The surrounding HTML/CSS now includes a
user-authorized version-switch button; no wrapper or game-logic changes were needed.

`test/original-checksums.json` records the original snapshot. The root test suite
checks file contents and file names against it so accidental changes are caught.
Enhanced's presentation tests cover doors, carrying/layering, effects, replay,
and reduced motion. Only the HTML/CSS entries in the Original checksum baseline
were updated for the explicitly approved navigation change; every other original
file was verified against the prior baseline. Do not regenerate this baseline
just to accommodate Enhanced development.

## Assets and publishing

Publish the root redirect and both edition directories on any static website.
Neither edition depends on `CD_ROM/`, `recovery/`, or `archive/`. The original
CD-ROM directory is preserved in `archive/spiros-safari-park-original-cd-2004.zip`
with a checksum and restoration instructions in `archive/README.md`. The loose
copy was removed after verifying all 61 files. Extract the ZIP to recreate the
ignored `CD_ROM/` directory if you want to rerun `recovery/recover.py`.
The archive does not need to be published with the playable site.

Both editions retain the original recordings and animal art, including the unused
`art.png` drawing sheet for preservation. Original converts the cage image’s green
color key to transparency; Enhanced draws animated gates instead. Enhanced's title
is a new composition of the original lettering and animal drawings; its original
welcome image is preserved as `v2/assets/welcome-handdrawn.png`. The editable
composition is `v2/assets/welcome.svg`, built by `v2/tools/create-title.py`. Before public distribution, check
permission for the bundled Arial Black font and background music; redistribution
rights have not been established.

## Tests

```sh
npm test
```

Uses Node’s built-in test runner, running both editions’ gameplay tests plus the
original-preservation guard. Individual gameplay suites cover timing, movement,
carrying, cage delivery, confinement, and victory.

See `recovery/README.md` for the historical reconstruction and recovered rules.
