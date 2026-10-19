# Spiro’s Safari Park: 3D edition

A standalone, playable third edition. The accepted design uses the perspective
camera (prototype C), automatic chase/carry framing, rear-mounted cage signs,
and the wooden park. Only two gameplay options remain:

- **Catch: Lasso / By hand**: Space throws in the last movement direction; the
  gold ground arrow shows range and aim. Or walk up to animals to pick them up.
- **Animals: 3D / Paper**: handmade 3D interpretations or original animated
  cutouts. Spiro stays the original paper/photo character in both modes.

Settings are kept in the URL (`?animals=paper&catch=touch`) and can be changed
without restarting. They do not change speed, collisions, or cage assignments.
Switching catch mode mid-reel releases the animal; switching artwork preserves it.
Old camera/zoom query parameters are ignored and removed.

## Play

Run `npm start` at the repository root and open http://localhost:8000/v3/.
Or serve this directory by itself using its own `npm start` command.
No build, runtime CDN, npm dependencies, or references into V1/V2 are required.
Version-navigation links expect sibling directories, but the game does not.
A current WebGL-capable browser is required.

Cage order is shuffled on each new game or restart and stays fixed for the round.
Names, gates, stars, and the animals’ starting homes move together. Read the signs
rather than memorizing where an animal belongs.

Click **Release the animals**, then give them a moment to scatter. Arrow keys /
WASD or click/tap the ground to walk. Space or the on-screen Throw button casts a
lasso. Misses retract; catches reel an animal onto Spiro’s back. Walk into the
matching cage from the field; wrong cages keep the carried animal, and you must
step back before trying again. Return all six to win and play again.

Original recordings play on release, pickup and return. Returns play the animal
before praise (or the final ranger message). Restart cancels pending recordings.
The last gate gets time to close before the victory panel appears. Reduced motion
uses static paper art, stops toy gait and automatic camera tracking, and closes
gates immediately. Background tabs stop simulation and audio; a lost graphics
context shows reload guidance. Mobile supports tap-to-walk and the throw button,
although the park is easier to read on a larger screen.

## Structure and verification

- `game.js`: scene, actors, input, audio, game loop and lifecycle.
- `game-rules.js`: tested options, swept lasso collisions and camera framing.
- `toy-animals.js`: procedural 3D geometry inspired by the original drawings.
- `assets/`: independent original artwork/audio and approved animation copies.
- `vendor/`: pinned Three.js 0.180.0 and its MIT license.
- `test/`: Node regression tests; included in root `npm test`.
- `tools/check-game.mjs`: browser checks; see its header for invocation.

The exploratory source remains on the local `prototype/v3-diorama` branch at
`4991abb`. The accepted direction was promoted separately to main; camera studies,
debug state, preview carrying, manual zoom and other experiment controls are not
part of the playable page. V1/V2 gameplay and the default V2 landing page remain.
GitHub Pages stages this edition’s runtime files and excludes tests and tools.
