// Standalone 3D edition. Phone framing follows closely with an overview shortcut.
// The only game options are catching method and animal artwork.
import * as THREE from './vendor/three.module.js';
import { createToyAnimal } from './toy-animals.js';
import { readOptions, optionsQuery, findLassoCatch, cameraFraming, shuffled, LASSO_RANGE, SCATTER_SECONDS } from './game-rules.js';

const SPECIES = [
  { name: 'beaver', w: 66, h: 100, height: 2.1, speed: 1.85 },
  { name: 'elephant', w: 100, h: 74, height: 2.3, speed: 1.5 },
  { name: 'monkey', w: 84, h: 100, height: 2.1, speed: 2.1, facesRight: true },
  { name: 'penguin', w: 72, h: 100, height: 1.9, speed: 1.65, facesRight: true },
  { name: 'snake', w: 46, h: 100, height: 2, speed: 2.55 },
  { name: 'zebra', w: 100, h: 65, height: 2.2, speed: 2.3 },
];
let { animalStyle, catchMode } = readOptions(location.search);
const facing = new THREE.Vector3(0, 0, -1);
let lasso = null, rope, loop, aimGuide;
let followZoom = 1, overview = false;
const mobileLayout = matchMedia('(max-width: 650px), (pointer: coarse) and (max-width: 1000px)');
const followCenter = new THREE.Vector3(0, .2, -.5);
const cameraBase = new THREE.Vector3();
const viewport = document.querySelector('#viewport');
const status = document.querySelector('#status');
const loading = document.querySelector('#loading');
let renderer, scene, camera, ground, player, animals = [], cages = [];
let released = false, won = false, elapsed = 0, runTime = 0, carrying = null;
let clickTarget = null, currentAudio = null, flashUntil = 0, winTime = 0;
let ready = false, lastTime = 0;
let audioGeneration = 0;
const keys = new Set();
const loader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const cameraRight = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const asset = name => new URL(`assets/${name}`, import.meta.url).href;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
let seed = 2004;
function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }

function texture(draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}
function material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 1, ...options }); }
function mesh(geometry, mat, parent = scene) {
  const object = new THREE.Mesh(geometry, mat); object.castShadow = true; object.receiveShadow = true;
  parent.add(object); return object;
}
const geometry = {};
function box(w, h, d, mat, x, y, z, parent = scene) {
  const key = `${w},${h},${d}`;
  geometry[key] ??= new THREE.BoxGeometry(w, h, d);
  const result = mesh(geometry[key], mat, parent); result.position.set(x, y, z); return result;
}
function roundedShape(w, h, radius) {
  const x = -w / 2, y = -h / 2, s = new THREE.Shape();
  s.moveTo(x + radius, y); s.lineTo(x + w - radius, y);
  s.quadraticCurveTo(x + w, y, x + w, y + radius); s.lineTo(x + w, y + h - radius);
  s.quadraticCurveTo(x + w, y + h, x + w - radius, y + h); s.lineTo(x + radius, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - radius); s.lineTo(x, y + radius);
  s.quadraticCurveTo(x, y, x + radius, y); return s;
}
function signTexture(text, large = false) {
  return texture((c, w, h) => {
    c.fillStyle = '#f7e9b9'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 14); c.fill();
    c.strokeStyle = '#9c8052'; c.lineWidth = 6; c.stroke();
    c.fillStyle = '#3c5134'; c.font = `bold ${text.length > 10 ? 58 : large ? 94 : 76}px Georgia`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(text, w / 2, h / 2 + 3, w - 50);
    c.fillStyle = '#b49b69'; c.beginPath(); c.arc(18, h / 2, 5, 0, Math.PI * 2); c.arc(w - 18, h / 2, 5, 0, Math.PI * 2); c.fill();
  }, 512, 128);
}
function makeSign(text, width = 3.3, height = .82, fixedBoard = false) {
  const map = signTexture(text);
  const sign = fixedBoard
    ? new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide }))
    : new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, depthWrite: false }));
  if (!fixedBoard) sign.scale.set(width, height, 1);
  sign.userData.desktopMap = map;
  sign.userData.mobileMap = text.length <= 10 ? signTexture(text, true) : map;
  scene.add(sign); return sign;
}
const starMap = texture((c, w, h) => {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * .21 : w * .45;
    const x = w / 2 + Math.cos(angle) * r, y = h / 2 + Math.sin(angle) * r;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath(); c.fillStyle = '#ffe085'; c.fill(); c.strokeStyle = '#9a7236'; c.lineWidth = 6; c.stroke();
}, 128, 128);

