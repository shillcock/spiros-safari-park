# Three.js (local dependency)

Pinned release: **0.180.0**. MIT license; see `THREE-LICENSE.txt`.

Downloaded unmodified from:

- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js
- https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.js
- https://cdn.jsdelivr.net/npm/three@0.180.0/LICENSE

`three.module.js` imports its sibling `three.core.js`. Keeping both here allows
the 3D edition to run without a runtime CDN or an npm build/install step.
