// The night itself: one world holds the thief, the five wardens, the ledger, the
// treasures and the clock, and advances them all in fixed steps. The renderer only
// ever reads this state; it never changes it.
import { STEP, LEDGER, TREASURES, EXIT, SCORE, GADGETS } from './config.js';
import { createRandom } from './random.js';
import { createGuards, stepGuard, guardSees, hearNoise, GUARD_CHASE } from './guards.js';
import { GUARD_DEFS } from './config.js';
import { createPlayer, stepPlayer, throwCoin, popSmoke } from './player.js';
import { isHidden, blocksAt } from './level.js';
import { playFootstep, playAlert, playSuspicious, playCoin, playSmoke, playPickup } from './audio.js';

export const EVENT_PICKUP = 1;
export const EVENT_LEDGER = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_ALERT = 16;
export const EVENT_NOISE = 32;

export function createWorld(random) {
  const state = {
    player: createPlayer(),
    guards: createGuards(GUARD_DEFS),
    ledgerTaken: false,
    treasuresTaken: TREASURES.map(() => false),
    score: 0,
    time: 0,
    /** True once any warden has fully spotted the thief (kills the Ghost bonus). */
    everAlerted: false,
    /** The loudest suspicion right now, 0..1, for the HUD meter. */
    heat: 0,
    /** Recent coin landings, drawn as ripples until they fade. */
    ripples: [],
    /** Dust motes drifting in the lamplight, purely decorative. */
    motes: [],
    won: false,
    caught: false,
    /** Which guard is chasing, for the HUD's warning line. */
    chaserName: null,
  };
  for (let i = 0; i < 70; i += 1) {
    state.motes.push({
      x: random.range(30, 1250),
      y: random.range(30, 690),
      r: random.range(1, 2.4),
      drift: random.range(2, 7),
      phase: random.range(0, Math.PI * 2),
    });
  }
  return {
    state,
    random,
    reset() {
      const fresh = createWorld(random).state;
      Object.keys(fresh).forEach((key) => {
        state[key] = fresh[key];
      });
    },
    /**
     * Advance the world one fixed step. `move` is the key vector (or null), `sneak`
     * whether the thief is sneaking, `click` a fresh click target (or null),
     * `gadgets` a bitmask of ACTION_COIN / ACTION_SMOKE. In demo mode the guards
     * patrol and the motes drift, but nothing is scored. Returns EVENT_* flags.
     */
    step(dt, move, sneak, click, mouse, gadgets, demo) {
      let events = 0;
      const player = state.player;
      if (!demo) state.time += dt;
      if (player.smokedFor > 0) player.smokedFor -= dt;

      if (click) {
        player.targetX = click.x;
        player.targetY = click.y;
      }
      player.sneaking = sneak === true;
      const wasMoving = player.moving;
      const moved = stepPlayer(player, dt, move);
      if (moved && !demo) {
        if (player.stepClock > (player.sneaking ? 26 : 34)) {
          player.stepClock = 0;
          playFootstep(player.sneaking);
        }
        // Running is loud: wardens nearby turn toward the noise.
        if (!player.sneaking && wasMoving) {
          const near = state.guards.some((g) => Math.hypot(g.x - player.x, g.y - player.y) < 95);
          if (near) events |= EVENT_NOISE;
        }
      }

      if (!demo && gadgets !== 0) {
        if (gadgets & 4) {
          const landing = throwCoin(player, mouse.x, mouse.y);
          if (landing) {
            state.ripples.push({ x: landing.x, y: landing.y, age: 0 });
            hearNoise(state.guards, landing.x, landing.y, GADGETS.coinNoiseRadius);
            playCoin();
            events |= EVENT_NOISE;
          }
        }
        if (gadgets & 8) {
          if (popSmoke(player)) playSmoke();
        }
      }

      // Motes drift.
      for (let i = 0; i < state.motes.length; i += 1) {
        const mote = state.motes[i];
        mote.phase += dt * 0.4;
        mote.y += Math.sin(mote.phase) * mote.drift * dt * 0.4;
      }
      // Ripples fade.
      for (let i = state.ripples.length - 1; i >= 0; i -= 1) {
        state.ripples[i].age += dt;
        if (state.ripples[i].age > 1.6) state.ripples.splice(i, 1);
      }

      const smoked = player.smokedFor > 0;
      const hidden = isHidden(player.x, player.y);
      let heat = 0;
      let chaser = null;
      for (let i = 0; i < state.guards.length; i += 1) {
        const guard = state.guards[i];
        const seen = guardSees(guard, player.x, player.y, smoked);
        const before = guard.state;
        const result = stepGuard(guard, dt, seen, player.sneaking, hidden, smoked, player.x, player.y);
        if (result === 'alert') {
          state.everAlerted = true;
          if (!demo) playAlert();
          events |= EVENT_ALERT;
        }
        if (result === 'caught' && !demo) {
          state.caught = true;
          events |= EVENT_CAUGHT;
        }
        if (!demo && before !== 'stare' && guard.state === 'stare') playSuspicious();
        heat = Math.max(heat, guard.suspicion);
        if (guard.state === GUARD_CHASE) chaser = guard.name;
      }
      state.heat = heat;
      state.chaserName = chaser;

      if (demo) return events;

      // Pick up the ledger.
      if (!state.ledgerTaken && Math.hypot(player.x - LEDGER.x, player.y - LEDGER.y) < 30) {
        state.ledgerTaken = true;
        state.score += SCORE.ledger;
        playPickup(true);
        events |= EVENT_LEDGER;
      }
      // Pick up treasures.
      for (let i = 0; i < TREASURES.length; i += 1) {
        if (state.treasuresTaken[i]) continue;
        const t = TREASURES[i];
        if (Math.hypot(player.x - t.x, player.y - t.y) < 28) {
          state.treasuresTaken[i] = true;
          state.score += SCORE.treasure;
          playPickup(false);
          events |= EVENT_PICKUP;
        }
      }
      // Reach the exit with the ledger.
      if (
        state.ledgerTaken &&
        player.x > EXIT.x &&
        player.x < EXIT.x + EXIT.w &&
        player.y > EXIT.y &&
        player.y < EXIT.y + EXIT.h
      ) {
        state.won = true;
        const timeBonus = Math.max(0, SCORE.timeParSeconds - Math.floor(state.time)) * SCORE.timePerSecond;
        state.score += timeBonus;
        if (!state.everAlerted) state.score += SCORE.ghostBonus;
        events |= EVENT_WIN;
      }
      return events;
    },
  };
}

/** The thief's score at the moment of winning, split into its parts, for the win screen. */
export function scoreBreakdown(state) {
  const treasures = state.treasuresTaken.filter(Boolean).length * SCORE.treasure;
  const timeBonus = Math.max(0, SCORE.timeParSeconds - Math.floor(state.time)) * SCORE.timePerSecond;
  return {
    treasures,
    ledger: state.ledgerTaken ? SCORE.ledger : 0,
    timeBonus: state.won ? timeBonus : 0,
    ghost: state.won && !state.everAlerted ? SCORE.ghostBonus : 0,
  };
}

export { STEP };
