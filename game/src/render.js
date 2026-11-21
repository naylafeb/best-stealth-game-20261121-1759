// Everything the eye sees: the dusk archive, the wardens' cones of lamplight, the
// thief, the HUD (objectives, heat meter, gadgets, minimap) and the four screens
// (title, paused, caught, won). The canvas is a fixed 1280x720 logical area scaled
// to the window, so the game looks the same on any screen.
import { FIELD, WALLS, COVER, PLANTS, LEDGER, TREASURES, EXIT, GUARD, PALETTE, FONT } from './config.js';
import { GUARD_CHASE, GUARD_STARE } from './guards.js';
import { scoreBreakdown } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const MINIMAP = { x: FIELD.width - 216, y: 12, w: 204, h: 115, scale: 204 / FIELD.width };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  }
  fit();
  window.addEventListener('resize', fit);

  function drawFloor(state) {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Checker of worn floor tiles.
    ctx.fillStyle = PALETTE.floorTile;
    for (let y = 24; y < 696; y += 48) {
      for (let x = 24 + ((y / 48) % 2) * 24; x < 1256; x += 48) {
        ctx.fillRect(x, y, 24, 24);
      }
    }
    // A faded inlay runner down the central hall.
    ctx.fillStyle = PALETTE.floorInlay;
    ctx.fillRect(384, 340, 512, 10);
    ctx.fillRect(384, 540, 512, 10);
    // Lamplight pools on the floor.
    for (const lamp of [
      { x: 300, y: 120 },
      { x: 640, y: 300 },
      { x: 980, y: 120 },
      { x: 640, y: 620 },
      { x: 1116, y: 180 },
    ]) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 120);
      g.addColorStop(0, 'rgba(255, 205, 110, 0.10)');
      g.addColorStop(1, 'rgba(255, 205, 110, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(lamp.x - 120, lamp.y - 120, 240, 240);
    }
    // Dust motes.
    ctx.fillStyle = 'rgba(255, 230, 170, 0.5)';
    for (const mote of state.motes) {
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWallsAndCover() {
    for (const wall of WALLS) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      if (wall.h <= 24) ctx.fillRect(wall.x, wall.y, wall.w, 4);
      else ctx.fillRect(wall.x, wall.y, 4, wall.h);
    }
    for (const block of COVER) {
      if (block.kind === 'shelf') {
        ctx.fillStyle = PALETTE.shelf;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = PALETTE.shelfTop;
        ctx.fillRect(block.x, block.y, block.w, 6);
        // Book spines along the shelf.
        ctx.fillStyle = 'rgba(255, 214, 120, 0.25)';
        for (let x = block.x + 6; x < block.x + block.w - 8; x += 12) {
          ctx.fillRect(x, block.y + 10, 5, block.h - 16);
        }
      } else if (block.kind === 'desk') {
        ctx.fillStyle = PALETTE.desk;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = 'rgba(242, 234, 216, 0.5)';
        ctx.fillRect(block.x + 14, block.y + 12, 34, 20);
        ctx.fillRect(block.x + block.w - 52, block.y + 12, 34, 20);
      } else if (block.kind === 'pillar') {
        ctx.fillStyle = PALETTE.pillar;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(block.x + 4, block.y + 4, block.w - 8, block.h - 8);
      } else {
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(block.x, block.y, block.w, block.h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(block.x + 3, block.y + 3, block.w - 6, block.h - 6);
        ctx.beginPath();
        ctx.moveTo(block.x + 3, block.y + 3);
        ctx.lineTo(block.x + block.w - 3, block.y + block.h - 3);
        ctx.moveTo(block.x + block.w - 3, block.y + 3);
        ctx.lineTo(block.x + 3, block.y + block.h - 3);
        ctx.stroke();
      }
    }
    for (const plant of PLANTS) {
      ctx.fillStyle = PALETTE.plantDark;
      ctx.beginPath();
      ctx.arc(plant.x, plant.y, plant.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.plant;
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          plant.x + Math.cos(a) * plant.r * 0.45,
          plant.y + Math.sin(a) * plant.r * 0.45,
          9,
          5,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  function drawCone(guard) {
    const alert = guard.state === GUARD_CHASE;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, GUARD.visionRange, guard.angle - GUARD.visionHalfAngle, guard.angle + GUARD.visionHalfAngle);
    ctx.closePath();
    ctx.fillStyle = alert ? PALETTE.coneAlert : PALETTE.coneCalm;
    ctx.fill();
    ctx.strokeStyle = alert ? PALETTE.coneAlertEdge : PALETTE.coneCalmEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawPlayer(state) {
    const p = state.player;
    // Smoke puff around the thief.
    if (p.smokedFor > 0) {
      const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 90);
      g.addColorStop(0, 'rgba(200, 200, 215, 0.45)');
      g.addColorStop(1, 'rgba(200, 200, 215, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 90, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hooded cloak: a teardrop pointing where the thief faces.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.playerDark;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.quadraticCurveTo(0, -13, -12, -9);
    ctx.quadraticCurveTo(-16, 0, -12, 9);
    ctx.quadraticCurveTo(0, 13, 16, 0);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(2, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Sneak ring: a quiet circle while sneaking.
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(127, 231, 196, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Click target marker.
    if (p.targetX !== null && p.targetY !== null) {
      ctx.strokeStyle = 'rgba(242, 234, 216, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.targetX, p.targetY, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.targetX - 10, p.targetY);
      ctx.lineTo(p.targetX + 10, p.targetY);
      ctx.moveTo(p.targetX, p.targetY - 10);
      ctx.lineTo(p.targetX, p.targetY + 10);
      ctx.stroke();
    }
  }

  function drawItems(state) {
    // The exit: a glowing south door.
    ctx.fillStyle = '#0a2e22';
    ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.strokeStyle = state.ledgerTaken ? PALETTE.exit : 'rgba(127, 231, 196, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    ctx.fillStyle = state.ledgerTaken ? PALETTE.exit : PALETTE.muted;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(state.ledgerTaken ? 'EXIT — GO!' : 'EXIT', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 5);
    // The ledger's plinth in the vault.
    ctx.fillStyle = '#3a2f52';
    ctx.fillRect(LEDGER.x - 22, LEDGER.y - 14, 44, 28);
    if (!state.ledgerTaken) {
      const pulse = 0.6 + 0.4 * Math.sin(state.time * 3);
      const g = ctx.createRadialGradient(LEDGER.x, LEDGER.y, 2, LEDGER.x, LEDGER.y, 46);
      g.addColorStop(0, `rgba(255, 215, 106, ${0.35 * pulse})`);
      g.addColorStop(1, 'rgba(255, 215, 106, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(LEDGER.x - 46, LEDGER.y - 46, 92, 92);
      ctx.fillStyle = PALETTE.ledger;
      ctx.save();
      ctx.translate(LEDGER.x, LEDGER.y);
      ctx.rotate(-0.15);
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#8a6a1f';
      ctx.fillRect(-11, -8, 22, 4);
      ctx.restore();
    }
    // Treasures.
    for (let i = 0; i < TREASURES.length; i += 1) {
      if (state.treasuresTaken[i]) continue;
      const t = TREASURES[i];
      const bob = Math.sin(state.time * 2 + i * 2) * 3;
      ctx.fillStyle = PALETTE.treasure;
      ctx.beginPath();
      ctx.arc(t.x, t.y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2f52';
      ctx.beginPath();
      ctx.arc(t.x, t.y + bob, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Coin ripples.
    for (const ripple of state.ripples) {
      const a = 1 - ripple.age / 1.6;
      ctx.strokeStyle = `rgba(255, 215, 106, ${0.8 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, 8 + ripple.age * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(state, screen) {
    // Objectives panel, top left.
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(12, 12, 300, 92);
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 300, 92);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText('VELVET HOUR — VESPER ARCHIVE', 24, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px ' + FONT;
    const ledgerMark = state.ledgerTaken ? '✓' : '○';
    ctx.fillText(`${ledgerMark} Steal the Cinder Ledger`, 24, 56);
    const got = state.treasuresTaken.filter(Boolean).length;
    ctx.fillText(`○ Treasures  ${got} / ${TREASURES.length}`, 24, 76);
    ctx.fillStyle = state.ledgerTaken ? PALETTE.exit : PALETTE.muted;
    ctx.fillText(state.ledgerTaken ? '→ Reach the south door unseen' : '○ Reach the south door (needs the Ledger)', 24, 96);
    // Score and time, top centre.
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(FIELD.width / 2 - 110, 12, 220, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 16px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    const mm = String(Math.floor(state.time / 60)).padStart(2, '0');
    const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
    ctx.fillText(`${mm}:${ss}`, FIELD.width / 2, 48);
    // Heat meter, top centre below the score.
    const heat = state.heat;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(FIELD.width / 2 - 110, 62, 220, 26);
    ctx.fillStyle = '#241d33';
    ctx.fillRect(FIELD.width / 2 - 100, 70, 200, 10);
    ctx.fillStyle = heat > 0.7 ? PALETTE.danger : heat > 0.35 ? PALETTE.gold : PALETTE.player;
    ctx.fillRect(FIELD.width / 2 - 100, 70, 200 * heat, 10);
    ctx.fillStyle = heat > 0.7 ? PALETTE.danger : PALETTE.muted;
    ctx.font = '11px ' + FONT;
    ctx.fillText(heat > 0.7 ? 'SEEN — RUN!' : heat > 0.35 ? 'SUSPICION RISING' : 'UNSEEN', FIELD.width / 2, 84);
    if (state.chaserName) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 13px ' + FONT;
      ctx.fillText(`${state.chaserName} is hunting you!`, FIELD.width / 2, 106);
    }
    // Gadgets, bottom centre (kept clear of the exit door at bottom left).
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(FIELD.width / 2 - 130, FIELD.height - 56, 260, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '13px ' + FONT;
    ctx.fillText(`[E] Coin toss  × ${state.player.coins}`, FIELD.width / 2 - 118, FIELD.height - 34);
    ctx.fillText(`[Q] Smoke puff  × ${state.player.smoke}`, FIELD.width / 2 - 118, FIELD.height - 16);
    // Controls hint, bottom right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px ' + FONT;
    ctx.fillText('WASD / arrows move · Shift sneak · click to walk · P pause', FIELD.width - 14, FIELD.height - 18);
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const m = MINIMAP;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(m.x - 6, m.y - 6, m.w + 12, m.h + 12);
    ctx.fillStyle = '#171222';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    const sx = (x) => m.x + x * m.scale;
    const sy = (y) => m.y + y * m.scale;
    ctx.fillStyle = '#4a3f6b';
    for (const wall of WALLS) ctx.fillRect(sx(wall.x), sy(wall.y), Math.max(1, wall.w * m.scale), Math.max(1, wall.h * m.scale));
    for (const block of COVER) ctx.fillRect(sx(block.x), sy(block.y), Math.max(1, block.w * m.scale), Math.max(1, block.h * m.scale));
    if (!state.ledgerTaken) {
      ctx.fillStyle = PALETTE.ledger;
      ctx.beginPath();
      ctx.arc(sx(LEDGER.x), sy(LEDGER.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < TREASURES.length; i += 1) {
      if (state.treasuresTaken[i]) continue;
      ctx.fillStyle = PALETTE.treasure;
      ctx.beginPath();
      ctx.arc(sx(TREASURES[i].x), sy(TREASURES[i].y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(sx(EXIT.x), sy(EXIT.y), EXIT.w * m.scale, EXIT.h * m.scale);
    for (const guard of state.guards) {
      ctx.fillStyle = guard.state === GUARD_CHASE ? PALETTE.danger : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(sx(guard.x), sy(guard.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(sx(state.player.x), sy(state.player.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '10px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('MAP', m.x, m.y + m.h + 14);
  }

  function vignette() {
    const g = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    g.addColorStop(0, 'rgba(13, 10, 20, 0)');
    g.addColorStop(1, 'rgba(13, 10, 20, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 7, 16, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px ' + FONT;
    ctx.fillText(title, FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px ' + FONT;
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 260 + i * 30));
  }

  function drawTitle(state, best, bestTime) {
    overlay('VELVET HOUR', [
      'Dusk over the canal city of Veylport. The Vesper Archive keeps one book',
      'that must never be read — the Cinder Ledger — and five wardens who walk',
      'its halls with lanterns. Slip past their cones of light, pocket the',
      'Ledger and the treasures, and leave through the south door unseen.',
      '',
      'WASD / arrows — move      Shift — sneak (slow, quiet, hard to spot)',
      'Click — walk there      E — toss a coin to lure a warden',
      'Q — smoke puff (breaks every gaze)      P — pause',
      'Hide in the potted palms. Run, and the wardens will hear you.',
      '',
      'Press Space or click to begin the heist.',
    ], PALETTE.gold);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '14px ' + FONT;
      ctx.fillText(`Best score ${best}${bestTime ? `  ·  best time ${bestTime}` : ''}`, FIELD.width / 2, 560);
    }
  }

  function drawPaused() {
    overlay('PAUSED', ['The archive holds its breath.', '', 'Press P or Space to keep moving.'], PALETTE.text);
  }

  function drawCaught(state) {
    overlay('CAUGHT!', [
      'A lantern found you, and the wardens closed in.',
      `Score ${state.score}  ·  time ${Math.floor(state.time)}s`,
      '',
      'Press Space or click to try the night again.',
    ], PALETTE.danger);
  }

  function drawWin(state) {
    const parts = scoreBreakdown(state);
    const mm = String(Math.floor(state.time / 60)).padStart(2, '0');
    const ss = String(Math.floor(state.time % 60)).padStart(2, '0');
    overlay('UNSEEN.', [
      'The Cinder Ledger is yours, and no warden ever knew you were there.',
      '',
      `Treasures  +${parts.treasures}      Ledger  +${parts.ledger}`,
      `Time bonus  +${parts.timeBonus}      Ghost bonus  +${parts.ghost}`,
      '',
      `Final score  ${state.score}  ·  time  ${mm}:${ss}`,
      '',
      'Press Space or click to steal it all over again.',
    ], PALETTE.exit);
  }

  function draw(state, screen, best, bestTime) {
    drawFloor(state);
    for (const guard of state.guards) drawCone(guard);
    drawItems(state);
    drawWallsAndCover();
    for (const guard of state.guards) {
      // Body drawn after the cone so the warden stands on its own light.
      ctx.fillStyle = guard.state === GUARD_CHASE ? PALETTE.guardAlert : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#241d33';
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = guard.state === GUARD_CHASE ? PALETTE.guardAlert : PALETTE.guard;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 8), guard.y + Math.sin(guard.angle) * (GUARD.radius + 8));
      ctx.stroke();
      if (guard.suspicion > 0.05 && guard.state !== GUARD_CHASE) {
        const a0 = -Math.PI / 2;
        ctx.strokeStyle = guard.suspicion > 0.7 ? PALETTE.danger : PALETTE.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y - 22, 9, a0, a0 + guard.suspicion * Math.PI * 2);
        ctx.stroke();
      }
      if (guard.state === GUARD_CHASE) {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = 'bold 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 24);
      } else if (guard.state === GUARD_STARE) {
        ctx.fillStyle = PALETTE.gold;
        ctx.font = 'bold 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - 24);
      }
    }
    drawPlayer(state);
    vignette();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best, bestTime);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_CAUGHT) drawCaught(state);
    else if (screen === SCREEN_WIN) drawWin(state);
  }

  return { draw, fit };
}
