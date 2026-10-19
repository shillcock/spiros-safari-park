import { SPECIES, SIZES } from './game-model.js';

// Padding is art-only: the original actor dimensions remain the collision box.
export const WALK_LAYOUTS = Object.freeze({
  guide: Object.freeze({ width: 96, height: 168, padX: 16, padY: 8 }),
  ...Object.fromEntries(SPECIES.map((name, index) => [name, Object.freeze({
    width: SIZES[index][0] + 24,
    height: SIZES[index][1] + 24,
    padX: 12, padY: 12,
  })])),
});
export const WALK_FRAMES = 12;
export const WALK_FPS = 12;

export function walkFrame(name, seconds) {
  const layout = WALK_LAYOUTS[name];
  if (!layout || !Number.isFinite(seconds)) return null;
  const index = Math.floor(Math.max(0, seconds) * WALK_FPS) % WALK_FRAMES;
  return {
    sx: index * layout.width, sy: 0,
    sw: layout.width, sh: layout.height,
    dx: -layout.padX, dy: -layout.padY,
    dw: layout.width, dh: layout.height,
  };
}
