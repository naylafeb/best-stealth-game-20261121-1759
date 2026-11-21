// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the real
// rules forward from a fresh world for a fixed time, steered by a cautious autopilot
// (sneak along a planned path toward the next waypoint, wait when a warden's cone
// covers the way ahead, flee when actually seen, smoke when suspicion runs hot),
// so every frame is what a short game really looks like, and the same seed always
// gives the same frame.
import { STEP, LEDGER, TREASURES, EXIT } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { guardSees } from './guards.js';
import { findPath, blocksAt } from './level.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 42;
const WIN_LIMIT_SECONDS = 300;
const ALERT_LIMIT_SECONDS = 240;
const SAMPLE = STEP;

/** The heist route: astrolabe, jade moth, the ledger, ivory compass, then the door. */
const ROUTE = [
  { x: TREASURES[0].x, y: TREASURES[0].y },
  { x: TREASURES[1].x, y: TREASURES[1].y },
  { x: LEDGER.x, y: LEDGER.y },
  { x: TREASURES[2].x, y: TREASURES[2].y },
  { x: EXIT.x + EXIT.w / 2, y: EXIT.y + EXIT.h / 2 },
];

/** Where the thief stands to be noticed for the alert shot: just off Ilya's lane. */
const ALERT_SPOT = { x: 640, y: 296 };

function anyGuardSees(world, x, y) {
  const guards = world.state.guards;
  for (let i = 0; i < guards.length; i += 1) {
    if (guardSees(guards[i], x, y, false)) return guards[i];
  }
  return null;
}

function maxSuspicion(world) {
  let max = 0;
  for (const guard of world.state.guards) max = Math.max(max, guard.suspicion);
  return max;
}

/**
 * The autopilot's brain: it keeps a planned path to the current target and
 * re-plans when the target changes or the path runs out. One call returns
 * { move, sneak, gadgets, mouse } for a single step. `force` skips the waiting:
 * the thief pushes through a watched gap (usually under smoke).
 */
function createPilot() {
  let path = null;
  let pathTarget = null;
  let replanIn = 0;
  let waitFor = 0;
  return {
    decide(world, target, force) {
      const player = world.state.player;
      replanIn -= SAMPLE;
      if (
        !path ||
        path.length === 0 ||
        !pathTarget ||
        Math.hypot(pathTarget.x - target.x, pathTarget.y - target.y) > 1 ||
        replanIn <= 0
      ) {
        path = findPath(player.x, player.y, target.x, target.y);
        pathTarget = { x: target.x, y: target.y };
        replanIn = 2;
      }
      if (!path || path.length === 0) return { move: null, sneak: true, gadgets: 0, mouse: null };
      while (path.length > 1 && Math.hypot(path[0].x - player.x, path[0].y - player.y) < 12) path.shift();
      const node = path[0];
      const dx = node.x - player.x;
      const dy = node.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        path.shift();
        return { move: null, sneak: true, gadgets: 0, mouse: null };
      }

      const seer = anyGuardSees(world, player.x, player.y);
      if (seer && !force) {
        // Seen: slip sideways out of the cone (fastest exit). Try both sides and
        // take the one with room to run, biased away from the warden.
        const fx = Math.cos(seer.angle);
        const fy = Math.sin(seer.angle);
        const awayX = player.x - seer.x;
        const awayY = player.y - seer.y;
        const sides = [
          { x: -fy, y: fx },
          { x: fy, y: -fx },
        ];
        let bestSide = sides[0];
        let bestScore = -Infinity;
        for (const side of sides) {
          const probeX = player.x + side.x * 44;
          const probeY = player.y + side.y * 44;
          const free = blocksAt(probeX, probeY, 12) ? 0 : 1;
          const score = free * 2 + (side.x * awayX + side.y * awayY) / 100;
          if (score > bestScore) {
            bestScore = score;
            bestSide = side;
          }
        }
        const mx = bestSide.x + awayX * 0.5;
        const my = bestSide.y + awayY * 0.5;
        const len = Math.hypot(mx, my) || 1;
        waitFor = 0;
        return {
          move: { x: mx / len, y: my / len },
          sneak: false,
          gadgets: 0,
          mouse: null,
        };
      }

      // Probe a step ahead: if the way forward is watched, wait in the shadows.
      const probeX = player.x + (dx / dist) * 34;
      const probeY = player.y + (dy / dist) * 34;
      const watcher = anyGuardSees(world, probeX, probeY);
      const hot = maxSuspicion(world) > 0.35;
      const smoked = player.smokedFor > 0;
      if ((watcher || hot) && !smoked && !force) {
        waitFor += SAMPLE;
        let gadgets = 0;
        let mouse = null;
        if (maxSuspicion(world) > 0.55 && player.smoke > 0) {
          // Smoke, and move under its cover next step instead of waiting.
          gadgets = 8;
          waitFor = 0;
        } else if (waitFor > 3 && player.coins > 0) {
          // Lure the watcher away: toss a coin behind the thief, off the path.
          const backX = player.x - dx;
          const backY = player.y - dy;
          const backLen = Math.hypot(backX - player.x, backY - player.y) || 1;
          mouse = {
            x: player.x + ((backX - player.x) / backLen) * 200,
            y: player.y + ((backY - player.y) / backLen) * 200,
          };
          gadgets = 4;
          waitFor = 0;
        }
        return { move: null, sneak: true, gadgets, mouse };
      }
      waitFor = 0;
      return { move: { x: dx / dist, y: dy / dist }, sneak: true, gadgets: 0, mouse: null };
    },
  };
}

