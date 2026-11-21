// Every tuning number, colour and level brick in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. Velvet Hour: one dusk heist in the Vesper Archive, Veylport.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 12,
  walkSpeed: 168,
  sneakSpeed: 96,
  /** Running (not sneaking) is heard this far away by guards. */
  noiseRadius: 95,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 62,
  investigateSpeed: 96,
  chaseSpeed: 134,
  /** How far a guard can see, in pixels. */
  visionRange: 230,
  /** Half of the vision cone's angle, in radians (about 35 degrees each side). */
  visionHalfAngle: 0.62,
  /** Seconds a guard keeps chasing after losing sight of the thief. */
  chaseMemory: 3.5,
  /** Seconds a guard searches the last seen spot before giving up. */
  searchTime: 3.0,
  /** Seconds a guard stands and stares when something looks off. */
  stareTime: 0.9,
};

/** Suspicion fills 0..1 while a guard sees the thief; at 1 the guard gives chase. */
export const DETECT = {
  /** Base fill per second at point-blank range, scaled down with distance. */
  baseRate: 1.5,
  /** Multiplier while the thief sneaks. */
  sneakFactor: 0.45,
  /** Multiplier while the thief stands in a plant's shadow or a dark corner. */
  hiddenFactor: 0.25,
  /** Suspicion lost per second while unseen. */
  decayRate: 0.6,
};

export const GADGETS = {
  /** Coins: thrown to a spot, they clink and pull nearby guards over to look. */
  coins: 3,
  coinNoiseRadius: 240,
  coinThrowRange: 340,
  /** Smoke: a puff that breaks every line of sight for a few seconds. */
  smoke: 2,
  smokeSeconds: 4.0,
  smokeRadius: 90,
};

export const SCORE = {
  treasure: 150,
  ledger: 500,
  ghostBonus: 300,
  /** Time bonus on a win: 2 points per second under 300 seconds. */
  timeParSeconds: 300,
  timePerSecond: 2,
};

/** Axis-aligned rectangles: { x, y, w, h }. Walls block movement and sight. */
export const WALLS = [
  // Outer shell.
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  // Vault room (top right): west wall and south wall with a door gap at x 1080..1160.
  { x: 960, y: 24, w: 24, h: 212 },
  { x: 984, y: 236, w: 96, h: 24 },
  { x: 1160, y: 236, w: 96, h: 24 },
  // West reading room: east wall with a door gap at y 150..210, south wall gap at x 150..230.
  { x: 360, y: 24, w: 24, h: 126 },
  { x: 360, y: 210, w: 24, h: 90 },
  { x: 24, y: 300, w: 126, h: 24 },
  { x: 230, y: 300, w: 154, h: 24 },
];

/** Cover: shelves, desks, pillars and crates. They block movement and sight. */
export const COVER = [
  // Central hall shelf rows.
  { x: 520, y: 120, w: 160, h: 36, kind: 'shelf' },
  { x: 520, y: 220, w: 160, h: 36, kind: 'shelf' },
  { x: 760, y: 120, w: 160, h: 36, kind: 'shelf' },
  { x: 760, y: 220, w: 160, h: 36, kind: 'shelf' },
  // West reading room desks.
  { x: 80, y: 100, w: 120, h: 44, kind: 'desk' },
  { x: 80, y: 200, w: 120, h: 44, kind: 'desk' },
  // East reading desk.
  { x: 1000, y: 360, w: 150, h: 44, kind: 'desk' },
  // Pillars.
  { x: 480, y: 360, w: 36, h: 36, kind: 'pillar' },
  { x: 800, y: 360, w: 36, h: 36, kind: 'pillar' },
  { x: 480, y: 520, w: 36, h: 36, kind: 'pillar' },
  { x: 800, y: 520, w: 36, h: 36, kind: 'pillar' },
  // South crates and a low shelf.
  { x: 240, y: 600, w: 56, h: 56, kind: 'crate' },
  { x: 1060, y: 600, w: 56, h: 56, kind: 'crate' },
  { x: 560, y: 560, w: 160, h: 36, kind: 'shelf' },
];

/** Potted palms: they block movement, not sight, but standing in one hides the thief. */
export const PLANTS = [
  { x: 420, y: 80, r: 24 },
  { x: 900, y: 80, r: 24 },
  { x: 300, y: 470, r: 24 },
  { x: 660, y: 470, r: 24 },
  { x: 1120, y: 520, r: 24 },
  { x: 140, y: 620, r: 24 },
];

/** The steal: the Cinder Ledger, kept in the vault room. */
export const LEDGER = { x: 1116, y: 110, name: 'Cinder Ledger' };

/** Optional treasures, each worth SCORE.treasure. */
export const TREASURES = [
  { x: 140, y: 70, name: 'Brass Astrolabe' },
  { x: 640, y: 420, name: 'Jade Moth' },
  { x: 1180, y: 620, name: 'Ivory Compass' },
];

/** The way out: the south door the thief slipped in through. */
export const EXIT = { x: 48, y: 640, w: 104, h: 56 };

export const SPAWN = { x: 100, y: 600 };

/** The five wardens, each with a patrol loop of waypoints and a name. */
export const GUARD_DEFS = [
  {
    name: 'Warden Ilya',
    waypoints: [
      { x: 500, y: 180 },
      { x: 920, y: 180 },
      { x: 920, y: 320 },
      { x: 500, y: 320 },
    ],
  },
  {
    name: 'Warden Bram',
    waypoints: [
      { x: 1010, y: 300 },
      { x: 1220, y: 300 },
      { x: 1220, y: 430 },
      { x: 1010, y: 430 },
    ],
  },
  {
    name: 'Warden Sable',
    waypoints: [
      { x: 60, y: 60 },
      { x: 320, y: 60 },
      { x: 320, y: 280 },
      { x: 60, y: 280 },
    ],
  },
  {
    name: 'Warden Mire',
    waypoints: [
      { x: 340, y: 620 },
      { x: 1000, y: 620 },
    ],
  },
  {
    name: 'Warden Odo',
    waypoints: [
      { x: 1010, y: 80 },
      { x: 1210, y: 80 },
      { x: 1210, y: 190 },
      { x: 1010, y: 190 },
    ],
  },
];

export const PALETTE = {
  backdrop: '#0d0a14',
  floor: '#1c1626',
  floorTile: '#211a2e',
  floorInlay: '#2a2140',
  wall: '#3a2f52',
  wallTop: '#54457a',
  shelf: '#4a3220',
  shelfTop: '#6b4a2c',
  desk: '#54401f',
  pillar: '#453a5e',
  crate: '#5a4632',
  plant: '#2e5d3a',
  plantDark: '#22452c',
  coneCalm: 'rgba(255, 214, 120, 0.13)',
  coneCalmEdge: 'rgba(255, 214, 120, 0.35)',
  coneAlert: 'rgba(255, 84, 84, 0.20)',
  coneAlertEdge: 'rgba(255, 84, 84, 0.55)',
  guard: '#c9a86a',
  guardAlert: '#ff5d5d',
  player: '#7fe7c4',
  playerDark: '#3fae8a',
  ledger: '#ffd76a',
  treasure: '#e8b4ff',
  exit: '#7fe7c4',
  smoke: 'rgba(200, 200, 215, 0.35)',
  hudPanel: 'rgba(13, 10, 20, 0.78)',
  text: '#f2ead8',
  muted: '#a99ec2',
  danger: '#ff6b6b',
  gold: '#ffd76a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score and best time are kept between visits (this browser only). */
export const BEST_KEY = 'velvet-hour.best';
export const BEST_TIME_KEY = 'velvet-hour.best-time';