function buildPark() {
  const board = mesh(new THREE.ExtrudeGeometry(roundedShape(29, 21, 1.1), {
    depth: .6, bevelEnabled: true, bevelSize: .13, bevelThickness: .12, bevelSegments: 2, steps: 1,
  }), [material('#c2a67b'), material('#b69a72')]);
  board.rotation.x = -Math.PI / 2; board.position.y = -.75;
  const grass = texture((c, w, h) => {
    c.fillStyle = '#aac180'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = i % 2 ? '#c7d29725' : '#77985e12'; c.beginPath();
      c.ellipse(random() * w, random() * h, 30 + random() * 90, 12 + random() * 35, random(), 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const x = random() * w, y = random() * h;
      c.strokeStyle = i % 2 ? '#f4e8b42c' : '#597b4020'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + random() * 7 - 3, y - random() * 7); c.stroke();
    }
  }, 1024, 768);
  ground = mesh(new THREE.ShapeGeometry(roundedShape(28.5, 20.5, 1.1)), material('#ffffff', { map: grass }));
  // ShapeGeometry's UVs are in shape units, so normalize them to the texture.
  const uv = ground.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 14.25) / 28.5, (uv.getY(i) + 10.25) / 20.5);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const table = mesh(new THREE.PlaneGeometry(200, 200), material('#dce5cf'));
  table.rotation.x = -Math.PI / 2; table.position.y = -.93; table.castShadow = false;
  // A sandy approach strip makes the gates easier to read spatially.
  const path = mesh(new THREE.PlaneGeometry(25.2, 2.1), material('#dccb9b'));
  path.rotation.x = -Math.PI / 2; path.position.set(0, .025, -3.8); path.castShadow = false;
  const pathGrain = material('#bfa77c');
  for (let i = 0; i < 100; i++) {
    const pebble = mesh(new THREE.SphereGeometry(.025 + random() * .025, 5, 3), pathGrain);
    pebble.position.set((random() - .5) * 25, .04, -4.7 + random() * 1.7); pebble.scale.y = .3; pebble.castShadow = false;
  }
  const wood = material('#b5915c'), darkWood = material('#8b704c');
  SPECIES.forEach((species, i) => cages.push(buildCage(species, -10 + i * 4, wood, darkWood)));
  const title = makeSign('SPIRO’S SAFARI PARK', 9, 1.4, true); title.position.set(0, 3.8, -9.2);
  box(.17, 3.8, .17, darkWood, -4.3, 1.8, -9.25);
  box(.17, 3.8, .17, darkWood, 4.3, 1.8, -9.25);
  // Corner vegetation stays outside the playable area; it is not a hidden obstacle.
  for (const [x, z, scale] of [[-13,-8,1.25],[13,-8,1.1],[-13,1,1],[13,3,1.1],[-12,8.5,.8],[12.8,8,.8]]) tree(x, z, scale);
  const rockMat = material('#a8ad96');
  for (const [x, z] of [[-12.8,-3],[13,-1],[-12.8,5],[12.6,6],[-8,9],[8.5,9]]) {
    const rock = mesh(new THREE.DodecahedronGeometry(.4 + random() * .25), rockMat);
    rock.position.set(x, .2, z); rock.scale.set(1.2, .65, .85); rock.rotation.y = random() * 3;
  }
  const stalk = material('#6e8d4d'), petal = material('#e7bc60');
  for (let i = 0; i < 32; i++) {
    const side = i % 2 ? -1 : 1, x = side * (11.7 + random()), z = -1 + random() * 10;
    const stem = mesh(new THREE.CylinderGeometry(.018, .025, .24, 4), stalk); stem.position.set(x, .13, z);
    const flower = mesh(new THREE.IcosahedronGeometry(.09, 0), petal); flower.position.set(x, .28, z);
  }
}
function tree(x, z, scale) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); scene.add(group);
  const trunkMat = material('#94754e');
  const trunk = mesh(new THREE.CylinderGeometry(.12, .23, 2.2, 7), trunkMat, group); trunk.position.y = 1.1; trunk.rotation.z = -.08;
  const branch = mesh(new THREE.CylinderGeometry(.08, .12, 1.3, 6), trunkMat, group); branch.position.set(.35, 1.8, 0); branch.rotation.z = -.65;
  for (const [cx, cy, cz, radius, color] of [[0,2.45,0,1.15,'#729850'],[-.7,2.35,0,.8,'#87a75d'],[.75,2.6,.1,.95,'#91af66'],[.1,2.8,-.4,.85,'#a1b873']]) {
    const crown = mesh(new THREE.IcosahedronGeometry(radius, 1), material(color), group);
    crown.position.set(cx, cy, cz); crown.scale.y = .48;
  }
}
function buildCage(species, x, wood, darkWood) {
  const group = new THREE.Group(); group.position.set(x, 0, -6.7); scene.add(group);
  const floor = box(3.6, .07, 3.4, material('#c3b682'), 0, .03, 0, group); floor.castShadow = false;
  for (const px of [-1.8, 1.8]) for (const pz of [-1.7, 1.7]) box(.14, 1.5, .14, darkWood, px, .75, pz, group);
  for (const height of [.45, 1.05, 1.38]) {
    box(3.6, .09, .1, wood, 0, height, -1.7, group);
    for (const side of [-1, 1]) box(.1, .09, 3.4, wood, side * 1.8, height, 0, group);
  }
  for (const side of [-1, 1]) for (const z of [-.85, 0, .85]) box(.08, 1.2, .08, wood, side * 1.8, .7, z, group);
  const doors = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(side * 1.8, 0, 1.7); group.add(hinge);
    const middle = -side * .88;
    for (const height of [.35, 1.25]) box(1.76, .1, .1, wood, middle, height, 0, hinge);
    for (const t of [.06, .6, 1.15, 1.7]) box(.08, 1, .08, wood, -side * t, .8, 0, hinge);
    box(.09, .18, .11, darkWood, -side * 1.63, .8, .03, hinge);
    doors.push({ hinge, side });
  }
  // Physical nameboards on the rear fence, not camera-facing floating labels.
  for (const px of [-1.4, 1.4]) box(.13, 2.8, .13, darkWood, px, 1.4, -1.7, group);
  const nameboard = box(3.4, .92, .14, darkWood, 0, 2.35, -1.7, group);
  const sign = makeSign(species.name, 3.3, .82, true);
  sign.position.set(x, 2.35, -8.32);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starMap }));
  star.position.set(x, 1.05, -4.77); star.scale.set(.55, .55, 1); star.visible = false; scene.add(star);
  return { name: species.name, x, z: -6.7, open: 0, target: 0, doors, star, group, sign, nameboard };
}
async function createActor(config) {
  const [still, walk] = await Promise.all([
    loader.loadAsync(asset(`${config.name}.png`)), loader.loadAsync(asset(`animations/${config.name}-walk.png`)),
  ]);
  const padX = config.name === 'guide' ? 16 : 12, padY = config.name === 'guide' ? 8 : 12;
  const fw = walk.image.width / 12, fh = walk.image.height;
  const idle = texture(c => c.drawImage(still.image, padX, padY), fw, fh);
  still.dispose(); walk.colorSpace = THREE.SRGBColorSpace; walk.repeat.set(1 / 12, 1);
  walk.magFilter = THREE.LinearFilter; walk.minFilter = THREE.LinearMipmapLinearFilter;
  const group = new THREE.Group(); scene.add(group);
  const scale = config.height / config.h;
  const mat = new THREE.MeshBasicMaterial({ map: idle, side: THREE.DoubleSide, alphaTest: .35 });
  const card = mesh(new THREE.PlaneGeometry(fw * scale, fh * scale), mat, group);
  card.position.y = (padY + config.h - fh / 2) * scale;
  card.receiveShadow = false;
  card.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: idle, alphaTest: .35, side: THREE.DoubleSide });
  const shadowTex = texture((c, w, h) => {
    const gradient = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, '#273d2c55'); gradient.addColorStop(1, '#273d2c00'); c.fillStyle = gradient; c.fillRect(0, 0, w, h);
  }, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(.8, config.w * scale), .65),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .055; group.add(shadow);
  let toy = null;
  if (config.name !== 'guide') {
    toy = createToyAnimal(config.name);
    const bounds = new THREE.Box3().setFromObject(toy.root);
    toy.root.scale.setScalar(config.height / (bounds.max.y - bounds.min.y));
    group.add(toy.root);
  }
  return { ...config, group, card, idle, walk, shadow, toy, state: 'locked', vx: 0, vz: 0,
    heading: random() * Math.PI * 2, turn: 1, moving: false, right: true, phase: random() };
}
function applyCamera() {
  for (const cage of cages) {
    cage.sign.material.map = mobileLayout.matches ? cage.sign.userData.mobileMap : cage.sign.userData.desktopMap;
    cage.sign.material.needsUpdate = true;
    cage.sign.scale.y = cage.nameboard.scale.y = mobileLayout.matches ? 1.2 : 1;
  }
  updateViewButton();
  const width = viewport.clientWidth, height = viewport.clientHeight, aspect = width / height;
  camera = new THREE.PerspectiveCamera(43, aspect, .1, 150);
  const distance = Math.max(1, 1.35 / aspect);
  camera.position.set(11 * distance, 19 * distance, 24 * distance);
  cameraBase.copy(camera.position);
  updateFollowCamera(0);
  camera.updateMatrixWorld();
  camera.getWorldDirection(cameraForward); cameraForward.y = 0; cameraForward.normalize();
  cameraRight.crossVectors(cameraForward, UP).normalize();
  renderer.setSize(width, height);
}
// Gentle framing only: never selects or points at an animal's correct cage.
function updateFollowCamera(dt) {
  const frame = cameraFraming({ released, won, runTime, carrying,
    player: player.group.position, reducedMotion, mobile: mobileLayout.matches,
    overview, aspect: camera.aspect });
  const target = new THREE.Vector3(frame.x, .2, frame.z), targetZoom = frame.zoom;
  const blend = reducedMotion ? 1 : 1 - Math.exp(-dt * 1.5);
  followCenter.lerp(target, blend);
  followZoom += (targetZoom - followZoom) * blend;
  camera.position.copy(cameraBase).add(new THREE.Vector3(followCenter.x, 0, followCenter.z + .5));
  camera.lookAt(followCenter);
  camera.zoom = followZoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
function setStatus(text, seconds = 0) { status.textContent = text; flashUntil = elapsed + seconds; }
function stopSound() {
  audioGeneration++;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}
function sound(...names) {
  stopSound();
  const generation = audioGeneration;
  function next() {
    if (generation !== audioGeneration || !names.length) return;
    const audio = new Audio(asset(`${names.shift()}.wav`)); currentAudio = audio;
    audio.volume = .8; audio.onended = next;
    audio.play().catch(() => {});
  }
  next();
}
function reset() {
  cancelLasso(); facing.set(0, 0, -1);
  released = false; won = false; runTime = 0; carrying = null; clickTarget = null; keys.clear();
  stopSound(); winTime = 0; overview = false; updateViewButton();
  document.querySelector('#victory').hidden = true;
  player.group.position.set(0, 0, 4.5); player.moving = false;
  cages = shuffled(cages);
  cages.forEach((cage, i) => {
    cage.x = -10 + i * 4;
    cage.group.position.x = cage.sign.position.x = cage.star.position.x = cage.x;
  });
  animals.forEach(a => {
    const cage = cages.find(c => c.name === a.name);
    a.state = 'locked'; a.group.position.set(cage.x, 0, cage.z);
    a.moving = false; a.vx = a.vz = 0;
  });
  cages.forEach(c => { c.target = 0; c.open = 0; c.star.visible = false; });
  document.querySelector('#release').disabled = false;
  document.querySelector('#score').textContent = 'Six animals, six homes';
  setStatus('Welcome to the little park. Release the animals when you’re ready.');
}
function release() {
  if (released) return;
  released = true; runTime = 0;
  animals.forEach(a => {
    const cage = cages.find(c => c.name === a.name);
    a.state = 'free'; a.group.position.set(cage.x, 0, -4.35);
    a.heading = Math.PI / 2 + (random() - .5) * .8; a.turn = 1.6; a.vx = 0; a.vz = a.speed;
  });
  cages.forEach(c => { c.target = 1; });
  document.querySelector('#release').disabled = true;
  setStatus('The gates are open! Give them a moment to scatter…', SCATTER_SECONDS); sound('escaped');
}
function pickUp(animal) {
  carrying = animal; animal.state = 'carried'; animal.moving = false;
  setStatus(`Carrying the ${animal.name}. Read the signs and walk into its gate.`); sound(animal.name);
}
function cancelLasso() {
  if (lasso?.animal) { lasso.animal.state = 'free'; lasso.animal.group.position.y = 0; }
  lasso = null;
  if (rope) rope.visible = loop.visible = false;
}
function throwLasso() {
  if (!ready) return;
  if (!released) { setStatus('Click Release the animals first, then press Space to throw.', 2); return; }
  if (won) return;
  if (catchMode !== 'lasso') { setStatus('Switch Catch to Lasso to throw, or touch an animal in Touch mode.', 2); return; }
  if (carrying) { setStatus('You’re already carrying an animal. Take it home first.', 2); return; }
  if (runTime < SCATTER_SECONDS) { setStatus('Let them scatter for a moment, then your lasso is ready!', SCATTER_SECONDS - runTime); return; }
  if (lasso) return;
  lasso = { origin: player.group.position.clone(), direction: facing.clone(), distance: 0, phase: 'out', animal: null, time: 0 };
  setStatus('Let’s see who we can catch!', 1);
}
function updateLasso(dt) {
  if (!lasso) return;
  const cast = lasso;
  const tip = cast.origin.clone().addScaledVector(cast.direction, cast.distance);
  if (cast.phase === 'out') {
    const previous = tip.clone();
    cast.distance = Math.min(LASSO_RANGE, cast.distance + dt * 8);
    tip.copy(cast.origin).addScaledVector(cast.direction, cast.distance);
    const hit = findLassoCatch(animals, previous, tip);
    if (hit) {
      cast.animal = hit; cast.animal.state = 'reeled'; cast.animal.moving = false;
      cast.start = cast.animal.group.position.clone(); cast.phase = 'reel'; cast.time = 0;
      setStatus(`Got the ${cast.animal.name}!`, .7);
    } else if (cast.distance >= LASSO_RANGE) { cast.phase = 'back'; setStatus('Missed! Face an animal and try again.', 1.5); }
  } else if (cast.phase === 'back') {
    cast.distance = Math.max(0, cast.distance - dt * 15);
    tip.copy(cast.origin).addScaledVector(cast.direction, cast.distance);
    if (cast.distance === 0) { cancelLasso(); return; }
  }
  if (cast.phase === 'reel') {
    cast.time += dt;
    const t = Math.min(1, cast.time / .55), eased = t * t * (3 - 2 * t);
    const destination = player.group.position.clone(); destination.y = 1.75;
    cast.animal.group.position.lerpVectors(cast.start, destination, eased);
    tip.copy(cast.animal.group.position);
    if (t === 1) {
      const animal = cast.animal; cast.animal = null; cancelLasso(); pickUp(animal); return;
    }
  }
  const hand = player.group.position.clone(); hand.y += 1.25;
  tip.y += .7;
  const midpoint = hand.clone().lerp(tip, .5); midpoint.y -= .22;
  const positions = rope.geometry.attributes.position;
  [hand, midpoint, tip].forEach((p, i) => positions.setXYZ(i, p.x, p.y, p.z));
  positions.needsUpdate = true; rope.geometry.computeBoundingSphere();
  [[hand, midpoint], [midpoint, tip]].forEach(([a, b], i) => {
    const strand = rope.children[i], delta = b.clone().sub(a);
    strand.position.copy(a).lerp(b, .5);
    strand.scale.y = delta.length();
    if (delta.lengthSq() > .000001) strand.quaternion.setFromUnitVectors(UP, delta.normalize());
  });
  loop.position.copy(tip); loop.scale.setScalar(cast.phase === 'reel' ? .65 : 1);
  rope.visible = loop.visible = true;
}
function update(dt) {
  elapsed += dt;
  if (released && !won) runTime += dt;
  const previousZ = player.group.position.z;
  const direction = new THREE.Vector3();
  if (!won) {
    if (keys.has('up')) direction.add(cameraForward);
    if (keys.has('down')) direction.sub(cameraForward);
    if (keys.has('right')) direction.add(cameraRight);
    if (keys.has('left')) direction.sub(cameraRight);
    if (direction.lengthSq()) clickTarget = null;
    else if (clickTarget) {
      direction.subVectors(clickTarget, player.group.position); direction.y = 0;
      if (direction.length() < .15) { clickTarget = null; direction.set(0, 0, 0); }
    }
  }
  player.moving = direction.lengthSq() > 0;
  if (player.moving) {
    direction.normalize(); facing.copy(direction); player.group.position.addScaledVector(direction, dt * 4.4);
    const across = direction.dot(cameraRight); if (Math.abs(across) > .1) player.right = across > 0;
  }
  player.group.position.x = clamp(player.group.position.x, -12.3, 12.3);
  player.group.position.z = clamp(player.group.position.z, -5.08, 8.5);
  if (clickTarget && Math.abs(player.group.position.z + 5.08) < .01) clickTarget = null;
  for (const animal of animals) {
    if (animal.state === 'free' && !won) {
      animal.turn -= dt;
      if (animal.turn < 0) { animal.turn = 1.8 + random() * 2; animal.heading += (random() - .5) * 2.2; }
      let dx = Math.cos(animal.heading), dz = Math.sin(animal.heading);
      const ax = animal.group.position.x - player.group.position.x, az = animal.group.position.z - player.group.position.z;
      const distance = Math.hypot(ax, az), flee = clamp((4.5 - distance) / 3, 0, .8);
      if (distance > .01) { dx = dx * (1 - flee) + ax / distance * flee; dz = dz * (1 - flee) + az / distance * flee; }
      const length = Math.hypot(dx, dz) || 1, blend = 1 - Math.exp(-dt * 4);
      animal.vx += (dx / length * animal.speed - animal.vx) * blend;
      animal.vz += (dz / length * animal.speed - animal.vz) * blend;
      animal.group.position.x += animal.vx * dt; animal.group.position.z += animal.vz * dt;
      if (Math.abs(animal.group.position.x) > 12.5) { animal.heading = Math.PI - animal.heading; animal.vx *= -.5; }
      if (animal.group.position.z < -4.3 || animal.group.position.z > 8.4) { animal.heading = -animal.heading; animal.vz *= -.5; }
      animal.group.position.x = clamp(animal.group.position.x, -12.5, 12.5);
      animal.group.position.z = clamp(animal.group.position.z, -4.3, 8.4);
      animal.moving = true;
      const across = animal.vx * cameraRight.x + animal.vz * cameraRight.z;
      if (Math.abs(across) > .1) animal.right = across > 0;
    } else animal.moving = false;
  }
  if (released && !won && runTime > SCATTER_SECONDS) {
    if (!carrying && catchMode === 'touch') {
      const animal = animals.find(a => a.state === 'free' && a.group.position.distanceTo(player.group.position) < .9);
      if (animal) pickUp(animal);
    }
    if (carrying && previousZ >= -4.8 && player.group.position.z < -4.8) {
      const cage = cages.find(c => Math.abs(c.x - player.group.position.x) < 1.8);
      if (cage && cage.name === carrying.name) {
        const returned = carrying.name;
        carrying.state = 'home'; carrying.group.position.set(cage.x, 0, cage.z); carrying = null;
        cage.target = 0; cage.star.visible = true;
        setStatus('Home safe! Find another animal.', 1.5);
        if (animals.every(a => a.state === 'home')) {
          won = true; player.moving = false; winTime = elapsed;
          sound(returned, 'youre_a_ranger'); setStatus('All six are home. You’re a Safari Park Ranger!');
        } else sound(returned, 'good_job');
      } else if (cage) { sound('wrong_cage'); setStatus('That’s the wrong cage. Step back and read the signs.', 2); }
    }
  }
  updateLasso(dt);
  aimGuide.visible = catchMode === 'lasso' && released && !won && !carrying && !lasso && runTime >= SCATTER_SECONDS;
  aimGuide.position.copy(player.group.position); aimGuide.position.y = .13;
  aimGuide.setDirection(facing);
  if (carrying) {
    const away = new THREE.Vector3().subVectors(player.group.position, camera.position); away.y = 0; away.normalize();
    carrying.group.position.copy(player.group.position).addScaledVector(away, .3).addScaledVector(cameraRight, player.right ? -.35 : .35);
    carrying.group.position.y = 1.75 + (player.moving && !reducedMotion ? Math.sin(elapsed * 12) * .035 : 0);
    carrying.right = player.right;
  }
  for (const cage of cages) {
    const step = reducedMotion ? 1 : Math.min(1, dt * 3);
    cage.open += (cage.target - cage.open) * step;
    cage.doors.forEach(({ hinge, side }) => { hinge.rotation.y = -side * cage.open * Math.PI * .48; });
  }
  for (const actor of [player, ...animals]) {
    const position = actor.group.position;
    actor.card.rotation.y = Math.atan2(camera.position.x - position.x, camera.position.z - position.z);
    actor.card.scale.x = actor.right === !!actor.facesRight ? 1 : -1;
    const animate = actor.moving && !reducedMotion;
    const map = animate ? actor.walk : actor.idle;
    if (actor.card.material.map !== map) {
      actor.card.material.map = map; actor.card.material.needsUpdate = true;
      actor.card.customDepthMaterial.map = map; actor.card.customDepthMaterial.needsUpdate = true;
    }
    actor.walk.offset.x = Math.floor((elapsed + actor.phase) * 12) % 12 / 12;
    actor.shadow.visible = actor.state !== 'carried';
    if (actor.toy) {
      actor.card.visible = animalStyle === 'paper';
      actor.toy.root.visible = animalStyle === 'toys';
      if (actor.moving) {
        const target = Math.atan2(actor.vx, actor.vz);
        const angle = actor.toy.root.rotation.y;
        actor.toy.root.rotation.y += Math.atan2(Math.sin(target - angle), Math.cos(target - angle)) * Math.min(1, dt * 8);
      } else if (actor.state !== 'carried') actor.toy.root.rotation.y = 0;
      actor.toy.animate(elapsed + actor.phase, actor.moving, reducedMotion);
    }
  }
  const home = animals.filter(a => a.state === 'home').length;
  document.querySelector('#score').textContent = !released ? 'Six animals, six homes' : `${home} / 6 safely home${carrying ? ` · carrying ${carrying.name}` : ''}`;
  if (released && !won && !carrying && !lasso && elapsed > flashUntil) setStatus(catchMode === 'lasso'
    ? `Aim the gold arrow with your movement, then ${mobileLayout.matches ? 'tap Throw lasso' : 'press Space'} to throw. The arrow shows your range.`
    : 'Touch an animal, then walk into its named gate.');
  document.querySelector('#throw').disabled = !released || won || !!carrying || !!lasso || runTime < SCATTER_SECONDS;
  document.querySelector('#view-toggle').disabled = !released || won;
  if (won && elapsed - winTime > 1.2) document.querySelector('#victory').hidden = false;
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (lastTime || now)) / 1000, .05); lastTime = now;
  if (!ready) return;
  if (!document.hidden) update(dt);
  updateFollowCamera(dt);
  renderer.render(scene, camera);
}
async function start() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', 'Safari park. Use arrow keys or click the ground to walk.');
  viewport.prepend(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#dce5cf'); scene.fog = new THREE.Fog('#dce5cf', 65, 130);
  scene.add(new THREE.HemisphereLight('#fff7df', '#90a77c', 2.1));
  const sun = new THREE.DirectionalLight('#fff2d2', 3.2); sun.position.set(-12, 25, 16); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -23; sun.shadow.camera.right = 23;
  sun.shadow.camera.top = 23; sun.shadow.camera.bottom = -23; sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .035; sun.shadow.radius = 3; scene.add(sun);
  buildPark();
  rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineBasicMaterial({ color: '#855126' }));
  for (let i = 0; i < 2; i++) rope.add(new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1, 6), material('#a56b2e')));
  loop = new THREE.Mesh(new THREE.TorusGeometry(.72, .07, 6, 32), material('#bf873e'));
  aimGuide = new THREE.ArrowHelper(facing, new THREE.Vector3(), LASSO_RANGE, '#c58a27', .5, .35);
  aimGuide.visible = false; scene.add(aimGuide);
  loop.rotation.x = Math.PI / 2;
  rope.visible = loop.visible = false; scene.add(rope, loop);
  [player, ...animals] = await Promise.all([
    createActor({ name: 'guide', w: 64, h: 144, height: 3.4, facesRight: true }),
    ...SPECIES.map(createActor),
  ]);
  player.state = 'player';
  applyCamera(); reset(); ready = true; loading.hidden = true;
  document.querySelector('#release').disabled = false;
  document.querySelector('#reset').disabled = false;
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); ready = false; stopSound();
    loading.hidden = false; loading.textContent = 'The 3D display was interrupted. Reload this page to play again.';
  });
  new ResizeObserver(applyCamera).observe(viewport);
  renderer.domElement.addEventListener('pointerdown', event => {
    renderer.domElement.focus({ preventScroll: true });
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ground)[0];
    if (hit) clickTarget = new THREE.Vector3(clamp(hit.point.x, -12.3, 12.3), 0, clamp(hit.point.z, -5.08, 8.5));
  });
  requestAnimationFrame(animate);
}
const input = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
const isSpace = event => event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
const editingText = target => target.matches('select, textarea, [contenteditable], input:not([type="range"]):not([type="button"]):not([type="checkbox"])');
window.addEventListener('keydown', event => {
  if (editingText(event.target)) return;
  // Keep native button/link activation; Space on the canvas/body is a game action.
  if (isSpace(event) && event.target.closest('button, a')) return;
  if (isSpace(event)) { event.preventDefault(); if (!event.repeat) throwLasso(); return; }
  if (event.target.matches('input')) return;
  const dir = input[event.key] || input[event.key.toLowerCase()];
  if (dir) { event.preventDefault(); keys.add(dir); }
}, { capture: true });
window.addEventListener('keyup', event => {
  if (isSpace(event) && !editingText(event.target) && !event.target.closest('button, a')) event.preventDefault();
  keys.delete(input[event.key] || input[event.key.toLowerCase()]);
}, { capture: true });
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); stopSound(); } });
function focusGame() { if (ready) renderer.domElement.focus({ preventScroll: true }); }
function updateViewButton() {
  const button = document.querySelector('#view-toggle');
  button.hidden = !mobileLayout.matches;
  button.textContent = overview ? 'Follow Spiro' : 'View whole park';
  button.setAttribute('aria-pressed', String(overview));
}
document.querySelector('#view-toggle').onclick = () => {
  overview = !overview; updateViewButton(); focusGame();
};
mobileLayout.addEventListener('change', () => { if (ready) applyCamera(); });
document.querySelector('#release').onclick = () => { release(); focusGame(); };
document.querySelector('#reset').onclick = () => { reset(); focusGame(); };
document.querySelector('#again').onclick = () => { reset(); release(); focusGame(); };
function saveOptions() { history.replaceState(null, '', optionsQuery(animalStyle, catchMode)); }
function updateAnimalStyle() {
  document.querySelector('#animals').textContent = `Animals: ${animalStyle === 'toys' ? '3D' : 'Paper'}`;
  document.querySelector('#animals').setAttribute('aria-pressed', String(animalStyle === 'toys'));
  saveOptions();
}
document.querySelector('#animals').onclick = () => {
  animalStyle = animalStyle === 'toys' ? 'paper' : 'toys'; updateAnimalStyle(); focusGame();
};
updateAnimalStyle();
function updateCatchMode() {
  document.querySelector('#catch-mode').textContent = `Catch: ${catchMode === 'lasso' ? 'Lasso' : 'By hand'}`;
  document.querySelector('#catch-mode').setAttribute('aria-pressed', String(catchMode === 'lasso'));
  document.querySelector('#throw').hidden = catchMode !== 'lasso';
  document.querySelector('#catch-help').textContent = catchMode === 'lasso'
    ? 'Space throws along the gold arrow. Move to aim it.' : 'Walk up to an animal to pick it up by hand.';
  saveOptions();
}
document.querySelector('#catch-mode').onclick = () => {
  cancelLasso(); catchMode = catchMode === 'lasso' ? 'touch' : 'lasso'; updateCatchMode(); focusGame();
};
document.querySelector('#throw').onclick = () => { throwLasso(); focusGame(); };
updateCatchMode();
start().catch(error => {
  console.error(error); loading.hidden = false;
  loading.textContent = 'The 3D park could not load. Try reloading in a current Chrome, Safari, or Firefox with WebGL enabled. You can also play the Enhanced edition using the link above.';
  setStatus(`Unable to build the park: ${error.message}`);
});
