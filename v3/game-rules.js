// Geometry-independent rules shared by the renderer and its tests.
export const LASSO_RANGE = 5;
export const SCATTER_SECONDS = 2.8;

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function readOptions(search) {
  const params = new URLSearchParams(search);
  return { animalStyle: params.get('animals') === 'paper' ? 'paper' : 'toys',
    catchMode: params.get('catch') === 'touch' ? 'touch' : 'lasso' };
}

export function optionsQuery(animalStyle, catchMode) {
  return `?${new URLSearchParams({ animals: animalStyle, catch: catchMode })}`;
}

// Test the whole distance travelled this frame, not just the loop's final point.
export function findLassoCatch(animals, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z, lengthSquared = dx * dx + dz * dz;
  let first = null, firstAlong = Infinity;
  for (const animal of animals) {
    if (animal.state !== 'free') continue;
    const p = animal.group.position;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.z - from.z) * dz) / lengthSquared)) : 0;
    const distance = Math.hypot(p.x - from.x - t * dx, p.z - from.z - t * dz);
    if (distance < .85 && t < firstAlong) { first = animal; firstAlong = t; }
  }
  return first;
}

export function cameraFraming({ released, won, runTime, carrying, player, reducedMotion,
  mobile = false, overview = false, aspect = 1 }) {
  const wide = { x: 0, z: -.5, zoom: 1 };
  if (!released || won || runTime <= SCATTER_SECONDS) return wide;
  if (mobile) {
    if (overview) return wide;
    // Follow the player, never a chosen animal or destination. Near any cage,
    // look slightly ahead so its rear sign and Spiro fit in the same view.
    const approach = Math.max(0, Math.min(1, (-player.z - .5) / 3));
    return { x: player.x * .95, z: player.z - .4 - approach * 1.8,
      zoom: aspect < 1.15 ? 2.25 : 1.55 };
  }
  if (reducedMotion) return wide;
  if (carrying) return { x: player.x * .18, z: -1.2, zoom: 1.08 };
  return { x: Math.max(-5, Math.min(5, player.x * .55)),
    z: Math.max(-2, Math.min(3, player.z * .45)), zoom: 1.35 };
}