/** Walk the route with the autopilot until `stop` says enough; returns the events seen. */
function runRoute(world, seconds, stop) {
  let events = 0;
  let waypoint = 0;
  let bestDist = Infinity;
  let stuckFor = 0;
  let pushFor = 0;
  const pilot = createPilot();
  for (let t = 0; t < seconds; t += SAMPLE) {
    const player = world.state.player;
    const target = ROUTE[Math.min(waypoint, ROUTE.length - 1)];
    if (Math.hypot(target.x - player.x, target.y - player.y) < 14 && waypoint < ROUTE.length) {
      waypoint += 1;
      bestDist = Infinity;
      stuckFor = 0;
    }
    const decision = pilot.decide(world, ROUTE[Math.min(waypoint, ROUTE.length - 1)], pushFor > 0);
    // Stuck against a watched gap for too long: smoke, then push through it.
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    if (dist < bestDist - 1) {
      bestDist = dist;
      stuckFor = 0;
    } else {
      stuckFor += SAMPLE;
    }
    let move = decision.move;
    let sneak = decision.sneak;
    let gadgets = decision.gadgets;
    if (stuckFor > 5 && pushFor <= 0) {
      pushFor = 2.5;
      stuckFor = 0;
    }
    if (pushFor > 0) {
      pushFor -= SAMPLE;
      sneak = false;
      if (player.smoke > 0 && player.smokedFor <= 0) gadgets = 8;
    }
    const mouse = decision.mouse ?? { x: player.x, y: player.y };
    events |= world.step(SAMPLE, move, sneak, null, mouse, gadgets, false);
    if (events & EVENT_CAUGHT) return { events, waypoint };
    if (events & EVENT_WIN) return { events, waypoint };
    if (stop && stop(world)) return { events, waypoint };
  }
  return { events, waypoint };
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    for (let t = 0; t < START_SECONDS; t += SAMPLE) {
      world.step(SAMPLE, null, false, null, { x: 0, y: 0 }, 0, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'alert') {
    // Walk to the spot, then stand still and let a warden's suspicion climb.
    const pilot = createPilot();
    let arrived = false;
    for (let t = 0; t < ALERT_LIMIT_SECONDS; t += SAMPLE) {
      const player = world.state.player;
      if (!arrived) {
        const decision = pilot.decide(world, ALERT_SPOT);
        const dist = Math.hypot(ALERT_SPOT.x - player.x, ALERT_SPOT.y - player.y);
        if (dist < 14) arrived = true;
        world.step(SAMPLE, decision.move, decision.sneak, null, decision.mouse ?? { x: player.x, y: player.y }, decision.gadgets, false);
      } else {
        world.step(SAMPLE, null, true, null, { x: player.x, y: player.y }, 0, false);
        if (maxSuspicion(world) >= 0.75) break;
      }
      if (world.state.caught) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'win') {
    const first = runRoute(world, WIN_LIMIT_SECONDS, (w) => w.state.won);
    if (first.events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    // One cautious retry: the first run may have been caught on the long route.
    world.reset();
    const second = runRoute(world, WIN_LIMIT_SECONDS, (w) => w.state.won);
    if (second.events & EVENT_WIN) return { screen: SCREEN_WIN, best: world.state.score };
    return { screen: SCREEN_PLAY, best: world.state.score };
  }

  // play: a slice of the real heist, mid-route.
  const run = runRoute(world, PLAY_SECONDS, null);
  if (run.events & EVENT_CAUGHT) {
    world.reset();
    runRoute(world, PLAY_SECONDS, null);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
