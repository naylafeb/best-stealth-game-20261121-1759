// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// caught and won.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|alert|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, BEST_TIME_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_COIN, ACTION_SMOKE, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { unlockAudio, playWin, playCaught } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return {
      score: Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0,
      time: window.localStorage.getItem(BEST_TIME_KEY) ?? '',
    };
  } catch {
    return { score: 0, time: '' };
  }
}

function saveBest(score, timeText) {
  try {
    const best = readBest();
    if (score > best.score) window.localStorage.setItem(BEST_KEY, String(score));
    if (timeText && (!best.time || timeText < best.time)) window.localStorage.setItem(BEST_TIME_KEY, timeText);
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function formatTime(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}

function runShot(name) {
  const scene = stageShot(name, world);
  const best = readBest();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best || best.score, best.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Cinder Ledger, then reach the south door unseen.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_CAUGHT;
    if (won) playWin();
    else playCaught();
    saveBest(world.state.score, won ? formatTime(world.state.time) : '');
    best = readBest();
    announce(
      won
        ? `Unseen. The ledger is yours. Score ${world.state.score}.`
        : `Caught. Score ${world.state.score}.`,
    );
  }

  // Actions are taken once per frame and shared: handleActions reads the menu keys,
  // step reads the gadget keys, and gadgets fire on the frame's first step only.
  function handleActions(actions) {
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, false, null, { x: 0, y: 0 }, 0, true);
      return;
    }
    const click = input.takeClick();
    if (click) unlockAudio();
    const gadgets = (actions & ACTION_COIN ? 4 : 0) | (actions & ACTION_SMOKE ? 8 : 0);
    const events = world.step(
      STEP,
      input.direction(),
      input.sneaking(),
      click,
      { x: input.mouseX, y: input.mouseY },
      gadgets,
      false,
    );
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & (ACTION_CONFIRM | ACTION_COIN | ACTION_SMOKE)) unlockAudio();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best.score, best.time);
  }

  // Leaving the tab pauses a running game rather than letting wardens close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velvet Hour. Press Space or click to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
