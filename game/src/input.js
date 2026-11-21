// Keyboard and mouse, read fresh every frame. WASD or arrows walk, Shift sneaks,
// E throws a coin at the mouse, Q pops smoke, P or Escape pauses, Space or Enter
// confirms a menu. A mouse click sets a walk target; any key press cancels it.
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_COIN = 4;
export const ACTION_SMOKE = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  /** The last click in logical playfield coordinates (or null). */
  let click = null;
  let clickFresh = false;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    const key = event.key.toLowerCase();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'enter') actions |= ACTION_CONFIRM;
    if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    if (key === 'e') actions |= ACTION_COIN;
    if (key === 'q') actions |= ACTION_SMOKE;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    click = toLogical(event);
    clickFresh = true;
  });
  canvas.addEventListener('pointermove', (event) => {
    // Keep the mouse position fresh for coin throws; it is not a walk target.
    const point = toLogical(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
  });

  const input = {
    mouseX: FIELD.width / 2,
    mouseY: FIELD.height / 2,
    /** The walk vector from the keys, or null when no movement key is held. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x === 0 && y === 0) return null;
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    sneaking() {
      return keys.has('shift');
    },
    /** One-shot actions since the last take; reading them clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click target, or null; reading it clears it. */
    takeClick() {
      if (!clickFresh) return null;
      clickFresh = false;
      return click;
    },
  };
  return input;
}
