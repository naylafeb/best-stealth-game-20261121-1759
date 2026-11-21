// The wardens. Each one walks a patrol loop, watches a cone of lamplight ahead of
// itself, and keeps a suspicion meter for the thief: a glimpse fills it, hiding
// drains it, a full meter turns the warden into a hunter. A thrown coin or a loud
// footstep can pull a warden off its route to look at a noise instead.
import { GUARD, DETECT } from './config.js';
import { blocksAt, lineOfSight, isHidden, findPath } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_STARE = 'stare';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_INVESTIGATE = 'investigate';

export function createGuards(defs) {
  return defs.map((def, index) => {
    const first = def.waypoints[0];
    const second = def.waypoints[1] ?? first;
    return {
      id: index,
      name: def.name,
      x: first.x,
      y: first.y,
      angle: Math.atan2(second.y - first.y, second.x - first.x),
      waypoints: def.waypoints,
      waypointIndex: 1 % def.waypoints.length,
      state: GUARD_PATROL,
      suspicion: 0,
      /** Where the guard last saw (or heard) the thief. */
      lastSeenX: first.x,
      lastSeenY: first.y,
      /** How long the guard has gone without seeing the thief while chasing. */
      unseenFor: 0,
      /** Countdown for the current stare / search / investigate pause. */
      pauseFor: 0,
      /** Where an investigation is heading. */
      investigateX: 0,
      investigateY: 0,
      /** Search sweep: which way the guard is turning while searching. */
      sweepDir: 1,
      speed: GUARD.patrolSpeed,
      /** The planned route to the current goal (patrol waypoint, last seen spot). */
      path: null,
      pathTarget: null,
    };
  });
}

/** Can this guard see the thief right now? Range, cone angle and a clear line of sight. */
export function guardSees(guard, px, py, smoked) {
  if (smoked) return false;
  const dx = px - guard.x;
  const dy = py - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.visionRange) return false;
  if (dist < 18) return true;
  let diff = Math.atan2(dy, dx) - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > GUARD.visionHalfAngle) return false;
  return lineOfSight(guard.x, guard.y, px, py);
}

/** Walk toward (tx, ty) at `speed`, sliding along walls; face the direction of travel. */
export function walkToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  moveGuard(guard, nx, ny);
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 2;
}

function moveGuard(guard, nx, ny) {
  if (!blocksAt(nx, guard.y, GUARD.radius)) guard.x = nx;
  if (!blocksAt(guard.x, ny, GUARD.radius)) guard.y = ny;
}

/**
 * Walk toward (tx, ty) along a planned route that goes around walls, so a warden
 * never pushes into a shelf corner forever. Returns true on arrival.
 */
function followPath(guard, tx, ty, speed, dt) {
  if (
    !guard.path ||
    !guard.pathTarget ||
    Math.hypot(guard.pathTarget.x - tx, guard.pathTarget.y - ty) > 1
  ) {
    guard.path = findPath(guard.x, guard.y, tx, ty, GUARD.radius + 1);
    guard.pathTarget = { x: tx, y: ty };
  }
  if (!guard.path || guard.path.length === 0) return walkToward(guard, tx, ty, speed, dt);
  while (guard.path.length > 1 && Math.hypot(guard.path[0].x - guard.x, guard.path[0].y - guard.y) < 8) {
    guard.path.shift();
  }
  const node = guard.path[0];
  const arrived = walkToward(guard, node.x, node.y, speed, dt);
  if (arrived && guard.path.length <= 1) return true;
  if (arrived) guard.path.shift();
  return false;
}

/** A noise at (x, y): every guard close enough leaves its route to look at it. */
export function hearNoise(guards, x, y, radius) {
  for (let i = 0; i < guards.length; i += 1) {
    const guard = guards[i];
    if (guard.state === GUARD_CHASE) continue;
    const dist = Math.hypot(guard.x - x, guard.y - y);
    if (dist <= radius) {
      guard.state = GUARD_INVESTIGATE;
      guard.investigateX = x;
      guard.investigateY = y;
      guard.pauseFor = 0;
    }
  }
}

/**
 * One guard, one step. Returns 'alert' the moment this guard's suspicion fills and
 * the chase begins, 'caught' when it lays a hand on the thief, otherwise null.
 * `seen` is whether the guard sees the thief this step; `sneaking` and `hidden`
 * slow the suspicion fill; `smoked` means the thief is inside a smoke puff.
 */
export function stepGuard(guard, dt, seen, sneaking, hidden, smoked, px, py) {
  // Suspicion fills while the thief is seen, drains while hidden.
  if (seen) {
    const dist = Math.hypot(px - guard.x, py - guard.y);
    const closeness = Math.max(0.15, 1.15 - dist / GUARD.visionRange);
    let rate = DETECT.baseRate * closeness;
    if (sneaking) rate *= DETECT.sneakFactor;
    if (hidden) rate *= DETECT.hiddenFactor;
    guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
    guard.lastSeenX = px;
    guard.lastSeenY = py;
    guard.unseenFor = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - DETECT.decayRate * dt);
    guard.unseenFor += dt;
  }

  if (guard.state === GUARD_CHASE) {
    if (seen) {
      guard.lastSeenX = px;
      guard.lastSeenY = py;
      guard.unseenFor = 0;
    }
    if (guard.unseenFor > GUARD.chaseMemory) {
      guard.state = GUARD_SEARCH;
      guard.pauseFor = GUARD.searchTime;
      guard.sweepDir = guard.sweepDir === 1 ? -1 : 1;
      return null;
    }
    walkToward(guard, guard.lastSeenX, guard.lastSeenY, GUARD.chaseSpeed, dt);
    if (Math.hypot(px - guard.x, py - guard.y) < GUARD.radius + 12) return 'caught';
    return null;
  }

  if (guard.suspicion >= 1) {
    guard.state = GUARD_CHASE;
    guard.unseenFor = 0;
    return 'alert';
  }

  if (guard.state === GUARD_STARE) {
    guard.pauseFor -= dt;
    if (seen) guard.angle = Math.atan2(py - guard.y, px - guard.x);
    if (guard.pauseFor <= 0) guard.state = GUARD_PATROL;
    return null;
  }

  if (guard.state === GUARD_INVESTIGATE) {
    const arrived = followPath(guard, guard.investigateX, guard.investigateY, GUARD.investigateSpeed, dt);
    if (arrived) {
      guard.pauseFor += dt;
      guard.angle += guard.sweepDir * dt * 1.4;
      if (guard.pauseFor > 2.2) {
        guard.state = GUARD_PATROL;
        guard.pauseFor = 0;
      }
    }
    return null;
  }

  if (guard.state === GUARD_SEARCH) {
    const arrived = followPath(guard, guard.lastSeenX, guard.lastSeenY, GUARD.investigateSpeed, dt);
    if (arrived) {
      guard.pauseFor -= dt;
      guard.angle += guard.sweepDir * dt * 1.1;
      if (guard.pauseFor <= 0) {
        guard.state = GUARD_PATROL;
        guard.suspicion = 0;
      }
    }
    return null;
  }

  // PATROL: walk the loop; a half-seen thief makes the guard stop and stare.
  if (seen && guard.suspicion > 0.35) {
    guard.state = GUARD_STARE;
    guard.pauseFor = GUARD.stareTime;
    guard.angle = Math.atan2(py - guard.y, px - guard.x);
    return null;
  }
  const target = guard.waypoints[guard.waypointIndex];
  if (followPath(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.path = null;
    guard.pathTarget = null;
  }
  return null;
}
