// The thief: a small hooded figure who walks, sneaks, throws coins to mislead the
// wardens and pops smoke to vanish. Movement is axis-separated so the thief slides
// along walls instead of sticking to them.
import { PLAYER, GADGETS, SPAWN } from './config.js';
import { blocksAt } from './level.js';

export function createPlayer() {
  return {
    x: SPAWN.x,
    y: SPAWN.y,
    angle: -Math.PI / 2,
    sneaking: false,
    moving: false,
    /** Where a mouse click told the thief to walk; null when walking by keys. */
    targetX: null,
    targetY: null,
    coins: GADGETS.coins,
    smoke: GADGETS.smoke,
    /** Seconds of smoke cover left around the thief. */
    smokedFor: 0,
    /** Steps since the last footstep sound (the audio layer reads this). */
    stepClock: 0,
  };
}

/**
 * Move the thief for one step. `move` is a unit vector from the keys (or null); when
 * the keys are quiet and a click target is set, the thief walks toward the target.
 * Returns true while the thief is actually moving.
 */
export function stepPlayer(player, dt, move) {
  let dx = 0;
  let dy = 0;
  if (move && (move.x !== 0 || move.y !== 0)) {
    dx = move.x;
    dy = move.y;
    player.targetX = null;
    player.targetY = null;
  } else if (player.targetX !== null && player.targetY !== null) {
    const tx = player.targetX - player.x;
    const ty = player.targetY - player.y;
    const dist = Math.hypot(tx, ty);
    if (dist < 6) {
      player.targetX = null;
      player.targetY = null;
    } else {
      dx = tx / dist;
      dy = ty / dist;
    }
  }
  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  if (!player.moving) return false;
  const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const step = speed * dt;
  const nx = player.x + (dx / len) * step;
  const ny = player.y + (dy / len) * step;
  if (!blocksAt(nx, player.y, PLAYER.radius)) player.x = nx;
  if (!blocksAt(player.x, ny, PLAYER.radius)) player.y = ny;
  player.angle = Math.atan2(dy, dx);
  player.stepClock += step;
  return true;
}

/** Throw a coin toward (tx, ty), clamped to throw range. Returns the landing spot. */
export function throwCoin(player, tx, ty) {
  if (player.coins <= 0) return null;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy);
  const range = Math.min(dist, GADGETS.coinThrowRange);
  const landing = {
    x: dist === 0 ? player.x + 60 : player.x + (dx / dist) * range,
    y: dist === 0 ? player.y : player.y + (dy / dist) * range,
  };
  player.coins -= 1;
  return landing;
}

/** Pop a smoke puff. Returns true when a charge was spent. */
export function popSmoke(player) {
  if (player.smoke <= 0) return false;
  player.smoke -= 1;
  player.smokedFor = GADGETS.smokeSeconds;
  return true;
}
