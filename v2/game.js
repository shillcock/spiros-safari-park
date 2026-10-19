import { Game, SPECIES, STEP } from './game-model.js';
import { ParkRenderer } from './presentation.js';

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
let game, renderer, screen = 'loading', paused = false, accumulator = 0, lastTime = 0;
let audio, master, musicGain, music, muted = false, generation = 0, deliveryAudio = false;
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
function stopEffects() {
  for (const source of effects) { source.onended = null; source.stop(); }
  effects.clear();
  deliveryAudio = false;
}
function stopAudio() {
  generation++;
  stopEffects();
  if (music) { music.stop(); music = null; }
}
function playReturn(name) {
  stopEffects();
  deliveryAudio = true;
  const current = generation;
  play(name, () => {
    if (current !== generation) return;
    play('good_job', () => { if (current === generation) deliveryAudio = false; });
  });
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
  renderer.reset();
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
  if (screen !== 'playing' && screen !== 'finishing') return;
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
  screen = 'finishing';
  keys.clear();
  updateStatus();
}
function showVictory() {
  screen = 'won';
  keys.clear();
  pauseButton.disabled = true;
  showOverlay('Play again');
  const current = generation;
  // Wait for outstanding effects before starting the original victory sequence.
  const wait = () => {
    if (current !== generation) return;
    if (effects.size) { setTimeout(wait, 100); return; }
    renderer.visual.beginAward();
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
  updateStatus();
}
function updateStatus() {
  let text;
  if (screen === 'won') text = 'All six animals are home. You’re a Safari Park Ranger!';
  else if (screen === 'title') text = 'Press any key or click to visit the park. Sound starts when you play.';
  else if (paused) text = 'Paused — the animals can wait.';
  else if (screen === 'finishing') text = 'All six animals are home! Time for Spiro’s victory jump!';
  else if (game?.phase === 'intro') text = 'Welcome! Explore with the arrow keys while you hear the introduction.';
  else if (game?.phase === 'escape') text = 'The animals have escaped! Get ready to round them up…';
  else if (game) text = `${game.score} / 6 home · ${game.player.carrying ? `Carrying the ${game.player.carrying.name} — find its cage!` : 'Touch an animal to pick it up.'}`;
  if (text && status.textContent !== text) status.textContent = text;
}
function render() {
  if (screen === 'loading' || screen === 'error') return;
  if (screen === 'title') ctx.drawImage(images.welcome, 0, 0);
  else if (screen === 'won') renderer.victory();
  else renderer.draw(game, paused, keys.size > 0 && !paused);
}
function frame(now) {
  const elapsed = Math.min(now - (lastTime || now), 100);
  lastTime = now;
  if (screen === 'playing' && !paused) {
    accumulator += elapsed;
    while (accumulator >= STEP && screen === 'playing') {
      for (const event of game.step(keys)) {
        if (event === 'win') win();
        else if (event === 'wrong_cage') {
          // Each deliberate wrong entry must be heard, even during pickup audio.
          // Stop effects only; the background music continues uninterrupted.
          stopEffects();
          play(event);
        } else if (event.startsWith('returned:')) playReturn(event.slice('returned:'.length));
        else if (!deliveryAudio) play(event);
      }
      accumulator -= STEP;
    }
    updateStatus();
  }
  if (game && !paused) {
    renderer.advance(game, elapsed / 1000);
    if (screen === 'finishing' && renderer.visual.finishPhase === 'complete') showVictory();
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
window.addEventListener('blur', () => { keys.clear(); if (['playing', 'finishing'].includes(screen) && !paused) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && ['playing', 'finishing'].includes(screen) && !paused) togglePause(); });
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
  await Promise.all([...SPECIES, 'guide', 'welcome', 'way_to_go'].map(async name => {
    const img = new Image();
    img.src = asset(`${name}.png`);
    await img.decode();
    images[name] = img;
  }));
  renderer = new ParkRenderer(ctx, images, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
