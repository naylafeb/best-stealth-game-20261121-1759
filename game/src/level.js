// The level's geometry questions: what blocks a step, what blocks a glance, and where
// a thief can hide. Walls and cover block both movement and sight; plants block
// movement only, and standing inside one makes the thief hard to spot.
import { FIELD, WALLS, COVER, PLANTS } from './config.js';

/** Every rectangle that stops movement (walls + cover + plants as circles). */
export function blocksAt(x, y, radius) {
  for (let i = 0; i < WALLS.length; i += 1) {
    if (circleHitsRect(x, y, radius, WALLS[i])) return true;
  }
  for (let i = 0; i < COVER.length; i += 1) {
    if (circleHitsRect(x, y, radius, COVER[i])) return true;
  }
  for (let i = 0; i < PLANTS.length; i += 1) {
    const p = PLANTS[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < (radius + p.r * 0.55) * (radius + p.r * 0.55)) return true;
  }
  return false;
}

export function circleHitsRect(x, y, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** True when the straight line from (x1, y1) to (x2, y2) crosses no wall or cover. */
export function lineOfSight(x1, y1, x2, y2) {
  for (let i = 0; i < WALLS.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, WALLS[i])) return false;
  }
  for (let i = 0; i < COVER.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, COVER[i])) return false;
  }
  return true;
}

/** Slab test: does the segment cross the rectangle (touching an edge counts as crossing)? */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when a walker of `radius` can travel the straight segment without touching a wall, cover or plant. */
export function segmentClear(x1, y1, x2, y2, radius) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (blocksAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius)) return false;
  }
  return true;
}
/** True when (x, y) sits inside a plant's shadow — the thief is hard to spot there. */
export function isHidden(x, y) {
  for (let i = 0; i < PLANTS.length; i += 1) {
    const p = PLANTS[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < p.r * p.r) return true;
  }
  return false;
}

/** The nearest plant centre within `radius` of (x, y), or null. */
export function nearbyPlant(x, y, radius) {
  for (let i = 0; i < PLANTS.length; i += 1) {
    const p = PLANTS[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < radius * radius) return p;
  }
  return null;
}

// --- A tiny grid pathfinder (20 px cells) so walkers go around walls instead of
// pushing into them. The grid is small (64x36), so a plain open list is fast.

const CELL = 20;
const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);

function cellBlocked(cx, cy, radius) {
  return blocksAt(cx * CELL + CELL / 2, cy * CELL + CELL / 2, radius);
}

function toCell(x, y) {
  return {
    cx: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
    cy: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
  };
}

/**
 * A* from (sx, sy) to (tx, ty) for a walker of the given radius; returns smoothed
 * waypoints, or null when no route exists.
 */
export function findPath(sx, sy, tx, ty, radius = 12) {
  const start = toCell(sx, sy);
  const goal = toCell(tx, ty);
  if (cellBlocked(goal.cx, goal.cy, radius)) return null;
  const key = (cx, cy) => cy * COLS + cx;
  const open = [{ cx: start.cx, cy: start.cy, g: 0, f: 0, parent: null }];
  const best = new Map([[key(start.cx, start.cy), 0]]);
  const closed = new Set();
  const heuristic = (cx, cy) => Math.hypot(cx - goal.cx, cy - goal.cy);
  let found = null;
  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i].f < open[bi].f) bi = i;
    const node = open.splice(bi, 1)[0];
    const nodeKey = key(node.cx, node.cy);
    if (closed.has(nodeKey)) continue;
    closed.add(nodeKey);
    if (node.cx === goal.cx && node.cy === goal.cy) {
      found = node;
      break;
    }
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = node.cx + dx;
        const ny = node.cy + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        if (cellBlocked(nx, ny, radius)) continue;
        // No cutting corners through a blocked cell.
        if (dx !== 0 && dy !== 0 && (cellBlocked(node.cx + dx, node.cy, radius) || cellBlocked(node.cx, node.cy + dy, radius))) continue;
        const stepCost = dx !== 0 && dy !== 0 ? 1.414 : 1;
        const g = node.g + stepCost;
        const nKey = key(nx, ny);
        if (best.has(nKey) && best.get(nKey) <= g) continue;
        best.set(nKey, g);
        open.push({ cx: nx, cy: ny, g, f: g + heuristic(nx, ny), parent: node });
      }
    }
  }
  if (!found) return null;
  const cells = [];
  let node = found;
  while (node) {
    cells.unshift(node);
    node = node.parent;
  }
  const points = cells.map((c) => ({ x: c.cx * CELL + CELL / 2, y: c.cy * CELL + CELL / 2 }));
  points[points.length - 1] = { x: tx, y: ty };
  // Smooth: skip ahead while the straight line stays walkable (walls, cover, plants).
  const smooth = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && !segmentClear(points[i].x, points[i].y, points[j].x, points[j].y, radius)) j -= 1;
    smooth.push(points[j]);
    i = j;
  }
  return smooth;
}
