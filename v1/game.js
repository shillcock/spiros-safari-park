import { Game, SPECIES, STEP } from './game-model.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#overlay');
const status = document.querySelector('#status');
const pauseButton = document.querySelector('#pause');
const restartButton = document.querySelector('#restart');
const muteButton = document.querySelector('#mute');
const asset = name => new URL(`assets/${name}`, import.meta.url).href;
const images = {};
const keys = new Set();
let game, screen = 'loading', paused = false, accumulator = 0, lastTime = 0;
let audio, master, musicGain, music, muted = false, generation = 0;
const buffers = new Map();
const effects = new Set();

function play(name, finished) {
  if (!audio || !buffers.has(name)) { finished?.(); return; }
  const source = audio.createBufferSource();
  source.buffer = buffers.get(name);
  source.connect(master);
  effects.add(source);
  source.onended = () => { effects.delete(source); finished?.(); };
  source.start();
}
function stopAudio() {
  generation++;
  for (const source of effects) { source.onended = null; source.stop(); }
  effects.clear();
  if (music) { music.stop(); music = null; }
}
function startMusic() {
  if (!audio || !buffers.has('house_lo')) return;
  music = audio.createBufferSource();
  music.buffer = buffers.get('house_lo');
  music.loop = true;
  music.connect(musicGain);
  musicGain.gain.cancelScheduledValues(audio.currentTime);
  musicGain.gain.setValueAtTime(0.25, audio.currentTime);
  music.start();
}
function showOverlay(text) { overlay.textContent = text; overlay.hidden = false; }
function start() {
  if (screen === 'loading' || screen === 'error') return;
  audio?.resume().catch(() => {});
  stopAudio();
  game = new Game();
  screen = 'playing';
  paused = false;
  accumulator = 0;
  keys.clear();
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.textContent = 'Pause';
  restartButton.disabled = false;
  startMusic();
  play('intro');
  canvas.focus({ preventScroll: true });
  updateStatus();
}
function togglePause() {
  if (screen !== 'playing') return;
  paused = !paused;
  keys.clear();
  accumulator = 0;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  if (paused) {
    audio?.suspend().catch(() => {});
    showOverlay('Paused — click or press P to resume');
  } else {
    audio?.resume().catch(() => {});
    overlay.hidden = true;
    canvas.focus({ preventScroll: true });
  }
  updateStatus();
}
function win() {
  screen = 'won';
  keys.clear();
  pauseButton.disabled = true;
  showOverlay('Play again');
  const current = generation;
  // Wait for outstanding effects before starting the original victory sequence.
  const wait = () => {
    if (current !== generation) return;
    if (effects.size) { setTimeout(wait, 100); return; }
    play('youre_a_ranger', () => {
      if (current !== generation) return;
      play('ending', () => {
        if (current === generation && musicGain) {
          musicGain.gain.setTargetAtTime(0, audio.currentTime, 0.25);
        }
      });
    });
  };
  wait();
}
function updateStatus() {
  let text;
  if (screen === 'won') text = 'All six animals are home. You’re a Safari Park Ranger!';
  else if (screen === 'title') text = 'Press any key or click to visit the park. Sound starts when you play.';
  else if (paused) text = 'Paused — the animals can wait.';
  else if (game?.phase === 'intro') text = 'Welcome! Explore with the arrow keys while you hear the introduction.';
  else if (game?.phase === 'escape') text = 'The animals have escaped! Get ready to round them up…';
  else if (game) text = `${game.score} / 6 home · ${game.player.carrying ? `Carrying the ${game.player.carrying.name} — find its cage!` : 'Touch an animal to pick it up.'}`;
  if (text && status.textContent !== text) status.textContent = text;
}
function sprite(image, body, flip = false) {
  ctx.save();
  ctx.translate(Math.round(body.x + (flip ? body.w : 0)), Math.round(body.y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, 0, 0, body.w, body.h);
  ctx.restore();
}
function render() {
  if (screen === 'loading' || screen === 'error') return;
  if (screen === 'title' || screen === 'won') {
    ctx.drawImage(images[screen === 'title' ? 'welcome' : 'way_to_go'], 0, 0);
    return;
  }
  ctx.fillStyle = '#346a10';
  ctx.fillRect(0, 0, 800, 600);
  sprite(images.guide, game.player, game.player.facing === 'left');
  for (const a of game.animals) {
    const reverse = a.name === 'monkey' || a.name === 'penguin';
    sprite(images[a.name], a, reverse ? a.facing === 'left' : a.facing === 'right');
  }
  for (const cage of game.cages) {
    ctx.drawImage(images.cage, cage.x, cage.y);
    ctx.fillStyle = '#000';
    ctx.fillRect(cage.x, 525, 133, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '24px ParkLabels, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cage.name, cage.x + 66.5, 540, 129);
  }
  if (paused) { ctx.fillStyle = '#0007'; ctx.fillRect(0, 0, 800, 600); }
}
function frame(now) {
  const elapsed = Math.min(now - (lastTime || now), 100);
  lastTime = now;
  if (screen === 'playing' && !paused) {
    accumulator += elapsed;
    while (accumulator >= STEP && screen === 'playing') {
      for (const event of game.step(keys)) {
        if (event === 'win') win();
        else if ((event !== 'good_job' && event !== 'wrong_cage') || effects.size === 0) play(event);
      }
      accumulator -= STEP;
    }
    updateStatus();
  }
  render();
  requestAnimationFrame(frame);
}
const keyDirections = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
window.addEventListener('keydown', event => {
  // Preserve native button activation while keeping movement usable after mute.
  if (event.target instanceof HTMLButtonElement && ['Enter', ' ', 'Tab'].includes(event.key)) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (keyDirections[key] || key === ' ') event.preventDefault();
  if (event.repeat && screen !== 'playing') return;
  if (screen === 'title' && !event.metaKey && !event.ctrlKey && !['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(key)) { start(); return; }
  if ((key === 'p' || key === 'Escape') && !event.repeat) { togglePause(); return; }
  if (screen === 'playing' && !paused && keyDirections[key]) keys.add(keyDirections[key]);
});
window.addEventListener('keyup', event => keys.delete(keyDirections[event.key.length === 1 ? event.key.toLowerCase() : event.key]));
window.addEventListener('blur', () => { keys.clear(); if (screen === 'playing' && !paused) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'playing' && !paused) togglePause(); });
overlay.addEventListener('click', () => paused ? togglePause() : start());
canvas.addEventListener('click', () => { if (screen === 'title') start(); });
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', start);
muteButton.addEventListener('click', () => {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  muteButton.textContent = muted ? 'Unmute' : 'Mute';
  muteButton.setAttribute('aria-pressed', String(muted));
});
for (const button of document.querySelectorAll('[data-direction]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (screen !== 'playing' || paused) return;
    button.setPointerCapture(event.pointerId);
    keys.add(button.dataset.direction);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, () => keys.delete(button.dataset.direction));
  }
}

async function load() {
  await Promise.all([...SPECIES, 'guide', 'cage', 'welcome', 'way_to_go'].map(async name => {
    const img = new Image();
    img.src = asset(`${name}.png`);
    await img.decode();
    images[name] = img;
  }));
  const cage = document.createElement('canvas');
  cage.width = 133; cage.height = 120;
  const context = cage.getContext('2d');
  context.drawImage(images.cage, 0, 0);
  const pixels = context.getImageData(0, 0, 133, 120);
  for (let i = 0; i < pixels.data.length; i += 4) {
    if (pixels.data[i] === 0 && pixels.data[i + 1] === 255 && pixels.data[i + 2] === 0) pixels.data[i + 3] = 0;
  }
  context.putImageData(pixels, 0, 0);
  images.cage = cage;
  try {
    const font = new FontFace('ParkLabels', `url("${asset('ariblk.ttf')}")`);
    document.fonts.add(await font.load());
  } catch (error) { console.warn('Using fallback cage font.', error); }
  try {
    audio = new AudioContext();
    master = audio.createGain(); master.gain.value = muted ? 0 : 1; master.connect(audio.destination);
    musicGain = audio.createGain(); musicGain.connect(master);
    const names = [...SPECIES, 'house_lo', 'intro', 'escaped', 'gotcha', 'good_job', 'wrong_cage', 'youre_a_ranger', 'ending'];
    await Promise.all(names.map(async name => {
      const response = await fetch(asset(`${name}.wav`));
      if (!response.ok) throw new Error(`Missing sound: ${name}`);
      buffers.set(name, await audio.decodeAudioData(await response.arrayBuffer()));
    }));
  } catch (error) {
    console.warn('Some audio could not be loaded; the game remains playable.', error);
    document.querySelector('.instructions').append(' Some audio is unavailable in this browser.');
  }
  screen = 'title';
  overlay.disabled = false;
  showOverlay('Click or press any key to play');
  updateStatus();
  canvas.focus({ preventScroll: true });
}
load().catch(error => {
  console.error(error);
  screen = 'error';
  overlay.textContent = 'Unable to load the park';
  status.textContent = 'Please run npm start and open http://localhost:8000. Artwork must be served over HTTP, not file://.';
});
requestAnimationFrame(frame);
